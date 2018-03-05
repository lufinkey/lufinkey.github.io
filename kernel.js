
window.localStorage.clear();

// wait for window load to create kernel
window.addEventListener('load', () => {

// function to evaluate a given script
function evalScript(__scope, __code) {
	return (function(){
		const evalScript = undefined;
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
	switch(typeof object)
	{
		case 'object':
			if(object === null)
			{
				return null;
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
				for(const key of Object.keys(object))
				{
					newObject[key] = deepCopyObject(object[key]);
				}
				return newObject;
			}

		case 'number':
			return 0+object;

		case 'string':
			return ''+object;
		
		default:
			return object;
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
	},

	valid: true,
	timeouts: [],
	intervals: []
};


// class to allow aliasing select globals to itself when evaluating a script
function ScriptGlobalAlias(aliases)
{
	this.aliases = aliases;
}


// validate a scope variable name
function validateVariableName(varName)
{
	if(typeof varName !== 'string')
	{
		throw new TypeError("variable name must be a string");
	}
	// ensure string isn't empty
	if(varName.length == 0)
	{
		throw new Error("empty string cannot be variable name");
	}
	// ensure all characters are valid
	for(const char of varName)
	{
		if(validScopeCharacters.indexOf(char) === -1)
		{
			throw new Error("invalid scope variable name "+varName);
		}
	}
	// ensure name doesn't start with a number
	if("1234567890".indexOf(varName[0]) !== -1)
	{
		throw new Error("variable name cannot start with a number");
	}
}


// run a script with a given interpreter
const validScopeCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890_$';
function runScript(kernel, interpreter, scope, code)
{
	switch(interpreter)
	{
		case 'jsx':
			const Babel = kernel.require(rootContext, scope, '/', 'babel');
			code = Babel.transform(code, {presets:['react']}).code;
			break;

		case null:
		case undefined:
			break;

		default:
			throw new Error("invalid interpreter");
	}
	// TODO parse a little bit to check if strict mode is enabled
	// create strings for global scope variables
	var prefixString = '';
	var suffixString = '';
	for(const varName in scope)
	{
		validateVariableName(varName);
		if(scope[varName] instanceof ScriptGlobalAlias)
		{
			var aliases = scope[varName].aliases;
			prefixString += 'let '+varName+' = Object.defineProperties({}, { ';
			for(var i=0; i<aliases.length; i++)
			{
				const alias = aliases[i];
				validateVariableName(alias);
				prefixString += '"'+alias+'": {';
				prefixString += 'get:() => { return '+alias+'; },set:(___val) => { '+alias+' = ___val; }';
				prefixString += '}';
				if(i < (aliases.length-1))
				{
					prefixString += ',';
				}
			}
			prefixString += '});\n';
		}
		else
		{
			prefixString += 'let '+varName+' = __scope.'+varName+';\n';
			suffixString += '__scope.'+varName+' = '+varName+';\n';
		}
	}
	// evaluate the script
	return evalScript(scope, prefixString+'\n'+code+'\n'+suffixString);
}


// Kernel class
function Kernel()
{
	const osName = 'finkeos';


	// exception for process exit signal
	class ExitSignal extends Error
	{
		constructor(exitCode, message)
		{
			if(typeof exitCode === 'string')
			{
				message = exitCode;
				exitCode = null;
			}
			
			if(!message && exitCode)
			{
				message = "process exited with signal "+exitCode;
			}
			super(message);
			this.exitCode = exitCode;
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
					callback((...args) => {
						resolve(...args);
					}, (...args) => {
						reject(...args);
					});
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

		then(callback, ...args)
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
			}, ...args);
			if(exitSignal != null)
			{
				throw exitSignal;
			}
			return retVal;
		}

		catch(callback, ...args)
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
			}, ...args);
			if(exitSignal != null)
			{
				throw exitSignal;
			}
			return retVal;
		}

		finally(callback, ...args)
		{
			let exitSignal = null;
			var retVal = super.finally((...args) => {
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
			}, ...args);
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
						return reject(...args);
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


		// validate a path
		function validatePath(context, path)
		{
			// ensure string
			if(typeof path !== 'string')
			{
				throw new TypeError("path must be a string");
			}

			// check for invalid characters
			for(const invalidChar of invalidPathCharacters)
			{
				if(path.indexOf(invalidChar) !== -1)
				{
					throw new Error("invalid character in path");
				}
			}
		}


		// normalize a path
		function normalizePath(context, path)
		{
			if(typeof path !== 'string')
			{
				throw new TypeError("path must be a string");
			}

			// check if absolute
			var absolute = false;
			if(path.startsWith('/'))
			{
				absolute = true;
			}

			// split path into parts and remove empty parts
			var pathParts = path.split('/');
			for(var i=0; i<pathParts.length; i++)
			{
				if(pathParts[i] === "")
				{
					pathParts.splice(i, 1);
					i--;
				}
			}

			// determine base directory
			var baseDir = null;
			if(absolute)
			{
				baseDir = '/';
			}
			else
			{
				baseDir = '.';
			}

			// return base directory if empty path
			if(pathParts.length === 0)
			{
				return baseDir;
			}

			// function to resolve the path resursively
			function resolvePathParts(pathParts, base)
			{
				if(pathParts.length === 0)
				{
					return base;
				}

				if(pathParts[0] == '.')
				{
					return resolvePathParts(pathParts.slice(1), base);
				}
				else if(pathParts[0] == '..')
				{
					var baseDir = dirname(context, base);
					return resolvePathParts(pathParts.slice(1), baseDir);
				}
				var nextBase = null;
				if(base === '/')
				{
					nextBase = '/'+pathParts[0];
				}
				else
				{
					nextBase = base+'/'+pathParts[0];
				}
				return resolvePathParts(pathParts.slice(1), nextBase);
			}

			// resolve the path
			var resolvedPath = resolvePathParts(pathParts, baseDir);
			// remove relative base if it exists
			if(resolvedPath.startsWith('./'))
			{
				resolvedPath = resolvedPath.substring(2, resolvedPath.length);
				if(resolvedPath == '')
				{
					return '.';
				}
			}
			return resolvedPath;
		}


		// get path of directory containing path
		function dirname(context, path)
		{
			// normalize the path
			path = normalizePath(context, path);

			// determine if path is absolute
			var absolute = false;
			if(path.startsWith('/'))
			{
				absolute = true;
			}

			// split path into parts and remove empty parts
			var pathParts = path.split('/');
			for(var i=0; i<pathParts.length; i++)
			{
				if(pathParts[i] === "")
				{
					pathParts.splice(i, 1);
					i--;
				}
			}
			// trim the last entry
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
			// normalize the path
			path = normalizePath(context, path);
			
			// split path into parts and remove empty parts
			var pathParts = path.split('/');
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

			// return last path part
			return pathParts[pathParts.length-1];
		}


		// get extension name of path
		function extname(context, path)
		{
			// normalize the path
			path = normalizePath(context, path);

			// find last decimal
			var lastDotIndex = path.lastIndexOf('.');
			if(lastDotIndex === -1)
			{
				return '';
			}

			// ensure the last dot index comes after the last slash
			var extension = path.substring(lastDotIndex, path.length);
			if(extension.indexOf('/') !== -1)
			{
				return '';
			}
			
			// return the file extension
			return extension;
		}


		// concatenate two paths
		function concatPaths(context, path1, path2)
		{
			if(typeof path1 !== 'string' || typeof path2 !== 'string')
			{
				throw new TypeError("paths must be strings");
			}
			if(path1.length === 0)
			{
				if(path2.length === 0)
				{
					return '.';
				}
				return normalizePath(context, path2);
			}
			return normalizePath(context, path1+'/'+path2);
		}


		// resolve relative path from current or given cwd
		function resolvePath(context, path, cwd)
		{
			if(typeof path !== 'string')
			{
				throw new TypeError("path must be a string");
			}
			
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
				throw new TypeError("cwd must be a string");
			}

			// return normalized path if it's absolute
			if(path.startsWith('/'))
			{
				return normalizePath(context, path);
			}

			// concatenate path with cwd
			return concatPaths(context, cwd, path);
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
			validatePath(context, path);
			
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

			// add entry to parent directory contents, if not already added
			var entryName = basename(context, path);
			if(dirData.indexOf(entryName) === -1)
			{
				// add entry to parent directory
				dirData.push(entryName);
				// update parent dir entry meta info
				dirMeta.dateUpdated = new Date().getTime();
			}

			// write meta + data
			storage.setItem(fsPrefix+path, data);
			storage.setItem(fsMetaPrefix+path, JSON.stringify(newMeta));
			// write parent dir meta + parent dir data
			storage.setItem(fsPrefix+dirPath, JSON.stringify(dirData));
			storage.setItem(fsMetaPrefix+dirPath, JSON.stringify(dirMeta));
		}


		// remove an entry
		function removeEntry(context, path)
		{
			path = resolvePath(context, path);
			validatePath(context, path);

			// get info about parent directory
			if(path !== '/')
			{
				var dirPath = dirname(context, path);
				var dirData = readDir(context, dirPath);
				var dirMeta = readMeta(context, dirPath);

				const baseName = basename(context, path);
				var index = dirData.indexOf(baseName);
				if(index !== -1)
				{
					// remove from parent directory
					dirData.splice(index, 1);
					// update parent dir entry meta info
					dirMeta.dateUpdated = new Date().getTime();
				}

				// write parent directory meta / data
				storage.setItem(fsPrefix+dirPath, JSON.stringify(dirData));
				storage.setItem(fsMetaPrefix+dirPath, JSON.stringify(dirMeta));
			}

			// remove entry meta / data
			storage.removeItem(fsMetaPrefix+path);
			storage.removeItem(fsPrefix+path);
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


		// delete a directory
		function deleteDir(context, path)
		{
			path = resolvePath(context, path);
			if(!exists(context, path))
			{
				return;
			}
			const dirData = readDir(context, path);
			if(dirData.length > 0)
			{
				throw new Error("directory is not empty");
			}
			removeEntry(context, path);
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
			path = resolvePath(context, path);
			if(exists(context, path))
			{
				var meta = readMeta(context, path);
				if(meta.type !== 'file')
				{
					throw new Error("cannot write to a directory");
				}
			}
			return writeEntry(context, path, {type: 'file'}, data);
		}


		// download a file to a given path
		function downloadFile(context, url, path, options)
		{
			options = Object.assign({}, options);
			path = resolvePath(context, path);

			if(options.onlyIfMissing)
			{
				if(exists(context, path))
				{
					return ProcPromise.resolve();
				}
			}

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
								writeFile(context, path, content);
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
			path = resolvePath(context, path);
			if(path.endsWith('.jsx'))
			{
				return 'jsx';
			}
			return undefined;
		}


		// execute a js script at a given path
		function executeFile(context, path, args=[], options=null)
		{
			return new ChildProcess(kernel, context, path, args, options);
		}


		// load a js script into the current process
		function requireFile(context, scope, path)
		{
			path = resolvePath(context, path);
			const data = kernel.filesystem.readFile(context, path);
			const interpreter = getInterpreter(context, path);
			return runScript(kernel, interpreter, scope, data);
		}


		// delete a file
		function deleteFile(context, path)
		{
			path = resolvePath(context, path);
			if(!exists(context, path))
			{
				return;
			}
			const meta = readMeta(context, fullPath);
			if(meta.type !== 'file')
			{
				throw new Error("path is not a file");
			}
			removeEntry(context, path);
		}


		// rename a file or folder
		function rename(context, oldPath, newPath)
		{
			const fullOldPath = resolvePath(context, oldPath);
			const fullNewPath = resolvePath(context, oldPath);

			if(!exists(context, fullOldPath))
			{
				throw new Error("source path does not exist");
			}
			const meta = readMeta(context, fullOldPath);

			// stop if source and destination paths are the same
			if(fullOldPath === fullNewPath)
			{
				return;
			}

			// check if destination exists
			let destMeta = null;
			if(exists(context, fullNewPath))
			{
				// ensure we can rename to the destination
				destMeta = readMeta(context, fullNewPath);
				if(meta.type === 'dir' && destMeta.type === 'file')
				{
					throw new Error("not a directory");
				}
				else if(meta.type === 'file' && destMeta.type === 'dir')
				{
					throw new Error("illegal operation on a directory");
				}
			}

			if(meta.type === 'dir')
			{
				// create empty directory if one doesn't exist
				if(destMeta === null)
				{
					destMeta = Object.assign({}, meta);
					writeEntry(context, fullNewPath, destMeta, JSON.stringify('[]'));
				}

				// move contents of old directory into new directory
				const dirEntries = readDir(context, path);
				for(const entryName of dirEntries)
				{
					rename(context, fullOldPath+'/'+entryName, fullNewPath+'/'+entryName);
				}

				// delete old directory
				removeEntry(context, fullOldPath);
			}
			else
			{
				// get source file data
				const data = readFile(context, fullOldPath);

				// remove old file entry and write new one
				removeEntry(context, fullOldPath);
				writeEntry(context, fullNewPath, meta, data);
			}
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
		this.validatePath = validatePath;
		this.normalizePath = normalizePath;
		this.dirname = dirname;
		this.basename = basename;
		this.extname = extname;
		this.concatPaths = concatPaths;
		this.resolvePath = resolvePath;
		this.exists = exists;
		this.readMeta = readMeta;
		this.readDir = readDir;
		this.createDir = createDir;
		this.deleteDir = deleteDir;
		this.readFile = readFile;
		this.writeFile = writeFile;
		this.downloadFile = downloadFile;
		this.executeFile = executeFile;
		this.requireFile = requireFile;
		this.deleteFile = deleteFile;
		this.rename = rename;
	}



	
	function createTwoWayStream(kernel, context)
	{
		const EventEmitter = kernel.require(context, {}, '/', 'events');

		let ended = false;

		let input = new EventEmitter();
		let output = new EventEmitter();


		// input stream

		input.write = (chunk, encoding=null, callback=null) => {
			if(ended)
			{
				throw new Error("tried to write input after writable has finished");
			}
			output.emit('data', chunk);
			if(callback)
			{
				callback();
			}
		};

		input.end = (chunk, encoding, callback) => {
			if(ended)
			{
				return;
			}

			if(typeof chunk == 'function')
			{
				callback = chunk;
				chunk = null;
			}
			else if(typeof encoding == 'function')
			{
				callback = encoding;
				encoding = null;
			}

			if(chunk)
			{
				input.write(chunk, encoding);
			}
			input.destroy();
			if(callback)
			{
				callback();
			}
			input.emit('finish');
		}

		input.destroy = (error=null) => {
			if(ended)
			{
				return;
			}
			ended = true;

			if(error)
			{
				output.emit('error', error);
			}
			output.emit('end');
			output.emit('close');
		};


		return {
			input: input,
			output: output
		};
	}



	let pidCounter = 1;
	
	function ChildProcess(kernel, parentContext, path, args, options)
	{
		const fullPath = kernel.filesystem.resolvePath(parentContext, path);
		if(!kernel.filesystem.exists(parentContext, fullPath))
		{
			throw new Error("file does not exist");
		}
		const meta = kernel.filesystem.readMeta(parentContext, fullPath);
		if(meta.type !== 'file')
		{
			throw new Error("path is not a file");
		}
		
		if(!(args instanceof Array))
		{
			throw new TypeError("args must be an Array");
		}
		options = Object.assign({}, options);

		// get new process PID
		const pid = pidCounter;
		pidCounter++;

		const context = deepCopyObject(parentContext);
		context.pid = pid;
		context.valid = true;

		const dir = kernel.filesystem.dirname(parentContext, fullPath);

		let executed = false;
		let exited = false;
		let exiting = false;
		var argv0 = path;

		// validate options
		if(options.cwd)
		{
			if(typeof options.cwd !== 'string')
			{
				throw new TypeError("options.cwd must be a string");
			}
			if(!exists(context, options.cwd))
			{
				throw new Error("cwd does not exist");
			}
			else if(readMeta(context, cwd).type === 'file')
			{
				throw new Error("cwd must be a directory");
			}
			context.cwd = ''+options.cwd;
		}
		if(options.env)
		{
			if(typeof options.env !== 'object')
			{
				throw new TypeError("options.env must be an object")
			}
			context.env = Object.assign(context.env, deepCopyObject(options.env));
		}
		if(options.argv0)
		{
			if(typeof options.argv0 !== 'string')
			{
				throw new TypeError("options.argv0 must be a string");
			}
			argv0 = options.argv0;
		}

		// build streams
		const stdin = createTwoWayStream(kernel, context);
		const stdout = createTwoWayStream(kernel, context);
		const stderr = createTwoWayStream(kernel, context);

		// apply options
		context.argv = [argv0].concat(args);

		// build process scope
		let exports = null;
		let scope = {
			syscall: (func, ...args) => {
				return kernel.syscall(context, func, ...args);
			},
			require: (path) => {
				return kernel.require(context, scope, dir, path);
			},
			requireCSS: (path) => {
				return kernel.requireCSS(context, dir, path);
			},
			__dirname: dir,
			__filename: fullPath,
			exports: {},
			module: new ScriptGlobalAlias(['exports']),

			ExitSignal: ExitSignal,
			Promise: ProcPromise,
			setTimeout: (...args) => {
				return kernel.setTimeout(context, ...args);
			},
			clearTimeout: (...args) => {
				return kernel.clearTimeout(context, ...args);
			},
			setInterval: (...args) => {
				return kernel.setInterval(context, ...args);
			},
			clearInterval: (...args) => {
				return kernel.clearInterval(context, ...args);
			},
			console: Object.assign(Object.assign({}, console), {
				log: (...args) => {
					var strings = [];
					for(const arg of args)
					{
						strings.push(''+arg);
					}
					var stringVal = strings.join(' ');

					stdout.input.write(stringVal+'\n');
					console.log(...args);
				},
				warn: (...args) => {
					var strings = [];
					for(const arg of args)
					{
						if(arg instanceof Error)
						{
							strings.push(''+arg.stack);
						}
						else
						{
							strings.push(''+arg);
						}
					}
					var stringVal = strings.join(' ');

					stderr.input.write(stringVal+'\n');
					console.warn(...args);
				},
				error: (...args) => {
					var strings = [];
					for(const arg of args)
					{
						if(arg instanceof Error)
						{
							strings.push(''+arg.stack);
						}
						else
						{
							strings.push(''+arg);
						}
					}
					var stringVal = strings.join(' ');

					stderr.input.write(stringVal+'\n');
					console.error(...args);
				}
			})
		};
		scope.require.resolve = (path) => {
			return findRequirePath(kernel, context, dir, path);
		};
		scope.requireCSS.resolve = (path) => {
			return resolveCSSPath(kernel, context, dir, path);
		};
		scope.requireCSS.wait = (path, callback) => {
			return waitForCSS(kernel, context, dir, path, callback);
		};
		scope.requireCSS.ready = (path) => {
			return isCSSReady(kernel, context, dir, path);
		};

		// define Process object
		const EventEmitter = kernel.require(context, {}, '/', 'events');
		let process = new EventEmitter();
		(function(){
			let procArgv = context.argv.slice(0);
			Object.defineProperties(this, {
				'argv': {
					value: procArgv
				},
				'chdir': {
					value: (path) => {
						path = kernel.filesystem.resolvePath(context, path);
						var meta = kernel.filesystem.readMeta(context, path);
						if(meta.type !== 'dir')
						{
							throw new Error("path is not a directory");
						}
						context.cwd = path;
					},
				},
				'cwd': {
					value: () => {
						return context.cwd;
					}
				},
				'env': {
					get: () => {
						return context.env;
					},
					set: (value) => {
						context.env = value;
					}
				},
				'exit': {
					value: (code) => {
						if(code == null)
						{
							code = 0;
						}
						if(typeof code !== 'number' || !Number.isInteger(code) || code < 0)
						{
							throw new Error("invalid exit code");
						}
						if(exited || exiting)
						{
							throw new Error("cannot exit process more than once");
						}
						// call exit event
						exiting = true;
						process.emit('exit', exitCode);
						// end process
						if(code != 0)
						{
							var error = new Error("process exited with code "+code);
							error.exitCode = code;
							context.reject(error);
						}
						else
						{
							context.resolve();
						}
						// throw exit signal
						var exitSignal = new ExitSignal(code);
						throw exitSignal;
					}
				},
				'pid': {
					get: () => {
						return context.pid;
					}
				},
				'ppid': {
					get: () => {
						return parentContext.pid;
					}
				},
				'platform': {
					get: () => {
						return osName;
					}
				}
			});

			this.stdin = stdin.output;
			this.stdout = stdout.input;
			this.stderr = stderr.input;
		}).bind(process)();
		scope.process = process;

		// process lifecycle functions

		function endProcess()
		{
			if(!exited)
			{
				exited = true;
				context.valid = false;

				// unload required modules
				unloadRequired(kernel, context);

				// destroy timeouts and intervals
				for(const interval of context.intervals)
				{
					clearInterval(interval);
				}
				context.intervals = [];
				for(const timeout of context.timeouts)
				{
					clearTimeout(timeout);
				}
				context.timeouts = [];

				// close I/O streams
				stdin.input.end();
				stdout.input.end();
				stderr.input.end();
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
					endProcess(0);
					resolve(...args);
				};

				context.reject = (...args) => {
					endProcess();
					reject(...args);
				};

				// run process
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
						if(!exited)
						{
							console.error("unhandled process error:", error);
							context.reject(error);
						}
						else
						{
							// just ignore...
						}
					}
					return;
				}
			});
		}

		Object.defineProperty(this, 'pid', {
			get: () => {
				return pid;
			}
		});

		// build properties
		this.stdin = stdin.input;
		this.stdout = stdout.output;
		this.stderr = stderr.output;

		// start process
		this.promise = new ProcPromise((resolve, reject) => {
			setTimeout(() => {
				if(!parentContext.valid)
				{
					return;
				}

				execute().then((...args) => {
					resolve(...args);
				}).catch((...args) => {
					reject(...args);
				});
			}, 0);
		});
	}




	let loadedModules = {};
	let loadedCSS = {};
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
		return kernel.filesystem.concatPaths(context, path, mainFile);
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
		fullModulePath = modulePath + '.jsx';
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
	function execute(kernel, context, command, args=[], options=null)
	{
		if(!(args instanceof Array))
		{
			throw new TypeError("args must be an array");
		}

		// get full module path
		var paths = [];
		if(context.env && context.env.paths)
		{
			paths = context.env.paths;
		}
		var modulePath = findModulePath(kernel, context, paths, context.cwd, command, {folderExtensions: ['exe']});

		// add options
		options = Object.assign({}, options);
		if(!options.argv0)
		{
			options.argv0 = command;
		}

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
		const moduleDir = kernel.filesystem.dirname(context, modulePath);

		// create module scope
		var scope = Object.assign({}, parentScope);
		scope.require = (path) => {
			return require(kernel, moduleContext, scope, moduleDir, path);
		};
		scope.require.resolve = (path) => {
			return findRequirePath(kernel, moduleContext, moduleDir, path);
		};
		scope.requireCSS = (path) => {
			return requireCSS(kernel, moduleContext, moduleDir, path);
		};
		scope.requireCSS.resolve = (path) => {
			return resolveCSSPath(kernel, moduleContext, dir, path);
		};
		scope.requireCSS.wait = (path, callback) => {
			return waitForCSS(kernel, moduleContext, dir, path, callback);
		};
		scope.requireCSS.ready = (path) => {
			return isCSSReady(kernel, moduleContext, dir, path);
		};
		scope.__dirname = moduleDir;
		scope.__filename = modulePath;
		scope.exports = {};
		scope.module = new ScriptGlobalAlias(['exports']);

		// require file
		try
		{
			kernel.filesystem.requireFile(moduleContext, scope, modulePath);
		}
		catch(error)
		{
			console.error("unable to require "+path, error);
			throw error;
		}

		// save exported module
		moduleContainer[modulePath] = scope.exports;

		// return exported module
		return scope.exports;
	}


	// resolve a required CSS file
	function resolveCSSPath(kernel, context, dir, path)
	{
		if(typeof path !== 'string')
		{
			throw new TypeError("path must be a string");
		}

		// validate path
		if(!path.startsWith('/') && !path.startsWith('./') && !path.startsWith('../'))
		{
			throw new Error("invalid path");
		}

		// resolve full path
		var cssPath = kernel.filesystem.resolvePath(context, path, dir);

		// resolve actual css file path
		var testExtensions = ['', '.css', '.scss'];
		for(const extension of testExtensions)
		{
			var testPath = cssPath+extension;
			if(kernel.filesystem.exists(context, testPath) && !checkIfFolder(kernel, context, testPath))
			{
				return cssPath;
			}
		}
		throw new Error("unable to resolve css path "+path);
	}


	// inject a CSS file into the current page
	function requireCSS(kernel, context, dir, path)
	{
		var cssPath = resolveCSSPath(kernel, context, dir, path);

		// check if css already loaded
		if(loadedCSS[cssPath])
		{
			// add process PID if necessary
			var info = loadedCSS[cssPath];
			if(info.pids.indexOf(context.pid) === -1)
			{
				info.pids.push(context.pid);
			}
			loadedCSS[cssPath] = info;
			return new Promise((resolve, reject) => {
				waitForCSS(kernel, context, dir, cssPath, () => {
					if(loadedCSS[cssPath].error)
					{
						reject(loadedCSS[cssPath].error);
						return;
					}
					resolve();
				})
			});
		}

		// read css data
		var cssData = null;
		try
		{
			cssData = kernel.filesystem.readFile(context, cssPath);
		}
		catch(error)
		{
			throw new Error("unable to read css file: "+error.message);
		}

		// TODO parse out special CSS functions

		// add style tag to page
		var head = document.querySelector('head');
		let styleTag = document.createElement("STYLE");
		styleTag.type = "text/css";
		head.appendChild(styleTag);

		// determine interpreter
		var cssPromise = null;
		var ready = false;
		if(cssPath.endsWith('.scss'))
		{
			// parse with SCSS
			var Sass = kernel.require(context, {}, '/', 'sass');
			var sass = new Sass();
			cssPromise = new Promise((resolve, reject) => {
				sass.compile(cssData, (result) => {
					// check for errors
					if(result.status !== 0)
					{
						if(styleTag.parentNode != null)
						{
							loadedCSS[cssPath].error = new Error(result.message);
							loadedCSS[cssPath].ready = true;
						}
						console.error("Error compiling scss for "+cssPath+": "+result.message);
						reject(new Error(result.message));
						return;
					}
					// apply compiled scss
					styleTag.textContent = result.text;
					// inform that we are ready
					if(styleTag.parentNode != null)
					{
						loadedCSS[cssPath].ready = true;
					}
					resolve(styleTag);
				});
			});
		}
		else
		{
			// apply plain content
			styleTag.textContent = cssData;
			ready = true;
			cssPromise = Promise.resolve(styleTag);
		}

		// save injected tag
		loadedCSS[cssPath] = {
			pids: [context.pid],
			tag: styleTag,
			ready: ready
		};

		return cssPromise;
	}

	
	// check if CSS for this context is ready
	function isCSSReady(kernel, context, dir, path=null)
	{
		if(path != null)
		{
			// check for specific CSS file
			var cssPath = null;
			try
			{
				cssPath = resolveCSSPath(kernel, context, dir, path);
			}
			catch(error)
			{
				return false;
			}

			return loadedCSS[cssPath].ready;
		}
		else
		{
			// check for all CSS files used by this context
			for(const cssPath in loadedCSS)
			{
				var info = loadedCSS[cssPath];
				if(!info.ready)
				{
					if(info.pids.indexOf(context.pid) !== -1)
					{
						return false
					}
				}
			}

			return true;
		}
	}

	
	// wait for CSS file(s) to be ready
	function waitForCSS(kernel, context, dir, path, callback)
	{
		if(typeof path == 'function')
		{
			callback = path;
			path = null;
		}

		// check if file(s) ready
		var ready = true;
		if(path instanceof Array)
		{
			for(const cssPath of path)
			{
				if(!isCSSReady(kernel, context, dir, cssPath))
				{
					ready = false;
					break;
				}
			}
		}
		else if(typeof path == 'string')
		{
			if(!isCSSReady(kernel, context, dir, path))
			{
				ready = false;
			}
		}
		else if(path != null)
		{
			throw new TypeError("path must be a string or an Array");
		}

		// finish if ready ;)
		if(ready)
		{
			callback();
			return;
		}

		// wait a little bit and try again
		kernel.setTimeout(context, () => {
			waitForCSS(kernel, context, dir, path, callback);
		}, 100);
	}

	// unload any required scripts or CSS
	function unloadRequired(kernel, context)
	{
		// delete any loaded modules for this PID
		delete loadedModules[context.pid];
		// remove PID references from loaded CSS
		for(const cssPath of Object.keys(loadedCSS))
		{
			var info = loadedCSS[cssPath];
			var pidIndex = info.pids.indexOf(context.pid);
			if(pidIndex !== -1)
			{
				info.pids.splice(pidIndex, 1);
				if(info.pids.length === 0)
				{
					// no referencing PIDs remaining. unload CSS
					info.tag.parentNode.removeChild(info.tag);
					delete loadedCSS[cssPath];
				}
			}
		}
	}


	// facilitate a kernel call
	function syscall(kernel, context, func, ...args)
	{
		if(typeof func != 'string')
		{
			throw new Error("func must be a string");
		}
		func = ''+func;

		if(!context.valid)
		{
			throw new Error("calling context is not valid");
		}

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


	// append information to the system log
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


	// build kernel object
	this.filesystem = new Filesystem(this, window.localStorage);
	this.execute = (context, path, args=[], options=null) => {
		return execute(this, context, path, args, options);
	};
	this.require = (context, scope, dir, path) => {
		return require(this, context, scope, dir, path);
	};
	this.require.resolve = (context, dir, path) => {
		return findRequirePath(this, context, dir, path);
	};
	this.requireCSS = (context, dir, path) => {
		return requireCSS(this, context, dir, path);
	};
	this.syscall = (context, func, ...args) => {
		return syscall(this, context, func, ...args);
	};
	this.log = (context, message, options) => {
		return log(this, context, message, options);
	};

	// make polyfills for standard functions

	this.setTimeout = (context, handler, ...args) => {
		if(typeof handler !== 'function')
		{
			throw new TypeError("handler must be a function");
		}

		const timeout = setTimeout((...args) => {
			var index = context.timeouts.indexOf(timeout);
			if(index !== -1)
			{
				context.timeouts.splice(index, 1);
			}
			handler(...args);
		}, ...args);

		context.timeouts.push(timeout);
		return timeout;
	};
	this.clearTimeout = (context, timeout) => {
		var index = context.timeouts.indexOf(timeout);
		if(index !== -1)
		{
			context.timeouts.splice(index, 1);
		}
		return clearTimeout(timeout);
	};

	this.setInterval = (context, handler, ...args) => {
		if(typeof handler !== 'function')
		{
			throw new TypeError("handler must be a function");
		}

		const interval = setInterval((...args) => {
			var index = context.intervals.indexOf(interval);
			if(index !== -1)
			{
				context.intervals.splice(index, 1);
			}
			handler(...args);
		}, ...args);

		context.intervals.push(interval);
		return interval;
	};
	this.clearInterval = (context, interval) => {
		var index = context.intervals.indexOf(interval);
		if(index !== -1)
		{
			context.intervals.splice(index, 1);
		}
		return clearInterval(interval);
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
	// delete and remake tmp
	kernel.filesystem.deleteDir(rootContext, '/tmp');
	kernel.filesystem.createDir(rootContext, '/tmp', dirOptions);

	// download system files
	const downloads = [];
	const downloadOptions = {onlyIfMissing: true};
	downloads.push( kernel.filesystem.downloadFile(rootContext, 'https://cdnjs.cloudflare.com/ajax/libs/react/15.4.2/react.js', '/system/slib/react.js', downloadOptions) );
	downloads.push( kernel.filesystem.downloadFile(rootContext, 'https://cdnjs.cloudflare.com/ajax/libs/react/15.4.2/react-dom.js', '/system/slib/react-dom.js', downloadOptions) );
	downloads.push( kernel.filesystem.downloadFile(rootContext, 'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/6.21.1/babel.js', '/system/slib/babel.js', downloadOptions) );
	downloads.push( kernel.filesystem.downloadFile(rootContext, 'https://cdnjs.cloudflare.com/ajax/libs/sass.js/0.10.9/sass.js', '/system/slib/sass.js', downloadOptions) );
	downloads.push( kernel.filesystem.downloadFile(rootContext, 'https://raw.githubusercontent.com/Gozala/events/master/events.js', '/system/lib/events.js', downloadOptions) );
	downloads.push( kernel.filesystem.downloadFile(rootContext, 'system/boot.jsx?v='+(Math.random()*9999999999), '/system/boot.jsx') );

	// wait for files to finish downloading
	Promise.all(downloads).then(() => {
		kernel.log(rootContext, "boot data downloaded");
		
		// download sass.worker.js to give to scss
		kernel.log(rootContext, "preparing scss...");
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = () => {
			if(xhr.readyState == 4)
			{
				if(xhr.status == 200)
				{
					// apply downloaded worker data to Sass
					var workerData = xhr.responseText;
					var workerURL = 'data:application/javascript;base64,'+btoa(workerData);
					const Sass = kernel.require(rootContext, {}, '/', 'sass');
					Sass.setWorkerUrl(workerURL);
					kernel.log(rootContext, "done preparing scss");

					// boot
					kernel.log(rootContext, "booting...");
					kernel.execute(rootContext, '/system/boot');
				}
				else
				{
					// error
					var errorMessage = "sass.worker.js download failed";
					if(xhr.status !== 0)
					{
						errorMessage += " with status "+xhr.status;
						if(xhr.statusText)
						{
							errorMessage += ": "+xhr.statusText;
						}
					}
					console.error(errorMessage);
					kernel.log(rootContext, "fatal error", {color: 'red'});
					kernel.log(rootContext, errorMessage, {color: 'red'});
				}
			}
		}
		xhr.open('GET', 'https://cdnjs.cloudflare.com/ajax/libs/sass.js/0.10.9/sass.worker.min.js');
		xhr.send();
	}).catch((error) => {
		console.error("kernel error: ", error);
		kernel.log(rootContext, "fatal error", {color: 'red'});
		kernel.log(rootContext, error.toString(), {color: 'red'});
	});
// end boot sandbox
})();

// end kernel sandbox
})();

// end window 'load' event listener
});
