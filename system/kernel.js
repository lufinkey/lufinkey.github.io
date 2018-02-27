
// wait for window load to create kernel
window.addEventListener('load', () => {

// function to evaluate a given script
function evalScript(__scope, __code) {
	// define scope
	const evalScript = undefined;
	const syscall = __scope.syscall;
	const require = __scope.require;
	const __dirname = __scope.__dirname;
	const module = __scope.module;
	const exports = (__scope.module ? __scope.module.exports : undefined);
	const resolve = __scope.resolve;
	const reject = __scope.reject;
	const process = __scope.process;

	return (function(){
		return eval(__code);
	}).bind({})();
}



// sandbox kernel data
(function(){

function randomString(length = 32)
{
	var possible = 'abcdefghijklmnopqrstuvwxyz0123456789';
	var str = '';
	for(var i=0; i<length; i++)
	{
		var index = Math.floor(Math.random()*possible.length);
		str += possible[index];
	}
	return str;
}

function deepCopyObject(object)
{
	if(['null', 'undefined', 'function', 'symbol'].includes(typeof object))
	{
		return object;
	}
	else if(typeof object === 'number')
	{
		return 0+object;
	}
	else if(typeof object == 'string')
	{
		return ''+object;
	}
	else if(object instanceof Array)
	{
		var newObject = object.slice(0);
		for(var i=0; i<newObject.length; i++)
		{
			newObject[i] = deepCopyObject(newObject[i]);
		}
		return newObject;
	}
	else
	{
		var newObject = {};
		for(const key in object)
		{
			newObject[key] = deepCopyObject(object[key]);
		}
		return newObject;
	}
}


const rootContext = {
	cwd: '/',
	pid: 0,
	uid: 0,
	gid: 0,
	env: {
		paths: [
			'/system/slib',
			'/system/lib',
			'/lib'
		]
	}
};


function runScript(kernel, interpreter, scope, code)
{
	switch(interpreter)
	{
		case 'babel':
			const Babel = kernel.require(rootContext, scope, '/', 'babel');
			code = Babel.transform(code, {presets:['react']}).code;
			break;

		case undefined:
			break;

		default:
			throw new Error("invalid interpreter");
	}
	return evalScript(scope, code);
}


// Kernel class
function Kernel()
{
	const osName = 'finkeos';


	// Filesystem class
	function Filesystem(kernel, storage)
	{
		const fsMetaPrefix = osName+'/fs-meta:';
		const fsPrefix = osName+'/fs:';

		// get path of directory containing path
		function dirname(context, path)
		{
			var pathParts = path.split('/');
			if(pathParts.length === 0 || (pathParts.length === 1 && pathParts[0] === ""))
			{
				throw new Error("invalid path");
			}

			// determine if path is absolute
			var absolute = false;
			if(pathParts[0] === "")
			{
				absolute = true;
			}

			// remove empty entries in path
			for(var i=0; i<pathParts.length; i++)
			{
				if(pathParts[i] === "")
				{
					pathParts.splice(i, 1);
					i--;
				}
			}

			// trim last entry
			pathParts = pathParts.slice(0, pathParts.length-1);
			
			// return dir name
			if(pathParts.length==0)
			{
				if(absolute)
				{
					return '/';
				}
				else
				{
					return ".";
				}
			}
			if(absolute)
			{
				return '/'+pathParts.join('/');
			}
			return pathParts.join('/');
		}


		// get entry name of path
		function basename(context, path)
		{
			var pathParts = path.split('/');
			
			// remove empty entries in path
			for(var i=0; i<pathParts.length; i++)
			{
				if(pathParts[i] === "")
				{
					pathParts.splice(i, 1);
					i--;
				}
			}

			// return empty string if no path parts
			if(pathParts.length === 0)
			{
				return "";
			}

			return pathParts[pathParts.length-1];
		}


		// validate path
		function resolvePath(context, path, cwd)
		{
			if(!cwd)
			{
				cwd = context.cwd;
				if(!cwd)
				{
					cwd = '/';
				}
			}

			// ensure string
			if(typeof path !== 'string')
			{
				throw new Error("path is not a string");
			}
			path = ''+path;

			// split path into parts
			var pathParts = path.split('/');
			if(pathParts.length === 0)
			{
				throw new Error("no path parts somehow?");
			}
			else if(pathParts.length === 1 && pathParts[0] === "")
			{
				throw new Error("empty path string");
			}

			// check if path is absolute
			var absolute = false;
			if(pathParts[0] === "")
			{
				absolute = true;
				if(pathParts.length === 2 && pathParts[1] === "")
				{
					return '/';
				}
				pathParts = pathParts.slice(1);
			}

			// shave off trailing '/' if necessary
			if(pathParts[pathParts.length-1] === "")
			{
				pathParts = pathParts.slice(0, pathParts.length-1);
			}
			
			// remove empty contents in path
			for(var i=0; i<pathParts.length; i++)
			{
				if(pathParts[i] === "")
				{
					pathParts.splice(i, 1);
					i--;
				}
			}

			function resolvePathParts(pathParts, cwd)
			{
				if(pathParts.length === 0)
				{
					return cwd;
				}

				if(pathParts[0] == '.')
				{
					return resolvePathParts(pathParts.slice(1), cwd);
				}
				else if(pathParts[0] == '..')
				{
					if(cwd === '/')
					{
						throw new Error("path goes above root directory");
					}
					var cwdDir = dirname(context, cwd);
					return resolvePathParts(pathParts.slice(1), cwdDir);
				}
				var nextCwd = null;
				if(cwd === '/')
				{
					nextCwd = '/'+pathParts[0];
				}
				else
				{
					nextCwd = cwd + '/' + pathParts[0];
				}
				return resolvePathParts(pathParts.slice(1), nextCwd);
			}

			return resolvePathParts(pathParts, cwd);
		}


		// get metadata about item at path
		function readMeta(context, path)
		{
			path = resolvePath(context, path);

			var meta = storage.getItem(fsMetaPrefix+path);
			if(meta != null)
			{
				try
				{
					meta = JSON.parse(meta);
				}
				catch(error)
				{
					throw new Error("corrupted entry meta");
				}
			}
			return meta;
		}


		// create a default meta object
		function createMeta(context, meta)
		{
			var newMeta = Object.assign({}, meta);
			var defaultMeta = {
				type: 'file',
				dateCreated: new Date().getTime(),
				dateUpdated: new Date().getTime()
			};

			for(const metaKey in defaultMeta)
			{
				if(newMeta[metaKey] === undefined)
				{
					newMeta[metaKey] = defaultMeta[metaKey];
				}
			}

			return newMeta;
		}


		// write an entry
		function writeEntry(context, path, meta, data)
		{
			path = resolvePath(context, path);
			
			// validate data
			if(typeof data !== 'string')
			{
				throw new Error("non-string data may not be written");
			}

			// get info about potentially already existing entry
			var entryMeta = readMeta(context, path);

			// validate containing directory
			var dirPath = dirname(context, path);
			var dirMeta = readMeta(context, dirPath);
			if(dirMeta == null)
			{
				throw new Error("parent directory does not exist");
			}
			else if(dirMeta.type !== 'dir')
			{
				throw new Error("invalid containing directory");
			}

			var dirData = readDir(context, dirPath);

			// create new meta data
			var newMeta = entryMeta;
			if(newMeta == null)
			{
				// create default meta
				newMeta = createMeta(context, meta);
			}
			else
			{
				// validate existing meta
				if(meta.type !== entryMeta.type)
				{
					throw new Error("overwriting entry type mismatch");
				}
			}

			// add updated entry meta info
			newMeta.dateUpdated = new Date().getTime();

			// add updated parent dir entry meta info
			dirMeta.dateUpdated = new Date().getTime();

			// add entry to parent directory contents, if not already added
			var entryName = basename(context, path);
			if(!dirData.includes(entryName))
			{
				dirData.push(entryName);
			}

			// write meta + data + parent dir meta + parent dir data
			storage.setItem(fsMetaPrefix+path, JSON.stringify(newMeta));
			storage.setItem(fsPrefix+path, data);
			storage.setItem(fsMetaPrefix+dirPath, JSON.stringify(dirMeta));
			storage.setItem(fsPrefix+dirPath, JSON.stringify(dirData));
		}


		// check if an entry exists
		function exists(context, path)
		{
			path = resolvePath(context, path);
			if(storage.getItem(fsPrefix+path) == null)
			{
				return false;
			}
			return true;
		}

		// read the contents of a directory
		function readDir(context, path)
		{
			path = resolvePath(context, path);

			// read dir meta
			var meta = readMeta(context, path);
			if(meta == null)
			{
				throw new Error("directory does not exist");
			}
			else if(meta.type !== 'dir')
			{
				throw new Error("entry is not a directory");
			}

			// read directory data
			var data = storage.getItem(fsPrefix+path);
			if(data == null)
			{
				throw new Error("missing directory data");
			}
			try
			{
				data = JSON.parse(data);
			}
			catch(error)
			{
				throw new Error("corrupted directory data");
			}

			return data;
		}

		// create a directory
		function createDir(context, path, options)
		{
			path = resolvePath(context, path);
			options = Object.assign({}, options);

			var meta = readMeta(context, path);
			if(meta != null)
			{
				if(meta.type == 'dir')
				{
					if(options.ignoreIfExists)
					{
						return;
					}
					else
					{
						throw new Error("directory already exists");
					}
				}
				else
				{
					throw new Error("entry already exists at path");
				}
			}

			return writeEntry(context, path, {type: 'dir'}, JSON.stringify([]));
		}

		// read file from a given path
		function readFile(context, path)
		{
			path = resolvePath(context, path);
			
			var meta = readMeta(context, path);
			if(meta == null)
			{
				throw new Error("file does not exist");
			}
			else if(meta.type !== 'file')
			{
				throw new Error("entry is not a file");
			}

			var data = storage.getItem(fsPrefix+path);
			if(data == null)
			{
				throw new Error("missing file data");
				return;
			}
			return data;
		}

		// write file to a given path
		function writeFile(context, path, data)
		{
			return writeEntry(context, path, {type: 'file'}, data);
		}

		// determine the interpreter for the file
		function getInterpreter(context, path)
		{
			// TODO don't hardcode the interpreter
			const fullPath = resolvePath(context, path);
			if(fullPath.startsWith('/system/slib/') || fullPath=='/system/boot.js')
			{
				return undefined;
			}
			return 'babel';
		}

		// execute a js script at a given path
		function executeFile(context, path, scope)
		{
			return (new Process(kernel, context, path, scope)).execute();
		}

		// load a js script into the current process
		function requireFile(context, path, scope)
		{
			const data = kernel.filesystem.readFile(context, path);
			const interpreter = getInterpreter(context, path);
			return runScript(kernel, interpreter, scope, data);
		}

		// create default filesystem, if necessary
		var rootDirMeta = storage.getItem(fsMetaPrefix+'/');
		if(!rootDirMeta)
		{
			// root dir has no meta. create empty filesystem
			storage.setItem(fsMetaPrefix+'/', JSON.stringify(createMeta(rootContext, {type: 'dir'})));
			storage.setItem(fsPrefix+'/', JSON.stringify([]));
		}

		// add properties
		this.dirname = dirname;
		this.basename = basename;
		this.resolvePath = resolvePath;
		this.exists = exists;
		this.readMeta = readMeta;
		this.readDir = readDir;
		this.createDir = createDir;
		this.readFile = readFile;
		this.writeFile = writeFile;
		this.executeFile = executeFile;
		this.requireFile = requireFile;
	}



	let pidCounter = 1;
	
	function Process(kernel, parentContext, path, scope)
	{
		const pid = pidCounter;
		pidCounter++;

		const context = deepCopyObject(parentContext);
		context.pid = pid;

		const dir = kernel.filesystem.dirname(parentContext, path);

		scope = Object.assign({
			syscall: (func, ...args) => {
				return syscall(kernel, context, func, ...args);
			},
			require: (path) => {
				return kernel.require(context, scope, dir, path);
			},
			__dirname: dir,
			module: {exports:{}},
		}, scope);

		let executed = false;


		function endProcess()
		{
			unloadRequired(kernel, context);
		}


		this.execute = () => {
			if(executed)
			{
				throw new Error("process already executed");
			}
			executed = true;

			return new Promise((resolve, reject) => {
				context.resolve = (...args) => {
					endProcess();
					resolve(...args);
				};

				context.reject = (...args) => {
					endProcess();
					reject(...args);
				};

				kernel.filesystem.requireFile(context, path, scope);
			});
		};
	}



	let loadedModules = {};
	let sharedModules = {};

	function require(kernel, context, parentScope, dir, path)
	{
		var modulePath = null;
		if(path.startsWith('/') || path.startsWith('./') || path.startsWith('../'))
		{
			try
			{
				modulePath = kernel.filesystem.resolvePath(context, path, dir);
			}
			catch(error)
			{
				throw new Error("could not resolve module");
			}
		}
		else
		{
			if(!context.env || !context.env.paths)
			{
				throw new Error("could not resolve module");
			}
			for(const basePath of context.env.paths)
			{
				try
				{
					modulePath = kernel.filesystem.resolvePath(context, path, basePath);
					break;
				}
				catch(error)
				{
					// path couldn't be resolved
				}
			}
			if(modulePath == null)
			{
				throw new Error("could not resolve module");
			}
		}

		modulePath += '.js';
		if(!kernel.filesystem.exists(context, modulePath))
		{
			throw new Error("module does not exist");
		}

		if(!loadedModules[context.pid])
		{
			loadedModules[context.pid] = {};
		}

		// share library if in slib
		let moduleContext = context;
		let moduleContainer = loadedModules[context.pid];
		if(modulePath.startsWith('/system/slib'))
		{
			moduleContext = rootContext;
			moduleContainer = sharedModules;
		}

		// check if module already loaded
		if(moduleContainer[modulePath] !== undefined)
		{
			return moduleContainer[modulePath];
		}

		const pathDir = kernel.filesystem.dirname(context, modulePath);

		var scope = Object.assign({}, parentScope);
		scope.require = (path) => {
			return require(kernel, moduleContext, scope, pathDir, path);
		};
		scope.__dirname = pathDir;
		scope.module = { exports: {} };

		kernel.filesystem.requireFile(moduleContext, modulePath, scope);

		moduleContainer[modulePath] = scope.module.exports;

		return scope.module.exports;
	}

	function unloadRequired(kernel, context)
	{
		delete loadedModules[context.pid];
	}



	function syscall(kernel, context, func, ...args)
	{
		if(typeof func != 'string')
		{
			throw new Error("func must be a string");
		}
		func = ''+func;

		var funcParts = func.split('.');
		if(funcParts.length > 2)
		{
			throw new Error("invalid system call");
		}
		switch(funcParts[0])
		{
			case 'filesystem':
				if(!Object.keys(kernel.filesystem).includes(funcParts[1]))
				{
					throw new Error("invalid system call");
				}
				var caller = kernel.filesystem[funcParts[1]];
				return caller(context, ...args);

			default:
				throw new Error("invalid system call");
		}
	}



	function log(kernel, context, message, options)
	{
		options = Object.assign({}, options);

		const logElement = document.createElement("DIV");
		logElement.textContent = message;
		logElement.style.color = options.color;

		document.getElementById("kernel").appendChild(logElement);
	}



	this.filesystem = new Filesystem(this, window.localStorage);
	this.require = (context, scope, dir, path) => {
		return require(this, context, scope, dir, path);
	};
	this.log = (context, message, options) => {
		return log(this, context, message, options);
	};
// end kernel class
}





// boot sandboxed
setTimeout(() => {

	const bootOptions = {
		freshInstall: true,
		forceNoCache: true
	};



	// class for retrieving a remote file
	function RemoteFile(options)
	{
		options = Object.assign({}, options);

		function saveToFile(kernel, path)
		{
			return new Promise((resolve, reject) => {
				// stop if the file exists locally and we're not fetching everything
				if(kernel.filesystem.exists(rootContext, path) && !bootOptions.freshInstall)
				{
					kernel.log(rootContext, path+" already downloaded; skipping...", {color: 'blue'});
					resolve();
					return;
				}

				// create URL
				var url = options.url;
				if(!url)
				{
					var urlBase = window.location.pathname.toString();
					if(urlBase.endsWith('/'))
					{
						urlBase = urlBase.slice(0, urlBase.length-1);
					}
					url = urlBase + path;
				}
				if(url == null)
				{
					throw new Error("invalid URL");
				}

				kernel.log(rootContext, "downloading "+url, {color: 'yellow'});
				
				// create request to retrieve remote file
				var xhr = new XMLHttpRequest();
				xhr.onreadystatechange = () => {
					if(xhr.readyState == 4)
					{
						// handle result
						if(xhr.status == 200)
						{
							kernel.log(rootContext, "installing "+url, {color: 'blue'});
							// attempt to load the module's script
							try
							{
								var content = xhr.responseText;
								if(options.filter)
								{
									content = options.filter(content);
								}
								kernel.filesystem.writeFile(rootContext, path, content);
							}
							catch(error)
							{
								kernel.log(rootContext, "failed to install "+url+": "+error.message, {color: 'red'});
								reject(error);
								return;
							}
							kernel.log(rootContext, "installed "+url, {color: 'green'});
							resolve();
						}
						else
						{
							kernel.log(rootContext, "failed to download "+url+" with status "+xhr.status+": "+xhr.statusText, {color: 'red'});
							reject(new Error("request failed with status "+xhr.status+": "+xhr.statusText));
						}
					}
				};

				// add random query argument to force re-caching
				var downloadingURL = url;
				if(bootOptions.forceNoCache)
				{
					downloadingURL += '?v='+(Math.random()*999999999);
				}

				// send remote file request
				xhr.open("GET", downloadingURL);
				xhr.send();
			});
		}

		this.saveToFile = saveToFile;
	}
	


	// function to create initial filesystem if necessary
	function createInitialFilesystem(kernel, initialFilesystem)
	{
		// build initial filesystem
		function buildFilesystem(structure, path)
		{
			var promises = [];

			for(const entryName in structure)
			{
				var entry = structure[entryName];
				var entryPath = path+'/'+entryName;

				if(entry instanceof RemoteFile)
				{
					var promise = entry.saveToFile(kernel, entryPath);
					promises.push(promise);
				}
				else
				{
					kernel.filesystem.createDir(rootContext, entryPath, {ignoreIfExists: true});
					promises = promises.concat(buildFilesystem(entry, entryPath));
				}
			}

			return promises;
		}

		var remoteFilePromises = buildFilesystem(initialFilesystem, '');
		return Promise.all(remoteFilePromises);
	}


	// clear local storage if fresh install
	if(bootOptions.freshInstall)
	{
		window.localStorage.clear();
	}


	// declare initial filesystem
	const initialFilesystem = {
		'system': {
			'slib': {
				'react.js': new RemoteFile({url:'https://cdnjs.cloudflare.com/ajax/libs/react/15.4.2/react.js'}),
				'react-dom.js': new RemoteFile({url: 'https://cdnjs.cloudflare.com/ajax/libs/react/15.4.2/react-dom.js'}),
				'babel.js': new RemoteFile({url: 'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/6.21.1/babel.js'}),
			},
			'shell32.exe': {
				'Desktop.js': new RemoteFile(),
				'FileIcon.js': new RemoteFile(),
				'FileIconLayout.js': new RemoteFile(),
				'main.js': new RemoteFile(),
				'TaskBar.js': new RemoteFile(),
				'TaskBarWindowButton.js': new RemoteFile(),
				'Wallpaper.js': new RemoteFile(),
				'Window.js': new RemoteFile(),
				'WindowManager.js': new RemoteFile()
			},
			'transcend32.exe': {
				'CRT.js': new RemoteFile(),
				'main.js': new RemoteFile()
			},
			'boot.js': new RemoteFile(),
			'OS.js': new RemoteFile()
		}
	};

	// start kernel
	var kernel = new Kernel();
	createInitialFilesystem(kernel, initialFilesystem).then(() => {
		kernel.filesystem.executeFile(rootContext, '/system/boot.js');
	}).catch((error) => {
		console.error("fatal kernel error");
		console.error(error);
	});
// end boot sandbox
}, 1000);

// end kernel sandbox
})();

// end event listener
});
