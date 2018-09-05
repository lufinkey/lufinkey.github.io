
// sandbox evalJavaScript + Kernel
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


//#region General Helper Functions

	function deepCopyObject(object) {
		switch(typeof object) {
			case 'object':
				if(object === null) {
					return null;
				}
				else if(object instanceof Array) {
					var newObject = object.slice(0);
					for(var i=0; i<newObject.length; i++) {
						newObject[i] = deepCopyObject(newObject[i]);
					}
					return newObject;
				}
				else {
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

	// give a default value if the given value is null
	function toNonNull(value, defaultValue) {
		if(value == null) {
			return defaultValue;
		}
		return value;
	}

	// download a file
	function download(url) {
		return new Promise((resolve, reject) => {
			var xhr = new XMLHttpRequest();
			xhr.onreadystatechange = () => {
				if(xhr.readyState === 4) {
					if(xhr.status === 200) {
						resolve(xhr.responseText);
					}
					else {
						reject(new Error(xhr.status+": "+xhr.statusText));
					}
				}
			};

			xhr.open('GET', url);
			xhr.send();
		});
	}

//#endregion



	// class to handle all kernel functions
	function Kernel(kernelOptions)
	{
//#region Kernel initialization
		kernelOptions = Object.assign({}, kernelOptions);
		
		// clear localStorage for now
		window.localStorage.clear();

		const osName = ''+(kernelOptions.osName || 'finkeos');
		const fsPrefix = ''+(kernelOptions.fsPrefix || '');

		const tmpStorage = {};
		let storage = null;

		let builtInsGenerator = null;
		let browserWrappers = null;
		let generatedModules = null;
		let loadedSharedModules = {};
		let loadedCSS = {};

		let rootContext = null;
		let pidCounter = 1;
		let processes = {};
//#endregion


//#region Permission Validation

		function getModeRWE(num) {
			var perm = {
				r: false,
				w: false,
				x: false
			};
			if(num >= 4) {
				num -= 4;
				perm.r = true;
			}
			if(num >= 2) {
				num -= 2;
				perm.w = true;
			}
			if(num >= 1) {
				num -= 1;
				perm.x = true;
			}
			return perm;
		}

		function readMode(mode) {
			mode = mode.toString(8);
			while(mode.length < 4) {
				mode = '0'+mode;
			}
			return {
				'sticky': getModeRWE(parseInt(mode[0])),
				'owner': getModeRWE(parseInt(mode[1])),
				'group': getModeRWE(parseInt(mode[2])),
				'world': getModeRWE(parseInt(mode[3]))
			};
		}

		function checkPerm(perm, neededPerms) {
			if(neededPerms.r && !perm.r) {
				return false;
			}
			if(neededPerms.w && !perm.w) {
				return false;
			}
			if(neededPerms.x && !perm.x) {
				return false;
			}
			return true;
		}

		function validatePermission(context, uid, gid, mode, perm) {
			mode = readMode(mode);
			if(context.uid == uid && checkPerm(mode.owner, perm)) {
				return;
			}
			else if(context.gid == gid && checkPerm(mode.group, perm)) {
				return;
			}
			else if(checkPerm(mode.world, perm)) {
				return;
			}
			console.log(context);
			console.log({
				uid: uid,
				gid: gid,
				mode: mode
			});
			console.log(perm);
			throw new Error("Access Denied");
		}

//#endregion


//#region Exit Signal
		// throwable to kill thread
		class ThreadKiller {
			constructor() {
				//
			}
		};

		// exception for process exit signal
		class ExitSignal extends ThreadKiller {
			constructor(exitCode) {
				super();
				if(!Number.isInteger(exitCode) || exitCode < 0) {
					throw new TypeError("exit code must be a positive integer");
				}
				this.exitCode = exitCode;
			}
		}

		const signals = {
			SIGHUP: 1,
			SIGINT: 2,
			SIGQUIT: 3,
			SIGILL: 4,
			SIGABRT: 6,
			SIGFPE: 8,
			SIGKILL: 9,
			SIGSEGV: 11,
			SIGPIPE: 13,
			SIGALRM: 14,
			SIGTERM: 15
		};

		function getSignalName(signal) {
			for(const signalName in signals) {
				if(signals[signalName] === signal) {
					return signalName;
				}
			}
			return null;
		}

//#endregion


//#region Threads

function startThread(context, options={}) {
	if(!context.valid) {
		throw new ThreadKiller();
	}
	options = Object.assign({}, options);
	const threadID = context.nextThreadID;
	context.nextThreadID++;
	context.threads.push({
		id: threadID,
		cancel: options.cancel
	});
	return threadID;
}

function removeThread(context, threadID) {
	for(var i=0; i<context.threads.length; i++) {
		var thread = context.threads[i];
		if(thread.id === threadID) {
			context.threads.splice(i, 1);
			break;
		}
	}
}

function finishThread(context, threadID) {
	if(context.valid && !context.invalidating && !context.hasRunningCode({ignoringThreads: [threadID]})) {
		if(context.process != null) {
			try {
				context.process.emit('beforeExit');
			}
			catch(error) {
				console.error(error);
			}
		}
		removeThread(context, threadID);
		if(context.valid && !context.invalidating && !context.hasRunningCode()) {
			console.error(new Error(context.filename+" ("+context.pid+") has no more threads to run"));
			context.invalidate(0, null);
		}
	}
	else {
		removeThread(context, threadID);
	}
}

function wrapThread(context, threadFunc, options={}) {
	let retVal = undefined;
	const threadID = startThread(context, options);
	try {
		retVal = threadFunc();
	}
	catch(error) {
		// error
		finishThread(context, threadID);
		if(error instanceof ThreadKiller) {
			if(options.rethrowThreadKiller) {
				throw error;
			}
		}
		else {
			console.error(error);
		}
		return;
	}
	// handle result
	if(retVal instanceof Promise || retVal instanceof ProcPromise) {
		// promise
		let threadKiller = null;
		let retPromise = retVal;
		retVal = new Promise((resolve, reject) => {
			retPromise.then((...results) => {
				// done
				finishThread(context, threadID);
				resolve(...results);
			}).catch((error) => {
				// error
				finishThread(context, threadID);
				if(error instanceof ThreadKiller) {
					if(options.rethrowThreadKiller) {
						threadKiller = error;
					}
				}
				reject(error);
			});
		});
		if(threadKiller != null && options.rethrowThreadKiller) {
			throw threadKiller;
		}
	}
	else {
		finishThread(context, threadID);
	}
	return retVal;
}

//#endregion


//#region Promise

		// promise to handle exit signals
		function ProcPromise(context, callback) {
			let promise = null;

			function wrapPromiseMethod(method, callback) {
				let threadKiller = null;
				var retVal = method((...args) => {
					if(!context.valid) {
						return;
					}
					try {
						return wrapThread(context, () => {
							return callback(...args);
						}, {rethrowThreadKiller:true});
					}
					catch(error) {
						if(error instanceof ThreadKiller) {
							threadKiller = error;
							return;
						}
						else {
							throw error;
						}
					}
				});
				// rethrow exit signal if there was one
				if(threadKiller != null) {
					throw threadKiller;
				}
				// wrap return value if necessary
				if(retVal === promise) {
					return this;
				}
				else if(retVal instanceof Promise) {
					return new ProcPromise(context, (resolve, reject) => {
						return retVal.then(resolve).catch(reject);
					});
				}
				return retVal;
			}

			// then
			this.then = (callback, ...args) => {
				if(typeof callback !== 'function') {
					return promise.then(callback, ...args);
				}
				return wrapPromiseMethod((callback) => {
					return promise.then((...args) => {
						return callback(...args);
					}, ...args);
				}, callback);
			};

			// catch
			this.catch = (callback, ...args) => {
				if(typeof callback !== 'function') {
					return promise.catch(callback, ...args);
				}
				return wrapPromiseMethod((callback) => {
					return promise.catch((...args) => {
						return callback(...args);
					}, ...args);
				}, callback);
			};

			// finally
			this.finally = (callback, ...args) => {
				if(typeof callback !== 'function') {
					return promise.finally(callback, ...args);
				}
				return wrapPromiseMethod((callback) => {
					return promise.finally((...args) => {
						return callback(...args);
					}, ...args);
				}, callback);
			};

			// perform promise
			let threadKiller = null;
			promise = wrapThread(context, () => {
				return new Promise((resolve, reject) => {
					try {
						return callback(resolve, reject);
					}
					catch(error) {
						if(error instanceof ThreadKiller) {
							threadKiller = error;
						}
						throw error;
					}
				});
			}, {rethrowThreadKiller:true});
			if(threadKiller != null) {
				throw threadKiller;
			}
		}

		ProcPromise.resolve = function(context, ...args) {
			return new ProcPromise(context, (resolve, reject) => {
				resolve(...args);
			});
		}
	
		ProcPromise.reject = function(context, ...args) {
			return new ProcPromise(context, (resolve, reject) => {
				reject(...args);
			});
		}
	
		ProcPromise.all = function(context, promises, ...args) {
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
	
		ProcPromise.race = function(context, promises, ...args) {
			// wrap promises
			if(promises instanceof Array) {
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
		function createProcPromiseClass(context) {
			const PromiseClass = ProcPromise.bind(ProcPromise, context);
			PromiseClass.resolve = ProcPromise.resolve.bind(PromiseClass, context);
			PromiseClass.reject = ProcPromise.reject.bind(PromiseClass, context);
			PromiseClass.all = ProcPromise.all.bind(PromiseClass, context);
			PromiseClass.race = ProcPromise.race.bind(PromiseClass, context);
			return PromiseClass;
		}

//#endregion


//#region Browser Function Wrappers

		// define contextual browser functions
		browserWrappers = {
			setTimeout: (context, handler, ...args) => {
				if(typeof handler !== 'function') {
					throw new TypeError("handler must be a function");
				}
				const timeout = setTimeout((...args) => {
					var index = context.timeouts.indexOf(timeout);
					if(index !== -1) {
						context.timeouts.splice(index, 1);
					}
					return wrapThread(context, () => {
						return handler(...args);
					}, {rethrowThreadKiller:true});
				}, ...args);
				context.timeouts.push(timeout);
				return timeout;
			},
			clearTimeout: (context, timeout) => {
				var index = context.timeouts.indexOf(timeout);
				if(index !== -1) {
					context.timeouts.splice(index, 1);
				}
				return clearTimeout(timeout);
			},
			// intervals
			setInterval: (context, handler, ...args) => {
				if(typeof handler !== 'function') {
					throw new TypeError("handler must be a function");
				}
				const interval = setInterval((...args) => {
					return wrapThread(context, () => {
						return handler(...args);
					}, {rethrowThreadKiller:true});
				}, ...args);
				context.intervals.push(interval);
				return interval;
			},
			clearInterval: (context, interval) => {
				var index = context.intervals.indexOf(interval);
				if(index !== -1) {
					context.intervals.splice(index, 1);
				}
				return clearInterval(interval);
			}
		};

//#endregion


//#region Built-In Module Generation

		function createBuiltInGenerator(code) {
			code = 'exports = ((__scope) => {\n'+
				'const setTimeout = __scope.setTimeout;\n'+
				'const clearTimeout = __scope.clearTimeout;\n'+
				'const setInterval = __scope.setInterval;\n'+
				'const clearInterval = __scope.clearInterval;\n'+
				'const Promise = __scope.Promise;\n'+
				'let require = null;\n'+
				'(() => {\n'+
					'const __scope = undefined;\n'+
					'(() => {\n'+
						code+'\n'+
					'})()\n'+
				'})();\n'+
				'return require;'+
			'});';
			
			var scope = {
				'let': {
					exports: {}
				}
			};
			
			runScript(null, code, scope);

			return scope.let.exports;
		}

		// create built-in modules for a given context
		function createBuiltIns(context) {
			var scope = {
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
			};
			var builtIns = builtInsGenerator(scope)('node-builtin-map');
			return builtIns;
		}

		// download built-in modules script and create generator
		async function downloadBuiltIns() {
			// download built-in node modules / classes
			var data = await download('https://cdn.jsdelivr.net/npm/node-builtin-map/dist/node-builtin-map.js');
			builtInsGenerator = createBuiltInGenerator(data);
		}

//#endregion


//#region Streams

		function createTwoWayStream(contextIn, contextOut, options={}) {
			options = Object.assign({}, options);
			
			const Buffer = contextIn.builtIns.modules.buffer.Buffer;
			const Writable = contextIn.builtIns.modules.stream.Writable;
			const Readable = contextOut.builtIns.modules.stream.Readable;

			let input = null;
			let inputDestroyed = false;
			let output = null;
			let outputDestroyed = false;

			let outputThread = null;
			function updateOutputThread() {
				if(options.threading) {
					if(!outputThread) {
						if(output.listenerCount('data') > 0 && !outputDestroyed) {
							syscall(contextOut, 'thread', () => {
								return new Promise((resolve, reject) => {
									outputThread = {
										resolve: resolve,
										reject: reject
									};
								});
							}, () => {
								if(!outputDestroyed) {
									output.destroy();
								}
							});
						}
					}
					else {
						if(output.listenerCount('data') === 0 || outputDestroyed) {
							const thread = outputThread;
							outputThread = null;
							thread.resolve();
						}
					}
				}
			}

			class InStream extends Writable {
				_write(chunk, encoding, callback) {
					if(contextOut.valid && !outputDestroyed) {
						if(chunk instanceof Buffer) {
							output.push(chunk);
						}
						else {
							output.push(chunk, encoding);
						}
					}
					callback();
				}

				_destroy(err, callback) {
					inputDestroyed = true;
					if(callback) {
						callback();
					}
					if(!outputDestroyed) {
						output.push(null);
						output.destroy();
					}
				}
			}

			class OutStream extends Readable {
				addListener(event, ...args) {
					super.addListener(event, ...args);
					if(event === 'data') {
						updateOutputThread();
					}
				}

				removeListener(event, ...args) {
					super.removeListener(event, ...args);
					if(event === 'data') {
						updateOutputThread();
					}
				}

				on(event, ...args) {
					super.on(event, ...args);
					if(event === 'data') {
						updateOutputThread();
					}
				}

				once(event, ...args) {
					super.once(event, ...args);
					if(event === 'data') {
						updateOutputThread();
					}
				}

				off(event, ...args) {
					super.off(event, ...args);
					if(event === 'data') {
						updateOutputThread();
					}
				}

				prependListener(event, ...args) {
					super.prependListener(event, ...args);
					if(event === 'data') {
						updateOutputThread();
					}
				}

				prependOnceListener(event, ...args) {
					super.prependOnceListener(event, ...args);
					if(event === 'data') {
						updateOutputThread();
					}
				}

				removeAllListeners(...args) {
					super.removeAllListeners(...args);
					updateOutputThread();
				}

				_read() {
					//
				}

				_destroy(err, callback) {
					outputDestroyed = true;
					updateOutputThread();
					if(callback) {
						callback();
					}
					this.emit('close');
				}
			}

			input = new InStream({emitClose:true});
			output = new OutStream();

			return {
				input: input,
				output: output
			};
		}

//#endregion


//#region File Helper Functions

		// check if a given path is a folder
		function checkIfDir(context, path) {
			try {
				var stats = context.modules.fs.statSync(path);
				if(stats.isDirectory()) {
					return true;
				}
			}
			catch(error) {}
			return false;
		}


		// check if a given path is a file
		function checkIfFile(context, path) {
			try {
				var stats = context.modules.fs.statSync(path);
				if(stats.isFile()) {
					return true;
				}
			}
			catch(error) {}
			return false;
		}


		// resolves a relative path to a full path using a given cwd or the context's cwd
		function resolveRelativePath(context, path, cwd) {
			if(typeof path !== 'string') {
				throw new TypeError("path must be a string");
			}
			
			if(!cwd) {
				cwd = context.cwd;
				if(!cwd) {
					cwd = '/';
				}
			}
			else if(typeof cwd !== 'string') {
				throw new TypeError("cwd must be a string");
			}

			// return normalized path if it's absolute
			if(path.startsWith('/')) {
				return context.builtIns.modules.path.normalize(path);
			}

			// concatenate path with cwd
			return context.builtIns.modules.path.join(cwd, path);
		}


		// make the path leading up to the given file
		function makeLeadingDirs(context, path) {
			// resolve path
			path = resolveRelativePath(context, path);
			// split and remove empty path parts
			var pathParts = path.split('/');
			for(var i=0; i<pathParts.length; i++) {
				if(pathParts[i]=='') {
					pathParts.splice(i, 1);
					i--;
				}
			}
			
			// make sure each leading path part exists and is a directory
			for(var i=0; i<(pathParts.length-1); i++) {
				var leadingPath = '/'+pathParts.slice(0, i+1).join('/');
				// ensure path is a directory or doesn't exist
				try {
					var stats = context.modules.fs.statSync(leadingPath);
					if(stats.isDirectory()) {
						continue;
					}
					else {
						context.modules.fs.unlinkSync(leadingPath);
					}
				}
				catch(error) {}
				// create the directory
				context.modules.fs.mkdirSync(leadingPath);
			}
		}

//#endregion


//#region Module Path Resolution

		// resolve a module's main js file from a folder
		function resolveModuleFolder(context, path) {
			var packagePath = path+'/package.json';
			if(!checkIfFile(context, packagePath)) {
				return null;
			}

			var packageInfo = JSON.parse(context.modules.fs.readFileSync(packagePath, {encoding:'utf8'}));
			var mainFile = packageInfo["main"];
			if(!mainFile) {
				throw new Error("no main file specified");
			}

			if(typeof mainFile !== 'string') {
				throw new TypeError("\"main\" must be a string");
			}

			if(mainFile.startsWith('/')) {
				return mainFile;
			}
			return context.builtIns.modules.path.join(path, mainFile);
		}


		// find a valid module path from the given context, base path, and path
		function resolveModulePath(context, basePath, path, options=null) {
			options = Object.assign({}, options);
			var modulePath = resolveRelativePath(context, path, basePath);
			// find full module path
			var fullModulePath = modulePath;
			if(checkIfDir(context, fullModulePath)) {
				fullModulePath = resolveModuleFolder(context, fullModulePath);
				if(fullModulePath != null) {
					return fullModulePath;
				}
			}
			else if(checkIfFile(context, fullModulePath)) {
				return fullModulePath;
			}
			// check if file exists with a js extension
			fullModulePath = modulePath + '.js';
			if(checkIfFile(context, fullModulePath)) {
				return fullModulePath;
			}
			// check file against known script extensions
			if(kernelOptions.scriptExtensions) {
				for(const scriptExt of kernelOptions.scriptExtensions) {
					fullModulePath = modulePath + '.' + scriptExt;
					if(checkIfFile(context, fullModulePath)) {
						return fullModulePath;
					}
				}
			}
			// check file against specified folder extensions
			if(options.dirExtensions) {
				for(const extension of options.dirExtensions) {
					fullModulePath = modulePath + '.' + extension;
					if(checkIfDir(context, fullModulePath)) {
						try {
							fullModulePath = resolveModuleFolder(context, fullModulePath);
							if(fullModulePath != null) {
								return fullModulePath;
							}
						}
						catch(error) {
							// try the next one
						}
					}
				}
			}
			
			throw new Error("module not found");
		}


		// find a valid module path from the given context, base paths, and path
		function findModulePath(context, basePaths, dirname, path, options=null) {
			options = Object.assign({}, options);

			var modulePath = null;
			if(path.startsWith('/') || path.startsWith('./') || path.startsWith('../')) {
				try {
					modulePath = resolveModulePath(context, dirname, path, options);
				}
				catch(error) {
					throw new Error("could not resolve '"+path+"': "+error.message);
				}
			}
			else {
				for(const basePath of basePaths) {
					try {
						modulePath = resolveModulePath(context, basePath, path, options);
						break;
					}
					catch(error) {
						// path couldn't be resolved
					}
				}
				if(modulePath == null) {
					throw new Error("could not resolve '"+path+"'");
				}
			}
			return modulePath;
		}

//#endregion


//#region Interpreters

		// determine the interpreter for the file
		function getInterpreter(context, type, path)
		{
			path = resolveRelativePath(context, path);
			if(kernelOptions.interpreters) {
				for(const interpreter of kernelOptions.interpreters) {
					if(interpreter.type === type && interpreter.check(path)) {
						return interpreter;
					}
				}
			}
			return undefined;
		}

//#endregion


//#region Script Execution

		// class to allow aliasing select globals to itself when evaluating a script
		function ScriptGlobalAlias(aliases) {
			this.aliases = aliases;
		}

		// validate a scope variable name
		const validScopeCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890_$';
		function validateVariableName(varName) {
			if(typeof varName !== 'string') {
				throw new TypeError("variable name must be a string");
			}
			// ensure string isn't empty
			if(varName.length == 0) {
				throw new Error("empty string cannot be variable name");
			}
			// ensure all characters are valid
			for(const char of varName) {
				if(validScopeCharacters.indexOf(char) === -1) {
					throw new Error("invalid scope variable name "+varName);
				}
			}
			// ensure name doesn't start with a number
			if("1234567890".indexOf(varName[0]) !== -1) {
				throw new Error("variable name cannot start with a number");
			}
		}


		// run code with a given scope and interpreter
		function runScript(context, code, scope={}, interpreter=null) {
			// transform code if necessary
			if(interpreter) {
				if(typeof interpreter.transform !== 'function') {
					throw new TypeError("interpreter.transform must be a function");
				}
				code = interpreter.transform(code, context);
			}
			
			// create strings for global scope variables
			var prefixString = '';
			var suffixString = '';
			for(const decType in scope) {
				for(const varName in scope[decType]) {
					validateVariableName(varName);
					var varValue = scope[decType][varName];
					if(varValue instanceof ScriptGlobalAlias) {
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
					else {
						prefixString += decType+' '+varName+' = __scope.'+decType+'.'+varName+';\n';
						if(decType !== 'const') {
							suffixString += '__scope.'+decType+'.'+varName+' = '+varName+';\n';
						}
					}
				}
			}

			// create filtered code string
			const filteredCode =
				prefixString+'\n'+
				'(() => {\n'+
					'const __scope = undefined;\n'+
					'const __code = undefined;\n'+
					'(() => {\n'+
						code+'\n'+
					'})()\n'+
				'})()\n'+
				suffixString;

			// evaluate the code
			evalJavaScript(scope, filteredCode);
		}

//#endregion


//#region require

		// run a script with the specified scope
		function requireFile(context, path, scope={}) {
			path = resolveRelativePath(context, path);
			const data = context.modules.fs.readFileSync(path, {encoding:'utf8'});
			const interpreter = getInterpreter(context, 'script', path);
			return runScript(context, data, scope, interpreter);
		}


		// handle node's 'require' function
		function require(context, parentScope, dirname, path) {
			// check if built-in module
			if(context.modules[path]) {
				return context.modules[path];
			}
			if(context.builtIns.modules[path]) {
				return context.builtIns.modules[path];
			}
			// get full module path
			var basePaths =
				(kernelOptions.libPaths || [])
				.concat(kernelOptions.privateLibPaths || [])
				.concat(context.env['LD_LIBRARY_PATH'] || []);
			var modulePath = findModulePath(context, basePaths, dirname, path, {dirExtensions: kernelOptions.libDirExtensions});

			// check if library is shared
			let moduleContext = context;
			let moduleContainer = context.loadedModules;

			// load library rules if there are any
			let libRules = {};
			// TODO ensure the librules file is owned by the same user as the library
			let libRulesExist = true;
			const libRulesPath = modulePath+'.librules';
			try {
				context.modules.fs.accessSync(libRulesPath);
			}
			catch(error) {
				libRulesExist = false;
			}
			if(libRulesExist) {
				var libRulesFile = context.modules.fs.readFileSync(libRulesPath, {encoding:'utf8'});
				libRules = JSON.parse(libRulesFile);
				if(!libRules) {
					libRules = {};
				}
			}

			// check library rules
			if(libRules.shared) {
				moduleContainer = loadedSharedModules;
				// TODO check if the file is owned by root
				if(!moduleContainer[modulePath] && context.uid != 0) {
					throw new Error("cannot perform initial load of globally shared library as non-root");
				}
				moduleContext = rootContext;
			}
			if(libRules.allowedUsers) {
				if(libRules.allowedUsers.indexOf(context.uid) == -1) {
					throw new Error("user not allowed to load library");
				}
			}
			if(libRules.blockedUsers) {
				if(libRules.blockedUsers.indexOf(context.uid) != -1) {
					throw new Error("user is blocked from loading library");
				}
			}
			if(libRules.allowedFiles) {
				var foundMatch = false;
				const filename = parentScope.const.__filename;
				for(var allowedFile of libRules.allowedFiles) {
					allowedFile = resolveRelativePath(context, allowedFile, dirname);
					var allowedDir = allowedFile;
					if(!allowedDir.endsWith('/')) {
						allowedDir += '/';
					}
					if(filename.startsWith(allowedDir)) {
						foundMatch = true;
						break;
					}
					else if(allowedFile == filename) {
						foundMatch = true;
						break;
					}
				}
				if(!foundMatch) {
					throw new Error("file is not allowed to load library");
				}
			}

			// check if module has already been loaded
			if(moduleContainer[modulePath] !== undefined) {
				return moduleContainer[modulePath];
			}

			// get parent directory of module path
			const moduleDir = context.builtIns.modules.path.dirname(modulePath);

			// create slightly modified module scope
			var scope = {
				'const': Object.assign({}, moduleContext.scope.const),
				'let': Object.assign({}, moduleContext.scope.let),
				'var': Object.assign({}, moduleContext.scope.var)
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
			scope.const.requireCSS = Object.defineProperties((path) => {
				return requireCSS(moduleContext, moduleDir, path);
			}, {
				resolve: {
					value: (path) => {
						return resolveCSSPath(moduleContext, moduleDir, path);
					},
					writable: false
				},
				wait: {
					value: (path, callback) => {
						return waitForCSS(moduleContext, moduleDir, path, callback);
					},
					writable: false
				},
				ready: {
					value: (path) => {
						return isCSSReady(moduleContext, moduleDir, path);
					},
					writable: false
				}
			});
			scope.const.__dirname = moduleDir;
			scope.const.__filename = modulePath;
			scope.const.module = new ScriptGlobalAlias(['exports']);
			scope.let.exports = {};

			// require file
			try {
				requireFile(moduleContext, modulePath, scope);
			}
			catch(error) {
				console.error("unable to require "+path, error);
				throw error;
			}

			// save exported module
			moduleContainer[modulePath] = scope.let.exports;

			// return exported module
			return scope.let.exports;
		}


		// resolves the path to a given module
		require.resolve = function(context, dirname, path) {
			// check if built-in module
			if(context.modules[path]) {
				return path;
			}
			if(context.builtIns.modules[path]) {
				return path;
			}
			// get full module path
			var basePaths = kernelOptions.libPaths || [];
			return findModulePath(context, basePaths, dirname, path, {dirExtensions: kernelOptions.libDirExtensions});
		}

//#endregion


//#region requireCSS

		// resolve a required CSS file
		function resolveCSSPath(context, dirname, path) {
			// resolve full path
			var cssPath = resolveRelativePath(context, path, dirname);

			// resolve actual css file path
			var testExtensions = ['', '.css'];
			if(kernelOptions.styleExtensions) {
				for(const extension of kernelOptions.styleExtensions) {
					testExtensions.push('.'+extension);
				}
			}
			for(const extension of testExtensions) {
				var testPath = cssPath+extension;
				if(checkIfFile(context, testPath)) {
					return cssPath;
				}
			}
			throw new Error("unable to resolve css path "+path);
		}


		// inject a CSS file into the current page
		function requireCSS(context, dirname, path) {
			var cssPath = resolveCSSPath(context, dirname, path);

			// check if css already loaded
			if(loadedCSS[cssPath]) {
				// add process PID if necessary
				var info = loadedCSS[cssPath];
				if(info.pids.indexOf(context.pid) === -1) {
					info.pids.push(context.pid);
				}
				loadedCSS[cssPath] = info;
				return new ProcPromise(context, (resolve, reject) => {
					waitForCSS(context, dirname, cssPath, () => {
						if(context.valid) {
							if(loadedCSS[cssPath].error) {
								reject(loadedCSS[cssPath].error);
								return;
							}
							resolve();
						}
					})
				});
			}

			// read css data
			var cssData = context.modules.fs.readFileSync(cssPath, {encoding: 'utf8'});

			// TODO parse out special CSS functions

			// add style tag to page
			var head = document.querySelector('head');
			let styleTag = document.createElement("STYLE");
			styleTag.type = "text/css";
			head.appendChild(styleTag);

			// save tag
			loadedCSS[cssPath] = {
				pids: [context.pid],
				tag: styleTag,
				ready: false
			};

			// interpret css
			var cssPromise = null;
			var interpreter = getInterpreter(context, 'style', cssPath);
			if(interpreter) {
				cssPromise = interpreter.transform(cssData, context);
			}
			else {
				// apply plain content
				cssPromise = Promise.resolve(cssData);
			}

			// add CSS to page when finished parsing
			return new ProcPromise(context, (resolve, reject) => {
				cssPromise.then((cssData) => {
					if(!loadedCSS[cssPath]) {
						return;
					}
					styleTag.textContent = cssData;
					loadedCSS[cssPath].ready = true;
					resolve();
				}).catch((error) => {
					if(!loadedCSS[cssPath]) {
						return;
					}
					console.error("failed to parse "+path+": "+error.message);
					loadedCSS[cssPath].error = error;
					loadedCSS[cssPath].ready = true;
					reject(error);
				});
			});
		}


		// check if CSS for this context is ready
		function isCSSReady(context, dirname, path=null) {
			if(path != null) {
				// check for specific CSS file
				var cssPath = null;
				try {
					cssPath = resolveCSSPath(context, dirname, path);
				}
				catch(error) {
					return false;
				}

				return loadedCSS[cssPath].ready;
			}
			else {
				// check for all CSS files used by this context
				for(const cssPath in loadedCSS) {
					var info = loadedCSS[cssPath];
					if(!info.ready) {
						if(info.pids.indexOf(context.pid) !== -1) {
							return false
						}
					}
				}

				return true;
			}
		}

		
		// wait for CSS file(s) to be ready
		function waitForCSS(context, dirname, path, callback) {
			if(typeof path == 'function') {
				callback = path;
				path = null;
			}

			// check if file(s) ready
			let ready = true;
			if(path instanceof Array) {
				for(const cssPath of path) {
					if(!isCSSReady(context, dirname, cssPath)) {
						ready = false;
						break;
					}
				}
			}
			else if(typeof path == 'string') {
				if(!isCSSReady(context, dirname, path)) {
					ready = false;
				}
			}
			else if(path != null) {
				throw new TypeError("path must be a string or an Array");
			}

			// finish if ready ;)
			if(ready) {
				callback();
				return;
			}

			// wait a little bit and try again
			browserWrappers.setTimeout(context, () => {
				waitForCSS(context, dirname, path, callback);
			}, 100);
		}

		// unload a CSS tag
		function unloadCSS(context, cssPath) {
			var info = loadedCSS[cssPath];
			if(info && info.tag) {
				info.tag.parentElement.removeChild(info.tag);
				delete loadedCSS[cssPath];
			}
		}

//#endregion


//#region contexts

		// create a new context from a given context
		function createContext(parentContext = null) {
			objParentContext = Object.assign({}, parentContext);
			let context = null;

			let moduleGenerator = {};
			let modules = {};
			for(let moduleName in generatedModules) {
				Object.defineProperty(moduleGenerator, moduleName, {
					get: () => {
						if(modules[moduleName] === undefined) {
							modules[moduleName] = generatedModules[moduleName](context);
						}
						return modules[moduleName];
					}
				});
			}

			context = {
				cwd: toNonNull(objParentContext.cwd, '/'),
				pid: null,
				uid: toNonNull(objParentContext.uid, 0),
				gid: toNonNull(objParentContext.uid, 0),
				umask: toNonNull(objParentContext.umask, 0o022),
				stdin: null,
				stdout: null,
				stderr: null,
				argv: [],
				env: deepCopyObject(toNonNull(objParentContext.env, {})),
				filename: objParentContext.filename,
				process: null,

				timeouts: [],
				intervals: [],
				modules: moduleGenerator,
				loadedModules: {},
				nextThreadID: 1,
				threads: [],
				childContexts: [],
				parentContext: parentContext,

				valid: true,
				invalidating: false,
				exiting: false,

				hasRunningCode: (options) => {
					options = Object.assign({}, options);
					let threadsLength = context.threads.length;
					if(options.ignoringThreads) {
						for(const thread of context.threads) {
							if(options.ignoringThreads.indexOf(thread.id) != -1) {
								threadsLength--;
							}
						}
					}
					if(context.timeouts.length > 0 || context.intervals.length > 0 || threadsLength > 0) {
						return true;
					}
					return false;
				},
				signal: (signal) => {
					const signalName = getSignalName(signal);
					if(signalName != null && context.process != null && context.process.listenerCount(signalName) > 0) {
						try {
							context.process.emit(signalName);
						}
						catch(e) {}
						if(!context.hasRunningCode()) {
							context.invalidate(0, null);
						}
					}
					else {
						context.invalidate(null, signal);
					}
				},
				invalidate: (exitCode, signal) => {
					if(context.valid && !context.invalidating) {
						context.invalidating = true;

						// unload CSS
						if(context.pid != null) {
							for(const cssPath in loadedCSS) {
								var info = loadedCSS[cssPath];
								var index = info.pids.indexOf(context.pid);
								if(index != -1) {
									info.pids.splice(index, 1);
								}
								if(info.pids.length == 0) {
									unloadCSS(context, cssPath);
								}
							}
						}

						// destroy timeouts and intervals
						for(const interval of context.intervals) {
							clearInterval(interval);
						}
						context.intervals = [];
						for(const timeout of context.timeouts) {
							clearTimeout(timeout);
						}
						context.timeouts = [];

						// kill threads
						const threads = context.threads.slice(0);
						for(let thread of threads) {
							if(thread.cancel) {
								try {
									thread.cancel();
								}
								catch(error) {
									console.error(error);
								}
							}
						}

						// kill child contexts
						const childContexts = context.childContexts.slice(0);
						context.childContexts = [];
						for(const childContext of childContexts) {
							if(signal != null) {
								childContext.signal(signal);
							}
							else {
								childContext.signal(signals.SIGHUP);
							}
							if(childContext.valid) {
								// set next valid parent context if child is still alive
								const nextParentContext = context.parentContext;
								while(nextParentContext != null && !nextParentContext.valid) {
									nextParentContext = nextParentContext.parentContext;
								}
								if(nextParentContext == null || nextParentContext.pid === 0) {
									// kill child if there's no valid parent
									childContext.invalidate(null, signals.SIGKILL);
								}
								else {
									// reassign parent context
									childContext.parentContext = nextParentContext;
								}
							}
						}

						// make context invalid
						context.valid = false;

						waitForContextToDie(context, () => {
							// remove from process list
							delete processes[''+context.pid];
						});
					}
				}
			};

			// define built-ins
			let builtIns = null;
			Object.defineProperty(context, 'builtIns', {
				get: () => {
					if(builtIns == null) {
						builtIns = createBuiltIns(context);
					}
					return builtIns;
				}
			});

			// define scope
			let scope = null;
			Object.defineProperty(context, 'scope', {
				get: () => {
					if(scope == null) {
						scope = {
							'const': {
								// browser built-ins
								// timeouts
								setTimeout: (...args) => {
									return browserWrappers.setTimeout(context, ...args);
								},
								clearTimeout: (...args) => {
									return browserWrappers.clearTimeout(context, ...args);
								},
								// intervals
								setInterval: (...args) => {
									return browserWrappers.setInterval(context, ...args);
								},
								clearInterval: (...args) => {
									return browserWrappers.clearInterval(context, ...args);
								},
								// true console
								__console: console,
								// console
								console: Object.defineProperties(Object.assign({}, console), {
									log: {
										value: (...args) => {
											var strings = [];
											for(const arg of args) {
												strings.push(''+arg);
											}
											var stringVal = strings.join(' ');
					
											console.log(...args);
											context.stdout.write(stringVal+'\n');
										},
										enumerable: true,
										writable: false
									},
									warn: {
										value: (...args) => {
											var strings = [];
											for(const arg of args) {
												if(arg instanceof Error) {
													strings.push(''+arg.stack);
												}
												else {
													strings.push(''+arg);
												}
											}
											var stringVal = strings.join(' ');
					
											console.warn(...args);
											context.stderr.write(stringVal+'\n');
										},
										enumerable: true,
										writable: false
									},
									error: {
										value: (...args) => {
											var strings = [];
											for(const arg of args) {
												if(arg instanceof Error) {
													strings.push(''+arg.stack);
												}
												else {
													strings.push(''+arg);
												}
											}
											var stringVal = strings.join(' ');
					
											console.error(...args);
											context.stderr.write(stringVal+'\n');
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
								Promise: createProcPromiseClass(context),
								Buffer: context.builtIns.modules.buffer.Buffer,
								module: new ScriptGlobalAlias('exports'),
								process: context.process,

								// addons
								ThreadKiller: ThreadKiller,
								syscall: (func, ...args) => {
									return syscall(context, func, ...args);
								},
								syslog: (message, options=null) => {
									return syscall(context, 'log', message, options);
								}
							},
							'let': {
								exports: {}
							}
						};
					}
					return scope;
				}
			});

			return context;
		}

		// wait for all threads in a context to die
		function waitForContextToDie(context, callback) {
			if(context.threads.length == 0) {
				callback();
				return;
			}
			setTimeout(() => {
				waitForContextToDie(context, callback);
			}, 100);
		}

		// take a normal function and make it an asyncronous promise
		function makeAsyncPromise(context, task) {
			if(!context.valid) {
				throw new ThreadKiller();
			}
			return wrapThread(context, () => {
				return new Promise((resolve, reject) => {
					browserWrappers.setTimeout(context, () => {
						let retVal = undefined;
						try {
							retVal = task();
						}
						catch(error) {
							if(context.valid) {
								reject(error);
							}
							return;
						}
						if(context.valid) {
							resolve(retVal);
						}
					}, 0);
				});
			}, {rethrowThreadKiller:true});
		}

//#endregion


//#region Process
		function createProcess(context, options={}) {
			const EventEmitter = context.modules.events;
			class Process extends EventEmitter {
				constructor(context, options={}) {
					options = Object.assign({}, options);
					super();
					var argv = context.argv.slice(0);
					Object.defineProperties(this, {
						'argv': {
							value: argv
						},
						'chdir': {
							value: (path) => {
								path = resolveRelativePath(context, path);
								var stats = context.modules.fs.statSync(path);
								if(!stats.isDirectory())
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
								if(code == null) {
									code = 0;
								}
								if(typeof code !== 'number' || !Number.isInteger(code) || code < 0) {
									throw new Error("invalid exit code");
								}
								if(context.exiting) {
									throw new Error("cannot exit process more than once");
								}
								context.exiting = true;
								if(context.valid) {
									// call exit event
									try {
										this.emit('exit', code, null);
									}
									catch(error) {
										console.error(error);
									}
									// end process
									context.invalidate(code, null);
									// throw exit signal
									throw new ExitSignal(code);
								}
								throw new ThreadKiller();
							},
							writable: false
						},
						'kill': {
							value: (pid, signal) => {
								if(!Number.isInteger(pid) || pid < 0) {
									throw new TypeError("pid must be a positive integer");
								}
								if(typeof signal === 'string') {
									var signalNum = signals[signal];
									if(signalNum == null) {
										throw new Error("invalid signal "+signal);
									}
									signal = signalNum;
								}
								if(!Number.isInteger(signal) || signal < 0) {
									throw new Error("signal must be a positive integer or a valid string");
								}
								const killContext = processes[''+pid];
								if(!killContext) {
									throw new Error("pid does not exist");
								}
								else if(context.uid !== 0 && killContext.uid !== context.uid && killContext.gid !== context.gid) {
									throw new Error("pid does not exist");
								}
								killContext.signal(signal);
							},
							writable: false
						},
						'uid': {
							get: () => {
								return context.uid;
							}
						},
						'gid': {
							get: () => {
								return context.gid;
							}
						},
						'pid': {
							get: () => {
								return context.pid;
							}
						},
						'ppid': {
							get: () => {
								return context.parentContext.pid;
							}
						},
						'platform': {
							get: () => {
								return kernelOptions.platform || osName;
							}
						},
						'stdin': {
							get: () => {
								return options.stdin;
							}
						},
						'stdout': {
							get: () => {
								return options.stdout;
							}
						},
						'stderr': {
							get: () => {
								return options.stderr;
							}
						}
					});
				}
			}

			return new Process(context, options);
		}
//#endregion


//#region syscall

		// append information to the system log
		function log(context, message, options) {
			options = Object.assign({}, options);

			var kernelElement = document.getElementById("kernel");
			if(kernelElement != null) {
				const logElement = document.createElement("DIV");
				logElement.textContent = message;
				logElement.style.color = options.color;

				kernelElement.appendChild(logElement);
				kernelElement.scrollTop = kernelElement.scrollHeight;
			}
		}



		// call special kernel functions
		function syscall(context, func, ...args) {
			if(typeof func != 'string') {
				throw new Error("func must be a string");
			}
			func = ''+func;

			if(!context.valid) {
				throw new Error("calling context is not valid");
			}

			var funcParts = func.split('.');
			if(funcParts.length > 2) {
				throw new Error("invalid system call");
			}
			switch(funcParts[0]) {
				case 'log':
					if(funcParts.length > 1) {
						throw new Error("invalid system call");
					}
					return log(context, ...args);

				case 'thread':
					if(funcParts.length > 1) {
						throw new Error("invalid system call");
					}
					const callback = args[0];
					const cancel = args[1];
					const options = Object.assign({}, args[2]);
					if(typeof callback !== 'function') {
						throw new TypeError("callback must be a function");
					}
					if(typeof cancel !== 'function') {
						throw new TypeError("cancel must be a function");
					}
					const retVal = wrapThread(context, callback, {
						...options,
						rethrowThreadKiller: true,
						cancel: cancel
					});
					if(retVal instanceof Promise) {
						return new ProcPromise(context, (resolve, reject) => {
							retVal.then(resolve, reject);
						});
					}
					return retVal;

				default:
					throw new Error("invalid system call");
			}
		}

//#endregion


//#region Generated Modules
		// define kernel modules
		generatedModules = {

		//#region rimraf
			'rimraf': (context) => {
				const fs = context.modules.fs;

				function deleteSync(path, options) {
					if(!fs.existsSync(path)) {
						return;
					}
					if(checkIfDir(context, path)) {
						// delete entries in folder
						const dirEntries = fs.readdirSync(path, {encoding: 'utf8'});
						for(const entry of dirEntries) {
							deleteSync(path+'/'+entry, options);
						}
					}
					else {
						// delete file
						fs.unlinkSync(path);
					}
				}

				function rimrafSync(path, options) {
					deleteSync(path, options);
				}

				function rimraf(path, options, callback) {
					if(typeof options === 'function') {
						callback = options;
						options = {};
					}
					if(!options) {
						options = {};
					}
					makeAsyncPromise(context, () => {
						return rimrafSync(path, options);
					}).then(() => {
						callback(null);
					}).catch((error) => {
						callback(error);
					});
				}

				rimraf.sync = rimrafSync;
				return rimraf;
			},
		//#endregion


		//#region fs
			'fs': (context) => {
				const FS = {};

				const Buffer = context.builtIns.modules.buffer.Buffer;
				const inodePrefix = fsPrefix+'__inode:';
				const entryPrefix = fsPrefix+'__entry:';

				// use inodes to handle creating filesystem entries
				// valid inode types: FILE, DIR, LINK, REMOTE

				//#region fs inode functions

				function createINode(type, info) {
					// validate type
					if(typeof type !== 'string') {
						throw new TypeError("inode type must be a string");
					}
					if(['FILE', 'DIR', 'LINK', 'REMOTE'].indexOf(type) === -1) {
						throw new Error("invalid inode type "+type);
					}
					// find available inode ID
					var id = 1;
					while(true) {
						var item = storage.getItem(inodePrefix+id);
						if(!item) {
							break;
						}
						id++;
					}
					// create inode
					info = Object.assign({uid: context.uid, gid: context.gid, mode: 0o777, encoding: 'utf8'}, info);
					var inode = {
						'type': type,
						'uid': info.uid,
						'gid': info.gid,
						'mode': info.mode,
						'encoding': info.encoding
					};
					if(!Number.isInteger(inode.uid) || inode.uid < 0) {
						throw new Error("invalid uid");
					}
					if(!Number.isInteger(inode.gid) || inode.gid < 0) {
						throw new Error("invalid gid");
					}
					if(!Number.isInteger(inode.mode) || inode.mode < 0 || inode.mode > 1023) {
						throw new Error("invalid mode");
					}
					// store inode
					storage.setItem(inodePrefix+id, JSON.stringify(inode));
					var data = '';
					switch(type) {
						case 'FILE':
						case 'LINK':
						case 'REMOTE':
							data = Buffer.from('', 'utf8');
							break;

						case 'DIR':
							data = {};
							break;
					}
					writeINodeContent(id, data, {noValidate: true});
					return id;
				}

				function getINode(id) {
					var inodeStr = storage.getItem(inodePrefix+id);
					if(!inodeStr) {
						throw new Error("cannot access nonexistant inode "+id);
					}
					return JSON.parse(inodeStr);
				}

				function updateINode(id, info) {
					if(info.type !== undefined) {
						throw new Error("cannot update inode type");
					}
					var inode = getINode(id);
					var type = inode.type;
					var newINode = Object.assign({}, inode);
					newINode = Object.assign(newINode, info);
					newINode = {
						'type': type,
						'uid': inode.uid,
						'gid': inode.gid,
						'mode': inode.mode,
						'encoding': inode.encoding
					};
					storage.setItem(inodePrefix+id, JSON.stringify(inode));
				}

				function destroyINode(id) {
					writeINodeContent(id, null, {noValidate: true});
					storage.removeItem(inodePrefix+id);
				}

				function doesINodeExist(id) {
					if(storage.getItem(inodePrefix+id)) {
						return true;
					}
					return false;
				}


				function readINodeContent(id, options) {
					options = Object.assign({}, options);

					var inode = getINode(id);
					if(!options.noValidate) {
						validatePermission(context, inode.uid, inode.gid, inode.mode, {r:true});
					}

					switch(inode.type) {
						case 'FILE':
							var content = storage.getItem(entryPrefix+id);
							if(content == null) {
								return null;
							}
							if(inode.encoding === options.encoding) {
								return content;
							}
							var buffer = Buffer.from(content, inode.encoding);
							if(options.encoding == null) {
								return buffer;
							}
							return buffer.toString(options.encoding);

						case 'DIR':
							var content = storage.getItem(entryPrefix+id);
							if(content == null) {
								return null;
							}
							return JSON.parse(content);

						case 'LINK':
							var content = storage.getItem(entryPrefix+id);
							if(content == null) {
								return null;
							}
							if(options.encoding == null) {
								return Buffer.from(content);
							}
							else if(options.encoding !== 'utf8') {
								return Buffer.from(content).toString(options.encoding);
							}
							return content;

						case 'REMOTE':
							return Buffer.from(tmpStorage[id]);

						default:
							throw new Error("invalid inode type");
					}
				}

				function writeINodeContent(id, content, options) {
					options = Object.assign({}, options);

					var inode = getINode(id);
					if(!options.noValidate) {
						validatePermission(context, inode.uid, inode.gid, inode.mode, {w:true});
					}

					switch(inode.type) {
						case 'FILE':
							if(content == null) {
								storage.removeItem(entryPrefix+id);
							}
							else {
								if(content instanceof Buffer) {
									if(inode.encoding !== 'base64') {
										updateINode(id, {encoding:'base64'});
									}
									storage.setItem(entryPrefix+id, content.toString('base64'));
								}
								else if(typeof content === 'string') {
									if(options.encoding) {
										if(options.encoding !== inode.encoding) {
											updateINode(id, {encoding: options.encoding});
										}
									}
									else if(inode.encoding !== 'utf8') {
										updateINode(id, {encoding:'utf8'});
									}
									storage.setItem(entryPrefix+id, content);
								}
								else {
									throw new Error("invalid content data");
								}
							}
							break;

						case 'DIR':
							if(content == null) {
								storage.removeItem(entryPrefix+id);
							}
							else {
								if(typeof content !== 'object') {
									throw new TypeError("inode dir content must be an object");
								}
								storage.setItem(entryPrefix+id, JSON.stringify(content));
							}
							break;

						case 'LINK':
							if(content == null) {
								storage.removeItem(entryPrefix+id);
							}
							else {
								var contentStr = content;
								if(content instanceof Buffer) {
									contentStr = content.toString();
								}
								else if(typeof contentStr !== 'string') {
									throw new TypeError("inode link content must be a string or a Buffer");
								}
								storage.setItem(entryPrefix+id, contentStr);
							}
							break;

						case 'REMOTE':
							if(content == null) {
								delete tmpStorage[id];
							}
							else {
								if(!(content instanceof Buffer)) {
									throw new TypeError("inode remote content must be a buffer");
								}
								tmpStorage[id] = Buffer.from(content);
							}
							break;

						default:
							throw new Error("invalid inode type");
					}
				}


				function validatePath(path) {
					if(path instanceof Buffer) {
						path = path.toString('utf8');
					}
					if(typeof path !== 'string') {
						throw new TypeError("path must be a string");
					}
					path = resolveRelativePath(context, path);
					if(!path.startsWith('/')) {
						throw new Error("internal inconsistency: resolved path is not absolute");
					}
					return path;
				}


				function findINode(path) {
					// validate path
					path = validatePath(path);
					// get all path parts
					var pathParts = path.split('/');
					// remove empty path parts
					for(var i=0; i<pathParts.length; i++) {
						if(pathParts[i] == '') {
							pathParts.splice(i, 1);
							i--;
						}
					}
					// traverse directories to find path
					var rootEntry = readINodeContent(0);
					var entry = rootEntry;
					var id = 0;
					var inode = getINode(id);
					for(var i=0; i<pathParts.length; i++) {
						var pathPart = pathParts[i];
						// make sure next part of path exists
						if(entry[pathPart] == null) {
							return null;
						}
						id = entry[pathPart];
						if(i<(pathParts.length-1)) {
							// read next directory
							validatePermission(context, inode.uid, inode.gid, inode.mode, {x:true});
							inode = getINode(id);
							// make sure the entry is a directory
							if(inode.type !== 'DIR') {
								throw new Error("part of path is not a directory");
							}
							entry = readINodeContent(id);
						}
						else {
							// don't read target inode
							inode = null;
							entry = null;
						}
					}
					return id;
				}


				const maxLinkCount = 40;
				function followINodeLink(id, linkCount=0) {
					var inode = getINode(id);
					if(inode.type != 'LINK') {
						return id;
					}
					if(linkCount == maxLinkCount) {
						throw new Error("maximum symbolic links exceeded");
					}
					var path = readINodeContent(id, {encoding:'utf8'});
					var nextId = findINode(path);
					if(nextId == null) {
						return null;
					}
					return followINodeLink(nextId, linkCount+1);
				}

				function findINodeFollowingLinks(path) {
					var id = findINode(path);
					if(id == null) {
						return null;
					}
					return followINodeLink(id, 0);
				}

				//#endregion


				//#region fs path entry functions

				function createPathEntry(path, type, info, options) {
					options = Object.assign({}, options);
					// validate path
					path = validatePath(path);

					// get info about parent directory
					var pathName = context.builtIns.modules.path.basename(path);
					var pathDir = context.builtIns.modules.path.dirname(path);
					var parentId = findINodeFollowingLinks(pathDir);
					if(parentId == null) {
						throw new Error("parent directory does not exist");
					}
					var parentINode = getINode(parentId);
					if(parentINode.type != 'DIR') {
						throw new Error("parent entry is not a directory");
					}
					var parentData = readINodeContent(parentId);

					// ensure path doesn't already exist
					if(parentData[pathName] != null) {
						if(options.onlyIfMissing) {
							return parentData[pathName];
						}
						throw new Error("entry already exists");
					}

					// validate write permissions
					validatePermission(context, parentINode.uid, parentINode.gid, parentINode.mode, {x:true, w: true});
					
					// add entry to parent dir
					var id = createINode(type, info);
					parentData[pathName] = id;
					try {
						writeINodeContent(parentId, parentData);
					}
					catch(error) {
						destroyINode(id);
						throw error;
					}

					// done
					return id;
				}


				function movePathEntry(oldPath, newPath) {
					// validate paths
					oldPath = validatePath(oldPath);
					newPath = validatePath(newPath);

					// get info about parent directory
					function getPathInfo(path) {
						var pathName = context.builtIns.modules.path.basename(path);
						var pathDir = context.builtIns.modules.path.dirname(path);
						var parentId = findINodeFollowingLinks(pathDir);
						if(parentId == null) {
							throw new Error("parent directory does not exist");
						}
						var parentINode = getINode(parentId);
						if(parentINode.type != 'DIR') {
							throw new Error("parent entry is not a directory");
						}
						validatePermission(context, parentINode.uid, parentINode.gid, parentINode.mode, {x:true,w:true});
						var parentData = readINodeContent(parentId);
						return {
							name: pathName,
							dirname: pathDir,
							parentId: parentId,
							parentINode: parentINode,
							parentData: parentData
						};
					}
					var oldInfo = getPathInfo(oldPath);
					var newInfo = getPathInfo(newPath);

					// move from old dir to new dir
					if(oldInfo.parentData[oldInfo.name] == null) {
						throw new Error("entry does not exist");
					}
					if(newInfo.parentData[newInfo.name] != null) {
						throw new Error("destination entry already exists");
					}
					var id = oldInfo.parentData[oldInfo.name];
					delete oldInfo.parentData[oldInfo.name];
					newInfo.parentData[newInfo.name] = id;
					
					// flush updated data
					writeINodeContent(oldInfo.parentId, oldInfo.parentData);
					writeINodeContent(newInfo.parentId, newInfo.parentData);
				}


				function destroyPathEntry(path) {
					// validate path
					path = validatePath(path);

					// get info about the parent directory
					var pathName = context.builtIns.modules.path.basename(path);
					var pathDir = context.builtIns.modules.path.dirname(path);
					var parentId = findINodeFollowingLinks(pathDir);
					if(parentId == null) {
						throw new Error("parent directory does not exist");
					}
					var parentINode = getINode(parentId);
					if(parentINode.type !== 'DIR') {
						throw new Error("parent entry is not a directory");
					}
					var parentData = readINodeContent(parentId);

					// validate write permissions
					validatePermission(context, parentINode.uid, parentINode.gid, parentINode.mode, {x:true,w:true});

					// ensure entry exists
					var id = parentData[pathName];
					if(id == null) {
						throw new Error("entry does not exist");
					}

					// remove entry from parent dir
					var inode = getINode(id);
					if(inode.type === 'DIR') {
						// make sure directory is empty
						var data = readINodeContent(id);
						if(Object.keys(data).length > 0) {
							throw new Error("directory is not empty");
						}
					}
					delete parentData[pathName];
					writeINodeContent(parentId, parentData);
					destroyINode(id);
				}

				//#endregion


				//#region fs public constants

				const constants = {
					COPYFILE_EXCL: 0b00000000000000000000000000000001,
					F_OK: 0,
					X_OK: 0x01,
					W_OK: 0x02,
					R_OK: 0x04
				};
				
				Object.defineProperty(FS, 'constants', {
					value: Object.assign({}, constants),
					writable: false
				});

				//#endregion

				//#region fs public types

				class Stats
				{
					constructor(id) {
						var inode = getINode(id);

						Object.defineProperties(this, {
							// attributes
							ino: {
								value: id,
								writable: false
							},
							mode: {
								value: inode.mode,
								writable: false
							},
							uid: {
								value: inode.uid,
								writable: false
							},
							gid: {
								value: inode.gid,
								writable: false
							},

							// functions
							isBlockDevice: {
								value: () => {
									return false;
								},
								writable: false
							},
							isCharacterDevice: {
								value: () => {
									return false;
								},
								writable: false
							},
							isDirectory: {
								value: () => {
									if(inode.type === 'DIR')
									{
										return true;
									}
									return false;
								},
								writable: false
							},
							isFIFO: {
								value: () => {
									return false;
								},
								writable: false
							},
							isFile: {
								value: () => {
									if(inode.type === 'FILE' || inode.type === 'REMOTE')
									{
										return true;
									}
									return false;
								},
								writable: false
							},
							isSocket: {
								value: () => {
									return false;
								},
								writable: false
							},
							isSymbolicLink: {
								value: () => {
									if(inode.type === 'LINK')
									{
										return true;
									}
									return false;
								},
								writable: false
							}
						});
					}
				}

				FS.Stats = Stats;

				//#endregion


				//#region fs public functions

				function access(path, mode=0, callback) {
					if(typeof mode === 'function') {
						callback = mode;
						mode = undefined;
					}
					if(typeof callback !== 'function') {
						throw new TypeError("callback function is required");
					}

					makeAsyncPromise(context, () => {
						return accessSync(path, mode);
					}).then(() => {
						callback(null);
					}).catch((error) => {
						callback(error);
					});
				}

				function accessSync(path, mode=0) {
					if(!mode) {
						mode = 0;
					}
					var id = findINode(path);
					if(id == null) {
						throw new Error(path+" does not exist");
					}
					var inode = getINode(id);
					var neededPerms = {r:false,w:false,e:false};
					if((mode & constants.R_OK) == constants.R_OK) {
						neededPerms.r = true;
					}
					if((mode & constants.W_OK) == constants.W_OK) {
						neededPerms.w = true;
					}
					if((mode & constants.X_OK) == constants.X_OK) {
						neededPerms.x = true;
					}
					validatePermission(context, inode.uid, inode.gid, inode.mode, neededPerms);
				}

				FS.access = access;
				FS.accessSync = accessSync;


				function copyFile(src, dest, flags, callback) {
					if(typeof flags === 'function') {
						callback = flags;
						flags = undefined;
					}
					if(typeof callback !== 'function') {
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

				function copyFileSync(src, dest, flags) {
					if(flags == null) {
						flags = 0;
					}
					if(typeof flags !== 'number' || !Number.isInteger(flags)) {
						throw new TypeError("flags must be an integer");
					}

					src = validatePath(src);
					dest = validatePath(dest);

					// validate input file
					var srcId = findINode(src);
					var srcRealId = findINodeFollowingLinks(src);
					if(srcId == null) {
						throw new Error("source file does not exist");
					}
					var srcINode = getINode(srcId);
					var srcRealINode = getINode(srcRealId);
					if(srcINode.type === 'DIR' || srcRealINode.type === 'DIR') {
						throw new Error("source path is a directory");
					}

					// read destination inode
					var destId = findINode(dest);
					let data = null;
					if(destId == null) {
						// read src inode content
						data = readINodeContent(srcId);
						// create destination
						destId = createPathEntry(dest, srcINode.type, {});
					}
					else {
						if((flags & constants.COPYFILE_EXCL) === constants.COPYFILE_EXCL) {
							throw new Error("destination already exists");
						}
						var destINode = getINode(destId);
						if(destINode.type === 'DIR') {
							throw new Error("destination is a directory");
						}
						else if(destINode.type === 'FILE') {
							data = readINodeContent(srcRealId);
						}
						else {
							data = readINodeContent(srcId);
						}
					}
					writeINodeContent(destId, data);
				}

				FS.copyFile = copyFile;
				FS.copyFileSync = copyFileSync;


				function exists(path, callback) {
					if(typeof callback !== 'function') {
						throw new TypeError("callback function is required");
					}

					makeAsyncPromise(context, () => {
						return existsSync(path);
					}).then((exists) => {
						callback(exists);
					}).catch((error) => {
						callback(false);
					});
				}

				function existsSync(path, callback) {
					path = validatePath(path);
					try {
						var id = findINode(path);
						if(id == null) {
							return false;
						}
						return true;
					}
					catch(error) {
						return false;
					}
				}

				FS.exists = exists;
				FS.existsSync = existsSync;


				function mkdir(path, mode, callback)
				{
					if(typeof mode === 'function') {
						callback = mode;
						mode = null;
					}
					if(typeof callback !== 'function') {
						throw new TypeError("callback function is required");
					}

					makeAsyncPromise(context, () => {
						return mkdirSync(path, mode);
					}).then(() => {
						callback(null);
					}).catch((error) => {
						callback(error);
					});
				}

				function mkdirSync(path, mode)
				{
					if(mode == null) {
						mode = 0o777;
					}
					createPathEntry(path, 'DIR', {mode: mode});
				}

				FS.mkdir = mkdir;
				FS.mkdirSync = mkdirSync;


				function readdir(path, options, callback) {
					if(typeof options === 'function') {
						callback = options;
						options = null;
					}
					if(typeof callback !== 'function') {
						throw new TypeError("callback function is required");
					}

					makeAsyncPromise(context, () => {
						return readdirSync(path, options);
					}).then((data) => {
						callback(null, data);
					}).catch((error) => {
						callback(error, null);
					});
				}

				function readdirSync(path, options) {
					options = Object.assign({}, options);
					var id = findINodeFollowingLinks(path);
					if(id == null) {
						throw new Error("directory does not exist");
					}
					var content = readINodeContent(id);
					var data = [];
					for(const fileName in content) {
						data.push(fileName);
					}
					data.sort();
					return data;
				}

				FS.readdir = readdir;
				FS.readdirSync = readdirSync;


				function readFile(path, options, callback) {
					if(typeof options === 'function') {
						callback = options;
						options = null;
					}
					if(typeof callback !== 'function') {
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

				function readFileSync(path, options) {
					options = Object.assign({}, options);
					path = validatePath(path);
					var id = findINodeFollowingLinks(path);
					if(id == null) {
						throw new Error("file does not exist");
					}
					return readINodeContent(id, {encoding: options.encoding});
				}

				FS.readFile = readFile;
				FS.readFileSync = readFileSync;


				function rename(oldPath, newPath, callback) {
					if(typeof callback !== 'function') {
						throw new TypeError("callback function is required");
					}

					makeAsyncPromise(context, () => {
						return renameSync(oldPath, newPath);
					}).then(() => {
						callback(null);
					}).catch((error) => {
						callback(error);
					});
				}

				function renameSync(oldPath, newPath) {
					movePathEntry(oldPath, newPath);
				}

				FS.rename = rename;
				FS.renameSync = renameSync;


				function rmdir(path, callback) {
					if(typeof callback !== 'function') {
						throw new TypeError("callback function is required");
					}

					makeAsyncPromise(context, () => {
						return rmdirSync(path);
					}).then(() => {
						callback(null);
					}).catch((error) => {
						callback(error);
					});
				}

				function rmdirSync(path) {
					path = validatePath(path);
					var id = findINode(path);
					if(id == null) {
						throw new Error("directory does not exist");
					}
					var inode = getINode(id);
					if(inode.type !== 'DIR') {
						throw new Error("path is not a directory");
					}
					destroyPathEntry(path);
				}

				FS.rmdir = rmdir;
				FS.rmdirSync = rmdirSync;


				function stat(path, callback) {
					if(typeof callback !== 'function') {
						throw new TypeError("callback function is required");
					}

					makeAsyncPromise(context, () => {
						return statSync(path);
					}).then((stats) => {
						callback(null, stats);
					}).catch((error) => {
						callback(error, null);
					});
				}

				function statSync(path) {
					path = validatePath(path);
					var id = findINode(path);
					if(id == null) {
						throw new Error("file does not exist");
					}
					return new Stats(id);
				}

				FS.stat = stat;
				FS.statSync = statSync;


				function unlink(path, callback) {
					if(typeof callback !== 'function') {
						throw new TypeError("callback function is required");
					}

					makeAsyncPromise(context, () => {
						return unlinkSync(path);
					}).then(() => {
						callback(null);
					}).catch((error) => {
						callback(error);
					});
				}

				function unlinkSync(path) {
					path = validatePath(path);
					var id = findINode(path);
					if(id == null) {
						throw new Error("file does not exist");
					}
					var inode = getINode(id);
					if(inode.type === 'DIR') {
						throw new Error("path cannot be a directory");
					}
					destroyPathEntry(path);
				}

				FS.unlink = unlink;
				FS.unlinkSync = unlinkSync;


				function writeFile(path, data, options, callback) {
					if(typeof options === 'function') {
						callback = options;
						options = null;
					}
					if(typeof callback !== 'function') {
						throw new TypeError("callback function is required");
					}

					makeAsyncPromise(context, () => {
						return writeFileSync(path, data, options);
					}).then(() => {
						callback(null);
					}).catch((error) => {
						callback(error);
					});
				}

				function writeFileSync(path, data, options) {
					options = Object.assign({}, options);
					path = validatePath(path);
					var id = createPathEntry(path, 'FILE', {mode: options.mode || 0o666}, {onlyIfMissing: true});
					var realId = followINodeLink(id);
					if(realId == null) {
						throw new Error("broken symbolic link");
					}
					writeINodeContent(realId, data, {encoding: options.encoding});
				}

				FS.writeFile = writeFile;
				FS.writeFileSync = writeFileSync;

				//#endregion

				return FS;
			},
		//#endregion


		//#region child_process
			'child_process': (context) => {
				const child_process = {};

				const EventEmitter = context.modules.events;

				class ChildProcess extends EventEmitter {
					constructor(path, args=[], options={}) {
						var startTime = new Date().getTime();
						super();

						// validate parameters
						if(typeof path !== 'string') {
							throw new TypeError("path must be a string");
						}
						if(!(args instanceof Array)) {
							throw new TypeError("args must be an Array");
						}
						for(const arg of args) {
							if(typeof arg !== 'string') {
								throw new TypeError("args must be an array of strings");
							}
						}
						options = Object.assign({}, options);

						// create new context
						const childContext = createContext(context);
						// get new process PID
						childContext.pid = pidCounter;

						// define general process info
						var argv0 = path;

						// validate options
						if(options.cwd != null) {
							if(typeof options.cwd !== 'string') {
								throw new TypeError("options.cwd must be a string");
							}
							childContext.cwd = options.cwd;
						}
						if(options.env != null) {
							if(typeof options.env !== 'object') {
								throw new TypeError("options.env must be an object")
							}
							childContext.env = Object.assign(childContext.env, deepCopyObject(options.env));
						}
						if(options.argv0 != null) {
							if(typeof options.argv0 !== 'string') {
								throw new TypeError("options.argv0 must be a string");
							}
							argv0 = options.argv0;
						}
						if(options.uid != null) {
							if(!Number.isInteger(options.uid) || options.uid < 0) {
								throw new TypeError("options.uid must be a positive integer");
							}
						}
						if(options.gid != null) {
							if(!Number.isInteger(options.gid) || options.gid < 0) {
								throw new TypeError("options.gid must be a positive integer");
							}
						}

						// apply options
						childContext.argv = [argv0].concat(args);

						// build I/O streams
						const stdin = createTwoWayStream(context, childContext, {threading: true});
						const stdout = createTwoWayStream(childContext, context, {threading: true});
						const stderr = createTwoWayStream(childContext, context, {threading: true});
						childContext.stdin = stdin.output;
						childContext.stdout = stdout.input;
						childContext.stderr = stderr.input;

						// add invalidation hook
						const childContextInvalidate = childContext.invalidate;
						childContext.invalidate = (exitCode, signal) => {
							const wasValid = childContext.valid && !childContext.invalidating;
							if(wasValid) {
								stdin.input.destroy();
								stdin.output.destroy();
								stdout.input.destroy();
								stdout.output.destroy();
								stderr.input.destroy();
								stderr.output.destroy();
							}
							// invalidate
							childContextInvalidate(exitCode, signal);
							if(wasValid) {
								// close I/O
								if(exitCode != null || signal != null) {
									// wait for next queue to emit event
									browserWrappers.setTimeout(context, () => {
										this.emit('exit', exitCode, signal);
									}, 0);
								}
							}
						}

						// TODO apply all properties
						Object.defineProperties(this, {
							stdin: {
								value: stdin.input,
								writable: false
							},
							stdout: {
								value: stdout.output,
								writable: false
							},
							stderr: {
								value: stderr.output,
								writable: false
							},
							kill: {
								value:(signal) => {
									if(signal == null) {
										signal = signals.SIGTERM;
									}
									else if(typeof signal === 'string') {
										var signalNum = signals[signal];
										if(signalNum == null) {
											throw new Error("invalid signal "+signal);
										}
										signal = signalNum;
									}
									if(!Number.isInteger(signal) || signal < 0) {
										throw new TypeError("signal must be a positive integer or a valid string");
									}
									childContext.signal(signal);
								},
								writable: false
							}
						});

						// try to start the process
						try {
							if(options.uid != null) {
								if(options.uid !== context.uid && context.uid !== 0) {
									throw new Error("Permission Denied: cannot set uid of child process from underprivileged user");
								}
								childContext.uid = options.uid;
							}
							if(options.gid != null) {
								// TODO check if uid is in gid group
								if(childContext.gid !== 0 && options.gid === 0) {
									throw new Error("Permission Denied: cannot join root group from underprivileged user");
								}
								childContext.gid = options.gid;
							}

							// get full module path
							var paths = [];
							if(context.env && context.env.paths) {
								paths = context.env.paths;
							}
							const filename = findModulePath(context, paths, context.cwd, path, {dirExtensions: kernelOptions.binDirExtensions});
							const dirname = context.builtIns.modules.path.dirname(filename);

							context.modules.fs.accessSync(filename, context.modules.fs.constants.X_OK);
							childContext.filename = filename;

							// set PID and increment
							pidCounter++;
							Object.defineProperty(this, 'pid', {
								get: () => {
									return childContext.pid;
								}
							});

							// add process
							childContext.process = createProcess(childContext, {
								stdin: stdin.output,
								stdout: stdout.input,
								stderr: stderr.input
							});

							// attach child process
							if(!options.detached) {
								childContext.parentContext = context;
								context.childContexts.push(childContext);
							}
							else {
								const baseContext = processes['1'];
								childContext.parentContext = baseContext;
								baseContext.childContexts.push(childContext);
							}
							// add process to list
							processes[''+childContext.pid] = childContext;

							// create child process scope in next queue
							browserWrappers.setTimeout(childContext, () => {

								// create process scope
								const scope = Object.assign({}, childContext.scope);
								scope.const.__dirname = dirname;
								scope.const.__filename = filename;
								scope.const.require = Object.defineProperties((path) => {
									return require(childContext, scope, dirname, path);
								}, {
									resolve: {
										value: (path) => {
											return require.resolve(childContext, dirname, path);
										},
										enumerable: true,
										writable: false
									}
								}),
								scope.const.requireCSS = Object.defineProperties((path) => {
									return requireCSS(childContext, dirname, path);
								}, {
									resolve: {
										value: (path) => {
											return resolveCSSPath(childContext, dirname, path);
										},
										writable: false
									},
									wait: {
										value: (path, callback) => {
											return waitForCSS(childContext, dirname, path, callback);
										},
										writable: false
									},
									ready: {
										value: (path) => {
											return isCSSReady(childContext, dirname, path);
										},
										writable: false
									}
								}),

								// start the process in the next queue
								browserWrappers.setTimeout(childContext, () => {
									// start the process
									wrapThread(childContext, () => {
										requireFile(childContext, filename, scope);
									}, {rethrowThreadKiller:true});
								}, 0);
							}, 0);
						}
						catch(error) {
							childContext.invalidate();
							// send error in the next queue
							browserWrappers.setTimeout(context, () => {
								// send error
								this.emit('error', error);
							}, 0);
						}
					}
				}

				child_process.ChildProcess = ChildProcess;



				function spawn(command, args=[], options=null) {
					if(args != null && typeof args === 'object' && !(args instanceof Array)) {
						options = args;
						args = [];
					}
					if(typeof command !== 'string') {
						throw new TypeError("command must be a string");
					}
					return new ChildProcess(command, args, options);
				}

				child_process.spawn = spawn;

				return child_process;
			},
		//#endregion


		//#region events
			'events': (context) => {
				const EventEmitter = context.builtIns.modules.events;

				const superEmit = EventEmitter.prototype.emit;
				EventEmitter.prototype.emit = function(eventName, ...args) {
					// ensure context is valid
					if(!context.valid) {
						this.removeAllListeners();
						return false;
					}
					// send event
					return wrapThread(context, () => {
						return superEmit.call(this, eventName, ...args);
					}, {rethrowThreadKiller:true});
				}

				return EventEmitter;
			},
		//#endregion


		//#region util
			'util': (context) => {
				const util = context.builtIns.modules.util;

				util.promisify = (func) => {
					return (...args) => {
						return new Promise((resolve, reject) => {
							func(...args, (error, result) => {
								if(error) {
									reject(error);
								}
								else {
									resolve(result);
								}
							});
						});
					};
				};

				return util;
			},
		//#endregion


		//#region download
			'misc': (context) => {
				return {
					download: (url) => {
						return new ProcPromise(context, (resolve, reject) => {
							wrapThread(context, () => {
								return download(url);
							}).then(resolve, reject);
						});
					}
				};
			}
		//#endregion download
		};
//#endregion


//#region kernel script preparation

		// download persistjs
		var persistJSPromise = new Promise((resolve, reject) => {
			download('https://raw.githubusercontent.com/jeremydurham/persist-js/master/persist-min.js').then((data) => {
				var scope = {
					'let': {
						Persist: null
					}
				};
				runScript(null, data, scope);
				const Persist = scope.let.Persist;
				Persist.remove('cookie');
				storage = new (function(){
					var store = new Persist.Store(osName);

					this.setItem = (key, value) => {
						store.set(key, value);
					};

					this.getItem = (key) => {
						return store.get(key);
					};

					this.removeItem = (key) => {
						store.remove(key);
					};
				});
				resolve();
			}).catch((error) => {
				reject(error);
			});
		});


		// download built-in node modules / classes
		var builtInsPromise = downloadBuiltIns();

//#endregion


//#region boot / shutdown / reboot
		// bootup method
		let booted = false;
		async function boot() {
			try {
				if(booted) {
					throw new Error("system is already booted");
				}
				if(!kernelOptions.boot || !kernelOptions.boot.url || !kernelOptions.boot.path) {
					throw new Error("boot.url and boot.path must be specified in options");
				}
				booted = true;
				const path = kernelOptions.boot.path;
				const url = kernelOptions.boot.url;
				log(null, "starting boot...");
				log(null, "downloading persistjs");
				log(null, "downloading built-ins");
				log(null, "downloading boot data");
				// create promise for boot data
				var bootDataPromise = download(url);
				// wait for builtins to download
				await persistJSPromise;
				// ensure the root filesystem has been created
				if(!storage.getItem(fsPrefix+'__inode:0')) {
					storage.setItem(fsPrefix+'__inode:0', JSON.stringify({type:'DIR',uid:0,gid:0,mode:0o754}));
					storage.setItem(fsPrefix+'__entry:0', JSON.stringify({}));
				}
				// wait for built-ins to download
				await builtInsPromise;
				log(null, "built-ins downloaded");
				// create root context
				rootContext = createContext(null);
				rootContext.pid = 0;
				rootContext.process = createProcess(rootContext);
				// wait for boot data to download
				const data = await bootDataPromise;
				log(null, "boot data downloaded");
				wrapThread(rootContext, async () => {
					// write boot data to path
					makeLeadingDirs(rootContext, path);
					const util = rootContext.modules.util;
					await util.promisify(rootContext.modules.fs.writeFile)(path, data, {mode: 0o700});
					// execute boot file
					log(null, "booting...");
					await new Promise((resolve, reject) => {
						const initProc = rootContext.modules.child_process.spawn(path);
						if(initProc.pid == null) {
							initProc.on('error', (error) => {
								console.error(error);
								reject(error);
							});
						}
						initProc.on('exit', (code, signal) => {
							resolve();
						});
					});
				});
			}
			catch(error) {
				log(null, "unable to boot from kernel:", {color: 'red'});
				log(null, error.toString(), {color: 'red'});
				console.error(error);
				throw error;
			}
		};

//#endregion


		// apply kernel properties
		this.boot = boot;
		this.require = require;

	// end kernel class
	}

	return Kernel;
// end kernel sandbox
})();

// end evalScript + kernel sandbox
})();