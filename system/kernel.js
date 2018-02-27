

// function to evaluate a given script
function evalScript(__scope, __code) {
	// define scope
	const evalScript = undefined;
	const syscall = __scope.syscall;
	const require = __scope.require;
	const __dirname = __scope.__dirname;
	const module = __scope.module;
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


const rootContext = {
	cwd: '/',
	pid: 0,
	uid: 0,
	gid: 0
};


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
				return resolvePathParts(pathParts.slice(1), cwd+'/'+pathParts[0]);
			}

			if(absolute)
			{
				cwd = '';
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

		// execute a js script at a given path
		function executeFile(context, path, scope)
		{
			return (new Process(kernel, context, path, scope)).execute();
		}

		// load a js script into the current process
		function requireFile(context, path, scope)
		{
			var data = kernel.filesystem.readFile(context, path);
			return evalScript(scope, data);
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
		this.exists = exists;
		this.readMeta = readMeta;
		this.readDir = readDir;
		this.createDir = createDir;
		this.readFile = readFile;
		this.writeFile = writeFile;
		this.executeFile = executeFile;
	}



	let pidCounter = 1;
	
	function Process(kernel, parentContext, path, scope)
	{
		const pid = pidCounter;
		pidCounter++;

		const context = Object.assign({}, parentContext);
		context.pid = pid;

		const dir = kernel.filesystem.dirname(parentContext, path);

		scope = Object.assign({
			syscall: (func, ...args) => {
				return syscall(kernel, context, func, ...args);
			},
			require: (path) => {
				return require(kernel, context, scope, dir, path);
			},
			__dirname: dir,
			module: {exports:{}}
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

				var data = kernel.filesystem.readFile(context, path);
				return evalScript(scope, data);
			});
		};
	}



	let loadedModules = {};

	function require(kernel, context, scope, dir, path)
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
			if(!this.paths)
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

		if(!loadedModules[context.pid])
		{
			loadedModules[context.pid] = {};
		}

		if(loadedModules[context.pid][modulePath] !== undefined)
		{
			return loadedModules[context.pid][modulePath];
		}

		const pathDir = kernel.filesystem.dirname(context, modulePath);

		scope = Object.assign({}, scope);
		scope.require = (path) => {
			return require(kernel, context, scope, pathDir, path);
		};
		scope.__dirname = pathDir;
		scope.module = { exports: {} };

		kernel.filesystem.requireFile(context, modulePath, scope);

		loadedModules[context.pid][modulePath] = scope.module.exports;

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



	this.filesystem = new Filesystem(this, window.localStorage);
}





// boot kernel sandboxed
(function()
{
	const bootOptions = {
		freshInstall: true,
		forceNoCache: true
	};



	// class for retrieving a remote file
	class RemoteFile
	{
		constructor(remoteURL)
		{
			this.url = remoteURL;
		}

		saveToFile(filesystem, path, options)
		{
			options = Object.assign({}, options);
			
			return new Promise((resolve, reject) => {
				// stop if the file exists locally and we're not fetching everything
				if(filesystem.exists(rootContext, path) && !bootOptions.freshInstall)
				{
					resolve();
					return;
				}
				
				// create request to retrieve remote file
				var xhr = new XMLHttpRequest();
				xhr.onreadystatechange = () => {
					if(xhr.readyState == 4)
					{
						// handle result
						if(xhr.status == 200)
						{
							// attempt to load the module's script
							try
							{
								filesystem.writeFile(rootContext, path, xhr.responseText);
							}
							catch(error)
							{
								reject(error);
								return;
							}
							resolve();
						}
						else
						{
							reject(new Error("request failed with status "+xhr.status+": "+xhr.statusText));
						}
					}
				};

				var url = this.url;
				if(bootOptions.forceNoCache)
				{
					url += '?v='+(Math.random()*999999999);
				}

				// send remote file request
				xhr.open("GET", url);
				xhr.send();
			});
		}
	}
	


	// function to create initial filesystem if necessary
	function createInitialFilesystem(kernel)
	{
		// declare initial filesystem
		const initialFilesystem = {
			'system': {
				'boot.js': new RemoteFile('system/boot.js')
			}
		};

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
					var promise = entry.saveToFile(kernel.filesystem, entryPath);
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


	// start kernel
	var kernel = new Kernel();
	createInitialFilesystem(kernel).then(() => {
		kernel.filesystem.executeFile(rootContext, '/system/boot.js');
	}).catch((error) => {
		console.error("fatal kernel error");
		console.error(error);
	});
// end boot sandbox
})();

// end kernel sandbox
})();
