

// sandbox evalScript + kernel
const Kernel = (function(){

// function to evaluate a given script
function evalJavaScript(__scope, __code) {
	// make sure Kernel and evalScript aren't defined
	const Kernel = undefined;
	const evalJavaScript = undefined;
	// sandbox script
	return (function(){
		return eval(__code);
	}).bind({})();
}



// sandbox kernel data
return (function(){

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




	// class to handle all kernel functions
	function Kernel(kernelOptions)
	{
		// clear localStorage for now
		window.localStorage.clear();

		const osName = 'finkeos';

		const tmpStorage = {};
		const storage = window.localStorage;

		let builtInsCode = null;
		let browserWrappers = null;
		let generatedModules = null;
		let loadedSharedModules = {};

		let builtInsPromise = null;

		let rootContext = null;
		let pidCounter = 1;



		// class to allow aliasing select globals to itself when evaluating a script
		function ScriptGlobalAlias(aliases)
		{
			this.aliases = aliases;
		}



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
		function ProcPromise(context, callback)
		{
			let promise = null;

			function wrapPromiseMethod(method, callback)
			{
				let exitSignal = null;
				var retVal = method((...args) => {
					if(!context.valid)
					{
						return;
					}
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
				// rethrow exit signal if there was one
				if(exitSignal != null)
				{
					throw exitSignal;
				}
				// wrap return value if necessary
				if(retVal === promise)
				{
					return this;
				}
				else if(retVal instanceof Promise)
				{
					return new ProcPromise(context, (resolve, reject) => {
						return retVal.then(resolve).catch(reject);
					});
				}
				return retVal;
			}

			// then
			this.then = (callback, ...args) => {
				if(typeof callback !== 'function')
				{
					return promise.then(callback, ...args);
				}
				wrapPromiseMethod((callback) => {
					return promise.then((...args) => {
						return callback(...args);
					});
				}, callback);
			};

			// catch
			this.catch = (callback, ...args) => {
				if(typeof callback !== 'function')
				{
					return promise.catch(callback, ...args);
				}
				wrapPromiseMethod((callback) => {
					return promise.catch((...args) => {
						return callback(...args);
					});
				}, callback);
			};

			// finally
			this.finally = (callback, ...args) => {
				if(typeof callback !== 'function')
				{
					return promise.finally(callback, ...args);
				}
				wrapPromiseMethod((callback) => {
					return promise.finally((...args) => {
						return callback(...args);
					});
				}, callback);
			};

			// perform promise
			let exitSignal = null;
			let promise = new Promise((resolve, reject) => {
				try
				{
					callback((...args) => {
						// ensure calling context is valid
						if(!context.valid)
						{
							return;
						}
						// resolve
						if(resolve)
						{
							resolve(...args);
						}
					}, (...args) => {
						// ensure calling context is valid
						if(!context.valid)
						{
							return;
						}
						// reject
						if(reject)
						{
							reject(...args);
						}
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

		ProcPromise.resolve = function(context, ...args)
		{
			return new ProcPromise(context, (resolve, reject) => {
				resolve(...args);
			});
		}
	
		ProcPromise.reject = function(context, ...args)
		{
			return new ProcPromise(context, (resolve, reject) => {
				reject(...args);
			});
		}
	
		ProcPromise.all = function(context, promises, ...args)
		{
			// wrap promises
			if(promises instanceof Array)
			{
				promises = promises.slice(0);
				for(var i=0; i<promises.length; i++)
				{
					let tmpPromise = promises[i];
					promises[i] = new Promise((resolve, reject) => {
						tmpPromise.then(resolve).catch(reject);
					});
				}
			}
			// perform promises
			return new ProcPromise(context, (resolve, reject) => {
				Promise.all(promises, ...args).then(resolve).catch(reject);
			});
		}
	
		ProcPromise.race = function(context, promises, ...args)
		{
			// wrap promises
			if(promises instanceof Array)
			{
				promises = promises.slice(0);
				for(var i=0; i<promises.length; i++)
				{
					let tmpPromise = promises[i];
					promises[i] = new Promise((resolve, reject) => {
						tmpPromise.then(resolve).catch(reject);
					});
				}
			}
			// perform promises
			return new ProcPromise(context, (resolve, reject) => {
				Promise.race(promises, ...args).then(resolve).catch(reject);
			});
		}



		// create a ProcPromise bound to a context
		function createProcPromiseClass(context)
		{
			const PromiseClass = ProcPromise.bind(ProcPromise, context);
			PromiseClass.resolve = ProcPromise.resolve.bind(PromiseClass, context);
			PromiseClass.reject = ProcPromise.reject.bind(PromiseClass, context);
			PromiseClass.all = ProcPromise.all.bind(PromiseClass, context);
			PromiseClass.race = ProcPromise.race.bind(PromiseClass, context);
			return PromiseClass;
		}



		// define contextual browser functions
		browserWrappers = {
			setTimeout: (context, handler, ...args) => {
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
			},
			clearTimeout: (context, timeout) => {
				var index = context.timeouts.indexOf(timeout);
				if(index !== -1)
				{
					context.timeouts.splice(index, 1);
				}
				return clearTimeout(timeout);
			},
			// intervals
			setInterval: (context, handler, ...args) => {
				if(typeof handler !== 'function')
				{
					throw new TypeError("handler must be a function");
				}
				const interval = setInterval((...args) => {
					handler(...args);
				}, ...args);
				context.intervals.push(interval);
				return interval;
			},
			clearInterval: (context, interval) => {
				var index = context.intervals.indexOf(interval);
				if(index !== -1)
				{
					context.intervals.splice(index, 1);
				}
				return clearInterval(interval);
			}
		};



		// create built in modules for a given context
		function createBuiltIns(context)
		{
			var scope = {
				'const': {
					setTimeout: (...args) => {
						return browserWrappers.setTimeout(context, ...args);
					},
					clearTimeout: (...args) => {
						return browserWrappers.clearTimeout(context, ...args);
					},
					setInterval: (...args) => {
						return browserWrappers.setInterval(context, ...args);
					},
					clearInterval: (...args) => {
						return browserWrappers.clearInterval(context, ...args);
					},
					Promise: createProcPromiseClass(context)
				},
				'let': {
					'require': {}
				}
			};
			runScript(context, builtInsCode, scope);
			if(typeof scope.let.require !== 'function')
			{
				throw new Error("missing require function for builtins");
			}
			return scope.let.require('node-builtin-map');
		}



		// check if a given path is a folder
		function checkIfDir(context, path)
		{
			try
			{
				var stats = context.modules.fs.statSync(path);
				if(stats.isDirectory())
				{
					return true;
				}
			}
			catch(error)
			{
				return false;
			}
			return false;
		}


		// check if a given path is a file
		function checkIfFile(context, path)
		{
			try
			{
				var stats = context.modules.fs.statSync(path);
				if(stats.isFile())
				{
					return true;
				}
			}
			catch(error)
			{
				return false;
			}
			return false;
		}


		// resolves a relative path to a full path using a given cwd or the context's cwd
		function resolveRelativePath(context, path, cwd)
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
				return context.builtIns.modules.path.normalize(path);
			}

			// concatenate path with cwd
			return context.builtIns.modules.path.join(cwd, path);
		}


		// resolve a module's main js file from a folder
		function resolveModuleFolder(context, path)
		{
			var packagePath = path+'/package.json';
			if(!checkIfFile(packagePath))
			{
				return null;
			}

			var packageInfo = JSON.parse(context.modules.fs.readFileSync(packagePath, {encoding:'utf8'}));
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
			return context.builtIns.modules.path.join(path, mainFile);
		}


		// find a valid module path from the given context, base path, and path
		function resolveModulePath(context, basePath, path, options=null)
		{
			options = Object.assign({}, options);
			var modulePath = null;
			try
			{
				modulePath = resolveRelativePath(context, path, basePath);
			}
			catch(error)
			{
				throw new Error("unable to resolve module path");
			}
			// find full module path
			var fullModulePath = modulePath;
			if(checkIfDir(context, fullModulePath))
			{
				fullModulePath = resolveModuleFolder(context, fullModulePath);
				if(fullModulePath != null)
				{
					return fullModulePath;
				}
			}
			else if(checkIfFile(context, fullModulePath))
			{
				return fullModulePath;
			}
			// check if file exists with a js extension
			fullModulePath = modulePath + '.js';
			if(checkIfFile(context, fullModulePath))
			{
				return fullModulePath;
			}
			// check file against known script extensions
			if(kernelOptions.scriptExtensions)
			{
				for(const scriptExt of kernelOptions.scriptExtensions)
				{
					fullModulePath = modulePath + '.' + scriptExt;
					if(checkIfFile(context, fullModulePath))
					{
						return fullModulePath;
					}
				}
			}
			// check file against specified folder extensions
			if(options.dirExtensions)
			{
				for(const extension of options.dirExtensions)
				{
					fullModulePath = modulePath + '.' + extension;
					if(checkIfDir(context, fullModulePath))
					{
						try
						{
							fullModulePath = resolveModuleFolder(context, fullModulePath);
							if(fullModulePath != null)
							{
								return fullModulePath;
							}
						}
						catch(error)
						{
							// try the next one
						}
					}
				}
			}
			
			throw new Error("module not found");
		}


		// find a valid module path from the given context, base paths, and path
		function findModulePath(context, basePaths, dirname, path, options=null)
		{
			options = Object.assign({}, options);

			var modulePath = null;
			if(path.startsWith('/') || path.startsWith('./') || path.startsWith('../'))
			{
				try
				{
					modulePath = resolveModulePath(context, dirname, path, options);
				}
				catch(error)
				{
					throw new Error("could not resolve module: "+error.message);
				}
			}
			else
			{
				for(const basePath of basePaths)
				{
					try
					{
						modulePath = resolveModulePath(context, basePath, path, options);
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


		// determine the interpreter for the file
		function getInterpreter(context, type, path)
		{
			path = resolveRelativePath(context, path);
			if(kernelOptions.interpreters)
			{
				for(const interpreter of kernelOptions.interpreters)
				{
					if(interpreter.type === type && interpreter.check(path))
					{
						return interpreter;
					}
				}
			}
			return undefined;
		}


		// validate a scope variable name
		const validScopeCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890_$';
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


		// run code with a given scope and interpreter
		function runScript(context, code, scope={}, interpreter=null)
		{
			// transform code if necessary
			if(interpreter)
			{
				if(typeof interpreter.transform !== 'function')
				{
					throw new TypeError("interpreter.transform must be a function");
				}
				code = interpreter.transform(code, context);
			}
			
			// create strings for global scope variables
			var prefixString = '';
			var suffixString = '';
			for(const decType in scope)
			{
				for(const varName in scope[decType])
				{
					validateVariableName(varName);
					var varValue = scope[decType][varName];
					if(varValue instanceof ScriptGlobalAlias)
					{
						var aliases = varValue.aliases;
						prefixString += decType+' '+varName+' = Object.defineProperties({}, { ';
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
						prefixString += decType+' '+varName+' = __scope.'+varName+';\n';
						if(decType !== 'const')
						{
							suffixString += '__scope.'+varName+' = '+varName+';\n';
						}
					}
				}
			}

			// evaluate the code
			return evalJavaScript(scope, prefixString+'\n(() => {\n'+code+'\n})();\n'+suffixString);
		}


		// run a script with the specified scope
		function requireFile(context, path, scope={})
		{
			path = resolveRelativePath(context, path);
			const data = context.modules.fs.readFileSync(path, {encoding:'utf8'});
			const interpreter = getInterpreter(context, 'script', path);
			return runScript(context, data, scope, interpreter);
		}


		// handle node's 'require' function
		function require(context, parentScope, dirname, path)
		{
			// check if built-in module
			if(context.modules[path])
			{
				return context.modules[path];
			}
			if(context.builtIns.modules[path])
			{
				return context.builtIns.modules[path];
			}
			// get full module path
			var basePaths = kernelOptions.libPaths || [];
			var modulePath = findModulePath(context, basePaths, dirname, path, {dirExtensions: kernelOptions.libDirExtensions});

			// check if library is shared
			let moduleContext = context;
			let moduleContainer = context.loadedModules;
			if(kernelOptions.sharedLibPaths)
			{
				for(var libPath of kernelOptions.sharedLibPaths)
				{
					if(!libPath.endsWith('/'))
					{
						libPath += '/';
					}
					if(modulePath.startsWith(libPath))
					{
						moduleContext = rootContext;
						moduleContainer = loadedSharedModules;
						break;
					}
				}
			}

			// check if module has already been loaded
			if(moduleContainer[modulePath] !== undefined)
			{
				return moduleContainer[modulePath];
			}

			// get parent directory of module path
			const moduleDir = kernel.filesystem.dirname(context, modulePath);

			// create slightly modified module scope
			var scope = {
				'const': Object.assign({}, parentScope.const),
				'let': Object.assign({}, parentScope.let),
				'var': Object.assign({}, parentScope.var)
			};
			scope.const.require = Object.defineProperties((path) => {
				return require(moduleContext, scope, moduleDir, path);
			}, {
				resolve: {
					value: (path) => {
						return require.resolve(moduleContext, moduleDir, path);
					},
					writable: false
				}
			});
			scope.const.__dirname = moduleDir;
			scope.const.__filename = modulePath;
			scope.const.module = new ScriptGlobalAlias(['exports']);
			scope.let.exports = {};

			// require file
			try
			{
				requireFile(moduleContext, modulePath, scope);
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


		// resolves the path to a given module
		require.resolve = function(context, dirname, path)
		{
			// check if built-in module
			if(context.modules[path])
			{
				return path;
			}
			if(context.builtIns.modules[path])
			{
				return path;
			}
			// get full module path
			var basePaths = kernelOptions.libPaths || [];
			return findModulePath(context, basePaths, dirname, path, {dirExtensions: kernelOptions.libDirExtensions});
		}


		// give a default value if the given value is null
		function toNonNull(value, defaultValue)
		{
			if(value == null)
			{
				return defaultValue;
			}
			return value;
		}


		// create a new context from a given context
		function createContext(parentContext = null)
		{
			parentContext = Object.assign({}, parentContext);
			let context = null;

			let moduleGenerator = {};
			let modules = {};
			for(let moduleName in generatedModules)
			{
				Object.defineProperty(moduleGenerator, moduleName, {
					get: () => {
						if(modules[moduleName] === undefined)
						{
							modules[moduleName] = generatedModules[moduleName](context);
						}
						return modules[moduleName];
					}
				});
			}

			context = {
				cwd: toNonNull(parentContext.cwd, '/'),
				pid: toNonNull(parentContext.pid, 0),
				uid: toNonNull(parentContext.uid, 0),
				gid: toNonNull(parentContext.uid, 0),
				stdin: null,
				stdout: null,
				stderr: null,
				argv: toNonNull(parentContext.argv, []).slice(0),
				env: deepCopyObject(toNonNull(parentContext.env, {})),

				timeouts: [],
				intervals: [],
				modules: moduleGenerator,
				loadedModules: {},

				valid: true,
				exiting: false,
				invalidate: () => {
					if(context.valid)
					{
						context.valid = false;

						// TODO unload CSS

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
						if(context.stdin)
						{
							stdin.input.end();
						}
						if(context.stdout)
						{
							stdout.input.end();
						}
						if(context.stderr)
						{
							stderr.input.end();
						}
					}
				}
			};

			context.builtIns = createBuiltIns(context);

			return context;
		}


		// take a normal function and make it an asyncronous promise
		function makeAsyncPromise(context, task)
		{
			return new Promise((resolve, reject) => {
				browserWrappers.setTimeout(context, () => {
					var retVal = null;
					try
					{
						retVal = task();
					}
					catch(error)
					{
						reject(error);
						return;
					}
					resolve(retVal);
				}, 0);
			});
		}



		// define kernel modules
		generatedModules = {
			'fs': (context) => {
				const FS = {};

				const Buffer = context.builtIns.modules.buffer.Buffer;
				const inodePrefix = '__inode:';
				const entryPrefix = '__entry:';

				// use inodes to handle creating filesystem entries
				// valid inode types: FILE, DIR, LINK, REMOTE

				function createINode(type, info)
				{
					// validate type
					if(typeof type !== 'string')
					{
						throw new TypeError("inode type must be a string");
					}
					if(['FILE', 'DIR', 'LINK', 'REMOTE'].indexOf(type) === -1)
					{
						throw new Error("invalid inode type "+type);
					}
					// find available inode ID
					var id = 1;
					while(true)
					{
						var item = storage.getItem(inodePrefix+i);
						if(!item)
						{
							break;
						}
						id++;
					}
					// create inode
					info = Object.assign({uid: 0, gid: 0, mode: 777}, info);
					var inode = {
						'type': type,
						'uid': info.uid,
						'gid': info.gid,
						'mode': info.mode
					};
					// store inode
					storage.setItem(inodePrefix+id, JSON.stringify(inode));
					var data = '';
					switch(type)
					{
						case 'FILE':
						case 'LINK':
						case 'REMOTE':
							data = Buffer.from('', 'utf8');
							break;

						case 'DIR':
							data = {};
							break;
					}
					writeINodeContent(id, data);
					return id;
				}


				function getINode(id)
				{
					var inode = storage.getItem(inodePrefix+id);
					if(!inode)
					{
						throw new Error("cannot access nonexistant inode "+id);
					}
					return JSON.parse(inode);
				}


				function destroyINode(id)
				{
					storage.removeItem(inodePrefix+id);
					writeINodeContent(id, null);
				}


				function doesINodeExist(id)
				{
					if(storage.getItem(inodePrefix+id))
					{
						return true;
					}
					return false;
				}


				function getModePart(accessor, mode)
				{
					mode = ''+mode;
					while(mode.length < 4)
					{
						mode = '0'+mode;
					}
					switch(accessor)
					{
						case 'sticky':
							return parseInt(mode[0]);

						case 'owner':
							return parseInt(mode[1]);

						case 'group':
							return parseInt(mode[2]);

						case 'world':
							return parseInt(mode[3]);
					}
				}


				function readINodeContent(id)
				{
					var inode = getINode(id);

					switch(inode.type)
					{
						case 'FILE':
							var content = storage.getItem(entryPrefix+id);
							if(content == null)
							{
								return null;
							}
							return Buffer.from(content, 'base64');

						case 'DIR':
							var content = storage.getItem(entryPrefix+id);
							if(content == null)
							{
								return null;
							}
							return JSON.parse(content);

						case 'LINK':
							var content = storage.getItem(entryPrefix+id);
							if(content == null)
							{
								return null;
							}
							return Buffer.from(content, 'base64');

						case 'REMOTE':
							return Buffer.from(tmpStorage[id]);

						default:
							throw new Error("invalid inode type");
					}
				}


				function writeINodeContent(id, content)
				{
					if(id === 0)
					{
						throw new Error("cannot overwrite root directory");
					}
					var inode = getINode(id);

					switch(inode.type)
					{
						case 'FILE':
							if(content == null)
							{
								storage.removeItem(entryPrefix+id);
							}
							else
							{
								if(!(content instanceof Buffer))
								{
									throw new TypeError("inode file content must be a buffer");
								}
								storage.setItem(entryPrefix+id, content.toString('base64'));
							}
							break;

						case 'DIR':
							if(content == null)
							{
								storage.removeItem(entryPrefix+id);
							}
							else
							{
								if(typeof content !== 'object')
								{
									throw new TypeError("inode dir content must be an object");
								}
								storage.setItem(entryPrefix+id, JSON.stringify(content));
							}
							break;

						case 'LINK':
							if(content == null)
							{
								storage.removeItem(entryPrefix+id);
							}
							else
							{
								if(!(content instanceof Buffer))
								{
									throw new TypeError("inode file content must be a buffer");
								}
								storage.setItem(entryPrefix+id, content.toString('base64'));
							}
							break;

						case 'REMOTE':
							if(content == null)
							{
								delete tmpStorage[id];
							}
							else
							{
								if(!(content instanceof Buffer))
								{
									throw new TypeError("inode remote content must be a buffer");
								}
								tmpStorage[id] = Buffer.from(content);
							}
							break;

						default:
							throw new Error("invalid inode type");
					}
				}


				function validatePath(path)
				{
					if(path instanceof Buffer)
					{
						path = path.toString('utf8');
					}
					if(typeof path !== 'string')
					{
						throw new TypeError("path must be a string");
					}
					return resolveRelativePath(context, path);
				}


				function findINode(path)
				{
					// validate path
					path = validatePath(path);
					// ensure absolute path
					if(!path.startsWith('/'))
					{
						throw new Error("path must be absolute");
					}
					// get all path parts
					var pathParts = path.split('/');
					for(const i=0; i<pathParts.length; i++)
					{
						if(pathParts[i] == '')
						{
							pathParts.splice(i, 1);
							i--;
						}
					}
					// traverse directories to find path
					var rootEntry = readINodeContent(0);
					var entry = rootEntry;
					var id = 0;
					for(const pathPart of pathParts)
					{
						var inode = getINode(id);
						// TODO, while entry is a link, set the link destination as the current entry
						// make sure the entry is a directory
						if(inode.type !== 'DIR')
						{
							throw new Error("part of path is not a directory");
						}
						// make sure next part of path exists
						if(entry[pathPart] == null)
						{
							return null;
						}
						// TODO check permissions
						id = entry[pathPart];
						entry = readINodeContent(id);
					}
					return id;
				}


				function createPathEntry(path, type, info)
				{
					// validate path
					path = validatePath(path);
					// ensure absolute path
					if(!path.startsWith('/'))
					{
						throw new Error("path must be absolute");
					}
					else if(path == '/')
					{
						throw new Error("cannot create entry at root");
					}

					// get info about parent directory
					var pathName = context.builtIns.modules.path.basename(dest);
					var pathDir = context.builtIns.modules.path.dirname(dest);
					var parentId = findINode(pathDir);
					if(parentId == null)
					{
						throw new Error("parent directory does not exist");
					}
					var parentINode = getINode(parentId);
					if(parentINode.type != 'DIR')
					{
						throw new Error("parent entry is not a directory");
					}
					var parentData = readINodeContent(parentId);

					// ensure path doesn't already exist
					if(parentData[pathName] != null)
					{
						throw new Error("entry already exists");
					}
					
					// add entry to parent dir
					var id = createINode(type, info);
					parentData[pathName] = id;
					writeINodeContent(parentId, parentData);

					// done
					return id;
				}

				function destroyPathEntry(path)
				{
					// validate path
					path = validatePath(path);
					// ensure absolute path
					if(!path.startsWith('/'))
					{
						throw new Error("path must be absolute");
					}
					else if(path == '/')
					{
						throw new Error("cannot destroy root entry");
					}

					// get info about the parent directory
					var pathName = context.builtIns.modules.path.basename(dest);
					var pathDir = context.builtIns.modules.path.dirname(dest);
					var parentId = findINode(pathDir);
					if(parentId == null)
					{
						throw new Error("parent directory does not exist");
					}
					var parentINode = getINode(parentId);
					if(parentINode.type !== 'DIR')
					{
						throw new Error("parent entry is not a directory");
					}
					var parentData = readINodeContent(parentId);

					// ensure entry exists
					var id = parentData[pathName];
					if(id == null)
					{
						throw new Error("entry does not exist");
					}

					// remove entry from parent dir
					var inode = getINode(id);
					if(inode.type === 'DIR')
					{
						// make sure directory is empty
						var data = readINodeContent(id);
						if(Object.keys(data).length > 0)
						{
							throw new Error("directory is not empty");
						}
					}
					delete parentData[pathName];
					writeINodeContent(parentId, parentData);
					destroyINode(id);
				}



				//========= FS =========//

				const constants = {
					COPYFILE_EXCL: 0b00000000000000000000000000000001
				};
				
				Object.defineProperty(FS, 'constants', {
					value: Object.assign({}, constants),
					writable: false
				});

				

				function readFile(path, options, callback)
				{
					if(typeof options === 'function')
					{
						callback = options;
						options = null;
					}
					if(typeof callback !== 'function')
					{
						throw new TypeError("callback function is required");
					}

					makeAsyncPromise(context, () => {
						return readFileSync(path, options);
					}).then((content) => {
						callback(null, content);
					}).catch((error) => {
						callback(error, null);
					});
				}

				function readFileSync(path, options)
				{
					options = Object.assign({}, options);
					path = validatePath(path);
					var id = findINode(path);
					if(id == null)
					{
						throw new Error("file does not exist");
					}
					var content = readINodeContent(id);
					if(options.encoding)
					{
						content = content.toString(options.encoding);
					}
					return content;
				}

				FS.readFile = readFile;
				FS.readFileSync = readFileSync;



				function copyFile(src, dest, flags, callback)
				{
					if(typeof flags === 'function')
					{
						callback = flags;
						flags = null;
					}
					if(typeof callback !== 'function')
					{
						throw new TypeError("callback function is required");
					}

					makeAsyncPromise(context, () => {
						return copyFileSync(src, dest, flags);
					}).then((content) => {
						callback(null, content);
					}).catch((error) => {
						callback(error, null);
					});
				}

				function copyFileSync(src, dest, flags)
				{
					if(flags == null)
					{
						flags = 0;
					}
					if(typeof flags !== 'number' || !Number.isInteger(flags))
					{
						throw new TypeError("flags must be an integer");
					}

					src = validatePath(src);
					dest = validatePath(dest);

					var srcId = findINode(src);
					var destId = findINode(dest);

					if(srcId == null)
					{
						throw new Error("source file does not exist");
					}
					var srcINode = getINode(srcId);
					if(srcINode.type === 'DIR')
					{
						throw new Error("source path is a directory");
					}

					// copy content
					var data = readINodeContent(srcId);
					if(destId == null)
					{
						// create destination
						destId = createPathEntry(dest, 'DIR', {});
					}
					else
					{
						if((flags & constants.COPYFILE_EXCL) === constants.COPYFILE_EXCL)
						{
							throw new Error("destination already exists");
						}
						var destINode = getINode(destId);
						if(destINode.type !== 'DIR')
						{
							throw new Error("destination is a directory");
						}
					}
					writeINodeContent(destId, data);
				}

				FS.copyFile = copyFile;
				FS.copyFileSync = copyFileSync;

				return FS;
			},




			'child_process': (context) => {
				const child_process = {};

				const EventEmitter = context.modules.events;

				function createTwoWayStream(contextIn, contextOut)
				{
					let ended = false;

					const InEventEmitter = contextIn.modules.events;
					const OutEventEmitter = contextOut.modules.events;

					let input = new InEventEmitter();
					let output = new OutEventEmitter();

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



				class Process extends EventEmitter
				{
					constructor(context, parentContext)
					{
						Object.defineProperties(this, {
							'argv': {
								value: procArgv
							},
							'chdir': {
								value: (path) => {
									path = resolveRelativePath(context, path);
									var stats = context.modules.fs.statSync(path);
									if(stats.type !== 'DIR')
									{
										throw new Error("path is not a directory");
									}
									context.cwd = path;
								},
								writable: false
							},
							'cwd': {
								value: () => {
									return context.cwd;
								},
								writable: false
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
									if(!context.valid || context.exiting)
									{
										throw new Error("cannot exit process more than once");
									}
									// call exit event
									context.exiting = true;
									this.emit('exit', code);
									// end process
									context.invalidate(code, null);
									// throw exit signal
									var exitSignal = new ExitSignal(code);
									throw exitSignal;
								},
								writable: false
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
									return kernelOptions.platform || osName;
								}
							}
						});
					}
				}



				class ChildProcess extends EventEmitter
				{
					constructor(path, args=[], options={})
					{
						if(!(args instanceof Array))
						{
							throw new TypeError("args must be an Array");
						}
						options = Object.assign({}, options);

						// create new context
						const childContext = createContext(context);

						// get new process PID
						childContext.pid = pidCounter;
						pidCounter++;

						// define general process info=
						var argv0 = path;
						path = resolveRelativePath(context, path);
						const dirname = context.builtIns.modules.path.dirname(path);

						// validate options
						if(options.cwd)
						{
							if(typeof options.cwd !== 'string')
							{
								throw new TypeError("options.cwd must be a string");
							}
							// TODO check permissions and check if dir exists
							childContext.cwd = options.cwd;
						}
						if(options.env)
						{
							if(typeof options.env !== 'object')
							{
								throw new TypeError("options.env must be an object")
							}
							childContext.env = Object.assign(childContext.env, deepCopyObject(options.env));
						}
						if(options.argv0)
						{
							if(typeof options.argv0 !== 'string')
							{
								throw new TypeError("options.argv0 must be a string");
							}
							argv0 = options.argv0;
						}

						// apply options
						childContext.argv = [argv0].concat(args);

						// build I/O streams
						const stdin = createTwoWayStream(context, childContext);
						const stdout = createTwoWayStream(childContext, context);
						const stderr = createTwoWayStream(childContext, context);
						childContext.stdin = stdin.input;
						childContext.stdout = stdout.output;
						childContext.stderr = stderr.output;

						// add invalidation hook
						const childContextInvalidate = childContext.invalidate;
						childContext.invalidate = (exitCode, killSignal) => {
							var wasValid = childContext.valid;
							// invalidate
							childContextInvalidate();
							if(wasValid)
							{
								// wait for next queue to emit event
								setTimeout(() => {
									this.emit('exit', exitCode, killSignal);
								}, 0);
							}
						}

						// TODO apply properties

						// try to start the process
						try
						{
							// get full module path
							var paths = [];
							if(context.env && context.env.paths)
							{
								paths = context.env.paths;
							}
							const filename = findModulePath(context, paths, context.cwd, path, {dirExtensions: kernelOptions.binFolderExtensions});

							// ensure that the cwd is enterable by the calling context
							var cwdStats = childContext.modules.fs.statSync(path);
							if(cwdStats.type !== 'DIR')
							{
								throw new Error("cwd is not a directory");
							}

							// create process scope
							let scope = null;
							scope = {
								'const': {
									// browser built-ins
									// timeouts
									setTimeout: (...args) => {
										return browserWrappers.setTimeout(childContext, ...args);
									},
									clearTimeout: (...args) => {
										return browserWrappers.clearTimeout(childContext, ...args);
									},
									// intervals
									setInterval: (...args) => {
										return browserWrappers.setInterval(childContext, ...args);
									},
									clearInterval: (...args) => {
										return browserWrappers.clearInterval(childContext, ...args);
									},
									// promise
									Promise: createProcPromiseClass(context),
									// console
									console: Object.defineProperties(Object.assign({}, console), {
										log: {
											value: (...args) => {
												var strings = [];
												for(const arg of args)
												{
													strings.push(''+arg);
												}
												var stringVal = strings.join(' ');
						
												stdout.input.write(stringVal+'\n');
												console.log(...args);
											},
											enumerable: true,
											writable: false
										},
										warn: {
											value: (...args) => {
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
											enumerable: true,
											writable: false
										},
										error: {
											value: (...args) => {
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
											},
											enumerable: true,
											writable: false
										},
										memory: {
											get: () => {
												return console.memory;
											}
										}
									}),
				
									// node built-ins
									__dirname: dirname,
									__filename, filename,
									require: Object.defineProperties((path) => {
										return require(context, scope, dirname, path);
									}, {
										resolve: {
											value: (path) => {
												return require.resolve(context, dirname, path);
											},
											enumerable: true,
											writable: false
										}
									}),
									module: new ScriptGlobalAlias('exports'),
									process: new Process(childContext, context),

									// addons
									ExitSignal: ExitSignal
								},
								'let': {
									exports: {}
								}
							};

							// start process in the next queue
							browserWrappers.setTimeout(context, () => {
								// start process
								try
								{
									requireFile(childContext, filename, scope);
								}
								catch(error)
								{
									if(error instanceof ExitSignal)
									{
										// process has ended
									}
									else
									{
										if(childContext.valid)
										{
											console.error("unhandled process error:", error);
											childContext.invalidate(1, null);
										}
										else
										{
											// just ignore...
										}
									}
									return;
								}
							}, 0);
						}
						catch(error)
						{
							// send error in the next queue
							browserWrappers.setTimeout(context, () => {
								// send error
								this.emit('error', error);
							}, 0);
						}
					}
				}


				function spawn(command, args=[], options=null)
				{
					if(args != null && typeof args === 'object' && !(args instanceof Array))
					{
						options = args;
						args = [];
					}
					if(typeof command !== 'string')
					{
						throw new TypeError("command must be a string");
					}
					if(!(args instanceof Array))
					{
						throw new TypeError("args must be an array");
					}

					return new ChildProcess(command, args, options);
				}

				child_process.spawn = spawn;

				return child_process;
			},



			'events': (context) => {
				const EventEmitter = context.builtIns.modules.events;

				const superEmit = EventEmitter.prototype.emit;
				EventEmitter.emit = function(eventName, ...args)
				{
					// ensure context is valid
					if(!context.valid)
					{
						this.removeAllListeners();
						return false;
					}
					// send event
					return superEmit.apply(this, eventName, ...args);
				}

				return EventEmitter;
			}
		};



		// download built-in node modules / classes
		builtInsPromise = new Promise((resolve, reject) => {
			var xhr = new XMLHttpRequest();
			xhr.onreadystatechange = () => {
				if(xhr.readyState === 4)
				{
					if(xhr.status === 200)
					{
						// save the built in modules code
						builtInsCode = xhr.responseText;
						resolve();
					}
					else
					{
						var errorMessage = "failed to download built-in modules";
						if(xhr.status > 0)
						{
							errorMessage += " with status "+xhr.status+": "+xhr.statusText;
						}
						reject(new Error(errorMessage));
					}
				}
			};

			xhr.open('GET', 'https://wzrd.in/bundle/node-builtin-map');
			xhr.send();
		});



		// TODO everything else



		// bootup method
		this.boot = (path) => {
			builtInsPromise.then(() => {
				// create root context
				rootContext = createContext(null);
				// TODO execute boot file
			}).catch((error) => {
				console.error("unable to boot from kernel:");
				console.error(error);
			});
		};
	// end kernel class
	}

// end kernel sandbox
})();

// end evalScript + kernel sandbox
})();