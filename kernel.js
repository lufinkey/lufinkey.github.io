
// clear local storage on boot for now
window.localStorage.clear();

// wait for window load to create kernel
window.addEventListener('load', () => {

// function to evaluate a given script
function evalScript(__scope, __code) {
	// define scope
	__scope = Object.assign({Promise: Promise}, __scope);
	return (function(){
		const evalScript = undefined;
		const syscall = __scope.syscall;
		const require = __scope.require;
		const __dirname = __scope.__dirname;
		const module = __scope.module;
		const exports = (__scope.module ? __scope.module.exports : undefined);
		const resolve = __scope.resolve;
		const reject = __scope.reject;
		const process = __scope.process;
		const Promise = __scope.Promise;

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
	if(['null', 'undefined', 'function', 'boolean', 'symbol'].includes(typeof object))
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
	stdin: null,
	stdout: null,
	stderr: null,
	argv: ['[kernel]'],
	env: {
		libpaths: [
			'/system/slib',
			'/system/lib',
			'/lib'
		],
		paths: [
			'/system/bin',
			'/apps',
			'/bin'
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

		case null:
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


	// process exit signal
	class ExitSignal extends Error
	{
		constructor(signal, message)
		{
			if(typeof signal === 'string')
			{
				message = signal;
				signal = null;
			}
			
			if(!message && signal)
			{
				message = "process exited with signal "+signal;
			}
			super(message);
			this.signal = signal;
		}
	}

	// promise to handle exit signals
	class ProcPromise extends Promise
	{
		constructor(callback)
		{
			let exitSignal = null;
			super((resolve, reject) => {
				try
				{
					callback(resolve, reject);
				}
				catch(error)
				{
					if(error instanceof ExitSignal)
					{
						exitSignal = error;
						return;
					}
					else
					{
						throw error;
					}
				}
			});
			if(exitSignal != null)
			{
				throw exitSignal;
			}
		}

		then(callback)
		{
			let exitSignal = null;
			var retVal = super.then((...args) => {
				try
				{
					if(callback !== undefined)
					{
						return callback(...args);
					}
				}
				catch(error)
				{
					if(error instanceof ExitSignal)
					{
						exitSignal = error;
						return;
					}
					else
					{
						throw error;
					}
				}
			});
			if(exitSignal != null)
			{
				throw exitSignal;
			}
			return retVal;
		}

		catch(callback)
		{
			let exitSignal = null;
			var retVal = super.catch((...args) => {
				try
				{
					return callback(...args);
				}
				catch(error)
				{
					if(error instanceof ExitSignal)
					{
						exitSignal = error;
						return;
					}
					else
					{
						throw error;
					}
				}
			});
			if(exitSignal != null)
			{
				throw exitSignal;
			}
			return retVal;
		}

		static resolve(...args)
		{
			return new ProcPromise((resolve, reject) => {
				resolve(...args);
			});
		}

		static reject(...args)
		{
			return new ProcPromise((resolve, reject) => {
				reject(...args);
			});
		}

		static all(promises)
		{
			let exitSignal = null;
			var promise = new ProcPromise((resolve, reject) => {
				Promise.all(promises).then((...args) => {
					try
					{
						return resolve(...args);
					}
					catch(error)
					{
						if(error instanceof ExitSignal)
						{
							exitSignal = error;
							return;
						}
						else
						{
							throw error;
						}
					}
				}).catch((...args) => {
					try
					{
						return resolve(...args);
					}
					catch(error)
					{
						if(error instanceof ExitSignal)
						{
							exitSignal = error;
							return;
						}
						else
						{
							throw error;
						}
					}
				});
			});
			if(exitSignal != null)
			{
				throw exitSignal;
			}
			return promise;
		}
	}


	// Filesystem class
	function Filesystem(kernel, storage)
	{
		const fsMetaPrefix = osName+'/fs-meta:';
		const fsPrefix = osName+'/fs:';

		const invalidPathCharacters = [':'];

		// get path of directory containing path
		function dirname(context, path)
		{
			if(typeof path !== 'string')
			{
				throw new TypeError("path must be a string");
			}

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
			if(typeof path !== 'string')
			{
				throw new TypeError("path must be a string");
			}
			
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

		// get extension name of path
		function extname(context, path)
		{
			var lastDotIndex = path.lastIndexOf('.');
			if(lastDotIndex === -1)
			{
				return '';
			}
			var extension = path.substring(lastDotIndex, path.length);
			if(extension.indexOf('/') !== -1)
			{
				return '';
			}
			return extension;
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
			else if(typeof cwd !== 'string')
			{
				throw new Error("cwd must be a string");
			}

			// ensure string
			if(typeof path !== 'string')
			{
				throw new Error("path must be a string");
			}

			// check for invalid characters
			for(const invalidChar of invalidPathCharacters)
			{
				if(path.indexOf(invalidChar) !== -1)
				{
					throw new Error("invalid character in path");
				}
			}

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

		// download a file to a given path
		function downloadFile(context, url, path)
		{
			const downloadPath = resolvePath(context, path);

			return new ProcPromise((resolve, reject) => {
				// create request to retrieve remote file
				var xhr = new XMLHttpRequest();
				xhr.onreadystatechange = () => {
					if(xhr.readyState == 4)
					{
						// handle result
						if(xhr.status == 200)
						{
							// attempt to write file to filesystem
							try
							{
								var content = xhr.responseText;
								writeFile(context, downloadPath, content);
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
							var errorMessage = "request failed";
							if(xhr.status > 0)
							{
								errorMessage += " with status "+xhr.status;
								if(xhr.statusText.length > 0)
								{
									errorMessage += ": "+xhr.statusText;
								}
							}
							reject(new Error(errorMessage));
						}
					}
				};

				// send remote file request
				xhr.open("GET", url);
				xhr.send();
			});
		}

		// determine the interpreter for the file
		function getInterpreter(context, path)
		{
			const fullPath = resolvePath(context, path);
			if(fullPath.endsWith('.raw.js'))
			{
				return undefined;
			}
			return 'babel';
		}

		// execute a js script at a given path
		function executeFile(context, path, args=[], options=null)
		{
			return new ChildProcess(kernel, context, path, args, options);
		}

		// load a js script into the current process
		function requireFile(context, scope, path)
		{
			const data = kernel.filesystem.readFile(context, path);
			const interpreter = getInterpreter(context, path);
			return runScript(kernel, interpreter, scope, data);
		}

		// create empty filesystem, if necessary
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
		this.extname = extname;
		this.resolvePath = resolvePath;
		this.exists = exists;
		this.readMeta = readMeta;
		this.readDir = readDir;
		this.createDir = createDir;
		this.readFile = readFile;
		this.writeFile = writeFile;
		this.downloadFile = downloadFile;
		this.executeFile = executeFile;
		this.requireFile = requireFile;
	}



	let pidCounter = 1;
	
	function ChildProcess(kernel, parentContext, path, args, options)
	{
		if(typeof path !== 'string')
		{
			throw new TypeError("path must be a string");
		}
		if(!(args instanceof Array))
		{
			throw new TypeError("args must be an Array");
		}
		options = Object.assign({}, options);

		const pid = pidCounter;
		pidCounter++;

		const context = deepCopyObject(parentContext);
		context.pid = pid;
		context.argv = [path].concat(args);

		const dir = kernel.filesystem.dirname(parentContext, path);
		const fullPath = kernel.filesystem.resolvePath(parentContext, path);

		let executed = false;
		let resolved = false;
		let exited = false;
		let ended = false;

		// build process scope
		let scope = {
			syscall: (func, ...args) => {
				return kernel.syscall(context, func, ...args);
			},
			require: (path) => {
				return kernel.require(context, scope, dir, path);
			},
			__dirname: dir,
			__filename: fullPath,
			module: {exports:{}},
			Promise: ProcPromise
		};

		scope.require.resolve = (path) => {
			// get full module path
			return findRequirePath(kernel, context, dir, path);
		};

		// define Process object
		scope.process = new (function(){

			Object.defineProperty(this, 'argv', {
				value: context.argv.slice(0),
				writable: false
			});
			
			Object.defineProperty(this, 'cwd', {
				value: () => {
					return context.cwd;
				},
				writable: false
			});

			Object.defineProperty(this, 'env', {
				get: () => {
					return context.env;
				},
				set: (value) => {
					context.env = value;
				}
			});

			Object.defineProperty(this, 'exit', {
				value: (code) => {
					if(code == null)
					{
						code = 0;
					}
					if(exited)
					{
						throw new Error("already gave exit code for this process");
					}
					exited = true;
					kernel.log(context, "exiting process "+pid);
					var exitSignal = new ExitSignal(code);
					if(!resolved)
					{
						if(code != 0)
						{
							context.reject(exitSignal);
						}
						else
						{
							context.resolve();
						}
					}
					throw exitSignal;
				},
				writable: false
			});

			Object.defineProperty(this, 'pid', {
				get: () => {
					return context.pid;
				}
			});

			Object.defineProperty(this, 'ppid', {
				get: () => {
					return parentContext.pid;
				}
			});

			Object.defineProperty(this, 'platform', {
				value: 'finkeos',
				writable: false
			});
		})();


		// process lifecycle functions

		function endProcess()
		{
			if(!ended)
			{
				ended = true;
				unloadRequired(kernel, context);
			}
		}

		function execute()
		{
			if(executed)
			{
				throw new Error("process already executed");
			}
			executed = true;

			return new ProcPromise((resolve, reject) => {
				context.resolve = (...args) => {
					if(resolved)
					{
						throw new Error("the process has already been resolved or rejected");
					}
					resolved = true;
					endProcess();
					resolve(...args);
				};

				context.reject = (...args) => {
					if(resolved)
					{
						throw new Error("the process has already been resolved or rejected");
					}
					resolved = true;
					endProcess();
					reject(...args);
				};

				try
				{
					kernel.filesystem.requireFile(context, scope, path);
				}
				catch(error)
				{
					if(error instanceof ExitSignal)
					{
						// process has ended
					}
					else
					{
						if(!ended)
						{
							context.reject(error);
						}
						else
						{
							// just ignore...
						}
					}
				}
			});
		}


		// start process

		this.promise = execute();
	}




	let loadedModules = {};
	let sharedModules = {};

	// check if a given path is a folder
	function checkIfFolder(kernel, context, path)
	{
		var meta = kernel.filesystem.readMeta(context, path);
		if(meta.type === 'dir')
		{
			return true;
		}
		return false;
	}

	// resolve a module's main js file from a folder
	function resolveModuleFolder(kernel, context, path)
	{
		var packagePath = path+'/package.json';
		if(!kernel.filesystem.exists(context, packagePath))
		{
			return null;
		}

		var packageInfo = JSON.parse(kernel.filesystem.readFile(context, packagePath));
		var mainFile = packageInfo["main"];
		if(!mainFile)
		{
			throw new Error("no main file specified");
		}

		if(typeof mainFile !== 'string')
		{
			throw new TypeError("\"main\" must be a string");
		}

		if(mainFile.startsWith('/'))
		{
			return mainFile;
		}
		return kernel.filesystem.resolvePath(context, path+'/'+mainFile);
	}

	// find a valid module path from the given context, base path, and path
	function resolveModulePath(kernel, context, basePath, path, options=null)
	{
		options = Object.assign({}, options);

		var modulePath = null;
		try
		{
			modulePath = kernel.filesystem.resolvePath(context, path, basePath);
		}
		catch(error)
		{
			throw new Error("unable to resolve module path");
		}
		
		// find full module path
		var fullModulePath = modulePath;
		if(kernel.filesystem.exists(context, fullModulePath))
		{
			if(checkIfFolder(kernel, context, fullModulePath))
			{
				fullModulePath = resolveModuleFolder(kernel, context, fullModulePath);
				if(fullModulePath != null)
				{
					return fullModulePath;
				}
			}
			else
			{
				return fullModulePath;
			}
		}
		fullModulePath = modulePath + '.js';
		if(kernel.filesystem.exists(context, fullModulePath) && !checkIfFolder(kernel, context, fullModulePath))
		{
			return fullModulePath;
		}
		fullModulePath = modulePath + '.raw.js';
		if(kernel.filesystem.exists(context, fullModulePath) && !checkIfFolder(kernel, context, fullModulePath))
		{
			return fullModulePath;
		}
		if(options.folderExtensions)
		{
			for(const extension of options.folderExtensions)
			{
				fullModulePath = modulePath + '.' + extension;
				if(kernel.filesystem.exists(context, fullModulePath) && checkIfFolder(kernel, context, fullModulePath))
				{
					fullModulePath = resolveModuleFolder(kernel, context, fullModulePath);
					if(fullModulePath != null)
					{
						return fullModulePath;
					}
				}
			}
		}
		
		throw new Error("module not found");
	}
	
	// find a valid module path from the given context, base paths, and path
	function findModulePath(kernel, context, basePaths, dir, path, options=null)
	{
		options = Object.assign({}, options);

		var modulePath = null;
		if(path.startsWith('/') || path.startsWith('./') || path.startsWith('../'))
		{
			try
			{
				modulePath = resolveModulePath(kernel, context, dir, path, options);
			}
			catch(error)
			{
				throw new Error("could not resolve module: "+error.message);
			}
		}
		else
		{
			if(!basePaths)
			{
				basePaths = [];
			}
			for(const basePath of basePaths)
			{
				try
				{
					modulePath = resolveModulePath(kernel, context, basePath, path, options);
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
		return modulePath;
	}

	// execute a module in a new context
	function execute(kernel, context, path, args=[], options=null)
	{
		// get full module path
		var paths = [];
		if(context.env && context.env.paths)
		{
			paths = context.env.paths;
		}
		var modulePath = findModulePath(kernel, context, paths, context.cwd, path, {folderExtensions: ['exe']});

		return kernel.filesystem.executeFile(context, modulePath, args, options);
	}

	// find the path to a required module
	function findRequirePath(kernel, context, dir, path)
	{
		// get full module path
		var libpaths = [];
		if(context.env && context.env.libpaths)
		{
			libpaths = context.env.libpaths;
		}
		return findModulePath(kernel, context, libpaths, dir, path, {folderExtensions: ['dll']});
	}

	// load a module into the current context
	function require(kernel, context, parentScope, dir, path)
	{
		// get full module path
		var modulePath = findRequirePath(kernel, context, dir, path);

		// add empty modules object for context if necessary
		if(!loadedModules[context.pid])
		{
			loadedModules[context.pid] = {};
		}

		// use shared container if library is in /system/slib
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

		// get parent directory of module path
		const pathDir = kernel.filesystem.dirname(context, modulePath);

		// create module scope
		var scope = Object.assign({}, parentScope);
		scope.require = (path) => {
			return require(kernel, moduleContext, scope, pathDir, path);
		};
		scope.__dirname = pathDir;
		scope.module = { exports: {} };

		// require file
		kernel.filesystem.requireFile(moduleContext, scope, modulePath);

		// save exported module
		moduleContainer[modulePath] = scope.module.exports;

		// return exported module
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

			case 'execute':
				if(funcParts[1] != null)
				{
					throw new Error("invalid system call");
				}
				return kernel.execute(context, ...args);
				
			case 'log':
				if(funcParts[1] != null)
				{
					throw new Error("invalid system call");
				}
				return kernel.log(context, ...args);

			case 'logs':
				if(funcParts[1] != null)
				{
					throw new Error("invalid system call");
				}
				return kernel.logs(context);

			default:
				throw new Error("invalid system call");
		}
	}



	function log(kernel, context, message, options)
	{
		options = Object.assign({}, options);

		var kernelElement = document.getElementById("kernel");

		const logElement = document.createElement("DIV");
		logElement.textContent = message;
		logElement.style.color = options.color;

		kernelElement.appendChild(logElement);
		kernelElement.scrollTop = kernelElement.scrollHeight;
	}



	this.filesystem = new Filesystem(this, window.localStorage);
	this.execute = (context, path, args=[], options=null) => {
		return execute(this, context, path, args, options);
	};
	this.require = (context, scope, dir, path) => {
		return require(this, context, scope, dir, path);
	};
	this.syscall = (context, func, ...args) => {
		return syscall(this, context, func, ...args);
	};
	this.log = (context, message, options) => {
		return log(this, context, message, options);
	};
// end kernel class
}

// create boot sandbox
(function(){
	// start kernel
	var kernel = new Kernel();

	kernel.log(rootContext, "downloading boot data...");

	// create system folders
	const dirOptions = {ignoreIfExists: true};
	kernel.filesystem.createDir(rootContext, '/system', dirOptions);
	kernel.filesystem.createDir(rootContext, '/system/bin', dirOptions);
	kernel.filesystem.createDir(rootContext, '/system/lib', dirOptions);
	kernel.filesystem.createDir(rootContext, '/system/slib', dirOptions);
	kernel.filesystem.createDir(rootContext, '/system/share', dirOptions);

	// download system files
	const downloads = [];
	downloads.push( kernel.filesystem.downloadFile(rootContext, 'https://cdnjs.cloudflare.com/ajax/libs/react/15.4.2/react.js', '/system/slib/react.raw.js') );
	downloads.push( kernel.filesystem.downloadFile(rootContext, 'https://cdnjs.cloudflare.com/ajax/libs/react/15.4.2/react-dom.js', '/system/slib/react-dom.raw.js') );
	downloads.push( kernel.filesystem.downloadFile(rootContext, 'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/6.21.1/babel.js', '/system/slib/babel.raw.js') );
	downloads.push( kernel.filesystem.downloadFile(rootContext, 'system/boot.js?v='+(Math.random()*9999999999), '/system/boot.js'));

	// wait for files to finish downloading
	Promise.all(downloads).then(() => {
		kernel.log(rootContext, "boot data downloaded; booting...");
		kernel.execute(rootContext, '/system/boot');
	}).catch((error) => {
		kernel.log(rootContext, "fatal error", {color: 'red'});
		kernel.log(rootContext, error.toString(), {color: 'red'});
	});
// end boot sandbox
})();

// end kernel sandbox
})();

// end window 'load' event listener
});
