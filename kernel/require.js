
const {
	checkIfFile,
	checkIfDir,
	resolveRelativePath
} = await krequire('kernel/util.js');
const {
	wrapThread,
	ThreadKiller,
	ProcPromise
} = await krequire('kernel/process/thread.js');



//#region Module Resolution

// resolve a module's main js file from a folder
const resolveModuleFolder = (context, path) => {
	const Path = context.kernelModules.require('path');
	const FS = context.kernelModules.require('fs');

	const packagePath = path+'/package.json';
	if(checkIfFile(context, packagePath)) {
		var packageInfo = JSON.parse(FS.readFileSync(packagePath, {encoding:'utf8'}));
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
		return Path.join(path, mainFile);
	}
	const possibleIndexFiles = ['index.js'];
	if(kernel.options.scriptExtensions) {
		for(const scriptExt of kernel.options.scriptExtensions) {
			possibleIndexFiles.push('index.'+scriptExt);
		}
	}
	for(let indexFileName of possibleIndexFiles) {
		let indexPath = Path.join(path, indexFileName);
		if(checkIfFile(context, indexPath)) {
			return indexPath;
		}
	}
	return null;
}


// find a valid module path from the given context, base path, and path
const resolveModulePath = (context, basePath, path, options=null) => {
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
	if(kernel.options.scriptExtensions) {
		for(const scriptExt of kernel.options.scriptExtensions) {
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
const findModulePath = (context, basePaths, dirname, path, options=null) => {
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



//#region require

// determine the interpreter for the file
const getInterpreter = (context, type, path) => {
	path = resolveRelativePath(context, path);
	if(kernel.options.interpreters) {
		for(const interpreter of kernel.options.interpreters) {
			if(interpreter.type === type && interpreter.check(path)) {
				return interpreter;
			}
		}
	}
	return undefined;
}



// require a script into the specified context
const requireScript = (context, mimeType, scope, script) => {
	// TODO require script
};



// create a new scope with the given context and filename
const createScope = (context, filename, moduleData) => {
	const Path = context.kernelModules.require('path');
	const dirname = Path.dirname(filename);

	const { Buffer } = context.kernelModules.require('buffer');
	const timers = context.kernelModules.require('timers');
	const process = context.kernelModules.require('process');
	const { URL, URLSearchParams } = context.kernelModules.require('url');
	const { syscall, syslog } = context.kernelModules.require('syscall');

	// create scope
	let scope = Object.defineProperties({}, {
		__filename: {value: filename, writable: false},
		__dirname: {value: dirname, writable: false},

		// true console
		__console: {value: console},
		// console
		console: {
			value: Object.defineProperties(Object.assign({}, console), {
				log: {
					value: (...args) => {
						var strings = [];
						for(const arg of args) {
							strings.push(''+arg);
						}
						var stringVal = strings.join(' ');

						console.log(...args);
						if(context.stdout) {
							context.stdout.writer.write(stringVal+'\n');
						}
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
						if(context.stderr) {
							context.stderr.writer.write(stringVal+'\n');
						}
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
						if(context.stderr) {
							context.stderr.writer.write(stringVal+'\n');
						}
					},
					enumerable: true,
					writable: false
				},
				memory: {
					get: () => {
						return console.memory;
					}
				}
			})
		},
		exports: {
			get:() => {return moduleData.exports},
			set:(value) => {moduleData.exports = value}
		},
		global: {value: context.global, writable: false},
		module: {
			value: Object.defineProperties({}, {
				exports: {
					get:() => {return moduleData.exports},
					set:(value) => {moduleData.exports = value}
				}
			}),
			writable: false
		},

		setTimeout: {value: timers.setTimeout},
		clearTimeout: {value: timers.clearTimeout},
		setInterval: {value: timers.setInterval},
		clearInterval: {value: timers.clearInterval},
		setImmediate: {value: timers.setImmediate},
		clearImmediate: {value: timers.clearImmediate},

		process: {value: process},

		require: {
			value: Object.defineProperties((path) => {
				return require(context, scope, dirname, path);
			}, {
				resolve: {
					value: (path) => {
						return require.resolve(context, dirname, path);
					},
					writable: false
				}
			}),
		},

		requireCSS: {
			value: Object.defineProperties((path) => {
				return requireCSS(context, dirname, path);
			}, {
				resolve: {
					value: (path) => {
						return resolveCSSPath(context, dirname, path);
					},
					writable: false
				},
				wait: {
					value: (path, callback) => {
						return waitForCSS(context, dirname, path, callback);
					},
					writable: false
				},
				ready: {
					value: (path) => {
						return isCSSReady(context, dirname, path);
					},
					writable: false
				}
			})
		},
		
		syscall: {value: syscall},
		syslog: {value: syslog}
	});

	scope = Object.assign(scope, {
		Buffer,
		Promise: ProcPromise,
		ThreadKiller,
		URL,
		URLSearchParams
	});

	return scope;
};



// require a file into the specified context
const requireFile = (context, path) => {
	const fs = context.kernelModules.require('fs');

	// read code
	path = resolveRelativePath(context, path);
	let code = fs.readFileSync(path, {encoding:'utf8'});
	// transform code with interpreter if necessary
	const interpreter = getInterpreter(context, 'script', path);
	if(interpreter) {
		if(typeof interpreter.transform !== 'function') {
			throw new TypeError("interpreter.transform must be a function");
		}
		code = interpreter.transform(code, context);
	}

	const moduleData = {exports:{}};

	const scope = createScope(context, path, moduleData);

	// run code
	kernel.runScript(code, scope);

	return moduleData.exports;
}





// handle node's 'require' function
const require = (context, parentScope, dirname, path) => {
	// TODO validate input
	// check if already loaded module
	if(path in context.modules) {
		return context.modules[path];
	}
	else {
		try {
			if(['builtins', 'process'].indexOf(path) !== -1) {
				throw new Error("cannot use protected kernel modules");
			}
			let moduleExports = context.kernelModules.require(path);
			context.modules[path] = moduleExports;
			return moduleExports;
		}
		catch(e) {}
	}

	const fs = context.kernelModules.require('fs');

	// get full module path
	let basePaths =
		(kernel.options.libPaths || [])
		.concat(kernel.options.privateLibPaths || []);
	let modulePath = findModulePath(context, basePaths, dirname, path, {dirExtensions: kernel.options.libDirExtensions});

	// check if library is shared
	let moduleContext = context;
	let moduleContainer = context.modules;

	// load library rules if there are any
	let libRules = {};
	// TODO ensure the librules file is owned by the same user as the library
	let libRulesExist = true;
	const libRulesPath = modulePath+'.librules';
	try {
		fs.accessSync(libRulesPath);
	}
	catch(error) {
		libRulesExist = false;
	}
	if(libRulesExist) {
		var libRulesFile = fs.readFileSync(libRulesPath, {encoding:'utf8'});
		libRules = JSON.parse(libRulesFile);
		if(!libRules) {
			libRules = {};
		}
	}

	// check library rules
	if(libRules.shared) {
		moduleContainer = kernel.sharedModules;
		// TODO ensure the file is owned by root
		if(!moduleContainer[modulePath] && context.uid != 0) {
			throw new Error("cannot perform initial load of globally shared library as non-root");
		}
		moduleContext = kernel.rootContext;
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
		const filename = parentScope.__filename;
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
	if(modulePath in moduleContainer) {
		return moduleContainer[modulePath];
	}

	let moduleExports = null;
	// require file
	try {
		moduleExports = requireFile(moduleContext, modulePath);
	}
	catch(error) {
		console.error("unable to require "+path, error);
		throw error;
	}

	// save exported module
	moduleContainer[modulePath] = moduleExports;

	// return exported module
	return moduleExports;
}


// resolves the path to a given module
require.resolve = (context, dirname, path) => {
	// check if loaded or built-in module
	if(context.modules[path]) {
		return path;
	}
	try {
		context.kernelModules.require(path);
		return path;
	}
	catch(e) {};
	// get full module path
	let basePaths =
		(kernel.options.libPaths || [])
		.concat(kernel.options.privateLibPaths || []);
	return findModulePath(context, basePaths, dirname, path, {dirExtensions: kernel.options.libDirExtensions});
}

//#endregion




//#region requireCSS

// resolve a required CSS file
const resolveCSSPath = (context, dirname, path) => {
	// resolve full path
	var cssPath = resolveRelativePath(context, path, dirname);

	// resolve actual css file path
	var testExtensions = ['', '.css'];
	if(kernel.options.styleExtensions) {
		for(const extension of kernel.options.styleExtensions) {
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
const requireCSS = (context, dirname, path) => {
	let cssPath = resolveCSSPath(context, dirname, path);

	const fs = context.kernelModules.require('fs');

	// check if css already loaded
	if(kernel.loadedCSS[cssPath]) {
		// add process PID if necessary
		var info = kernel.loadedCSS[cssPath];
		if(info.pids.indexOf(context.pid) === -1) {
			info.pids.push(context.pid);
		}
		kernel.loadedCSS[cssPath] = info;
		return new ProcPromise((resolve, reject) => {
			waitForCSS(context, dirname, cssPath, () => {
				if(context.valid) {
					if(kernel.loadedCSS[cssPath].error) {
						reject(kernel.loadedCSS[cssPath].error);
						return;
					}
					resolve();
				}
			})
		});
	}

	// read css data
	let cssData = fs.readFileSync(cssPath, {encoding: 'utf8'});

	// TODO parse out special CSS functions

	// add style tag to page
	let head = document.querySelector('head');
	let styleTag = document.createElement("STYLE");
	styleTag.type = "text/css";
	head.appendChild(styleTag);

	// save tag
	kernel.loadedCSS[cssPath] = {
		pids: [context.pid],
		tag: styleTag,
		ready: false
	};

	// interpret css
	let cssPromise = null;
	let interpreter = getInterpreter(context, 'style', cssPath);
	if(interpreter) {
		let transformedCSS = interpreter.transform(cssData, context);
		if(transformedCSS instanceof Promise) {
			cssPromise = transformedCSS;
		}
		else {
			cssPromise = Promise.resolve(transformedCSS);
		}
	}
	else {
		// apply plain content
		cssPromise = Promise.resolve(cssData);
	}

	// add path to context's loaded CSS
	context.loadedCSS.push(cssPath);

	// add CSS to page when finished parsing
	return wrapThread(context, {
		name: 'requireCSS',
		rethrowThreadKiller: true
	}, async () => {
		try {
			let cssData = await cssPromise;
			if(!kernel.loadedCSS[cssPath]) {
				return;
			}
			styleTag.textContent = cssData;
			kernel.loadedCSS[cssPath].ready = true;
		}
		catch(error) {
			console.error("failed to parse "+path+": "+error.message);
			if(!kernel.loadedCSS[cssPath]) {
				return;
			}
			kernel.loadedCSS[cssPath].error = error;
			kernel.loadedCSS[cssPath].ready = true;
			throw error;
		}
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

		return kernel.loadedCSS[cssPath].ready;
	}
	else {
		// check for all CSS files used by this context
		for(const cssPath in kernel.loadedCSS) {
			var info = kernel.loadedCSS[cssPath];
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
	else if(path == null) {
		if(context.loadedCSS) {
			for(const cssPath of context.loadedCSS) {
				if(!isCSSReady(context, '/', cssPath)) {
					ready = false;
					break;
				}
			}
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
	const { setTimeout } = context.kernelModules.require('timers');
	setTimeout(() => {
		waitForCSS(context, dirname, path, callback);
	}, 100);
}

// unload a CSS tag
function unloadCSS(cssPath) {
	var info = kernel.loadedCSS[cssPath];
	if(info && info.tag) {
		info.tag.parentElement.removeChild(info.tag);
		delete kernel.loadedCSS[cssPath];
	}
}

//#endregion



// apply kernel functions
kernel.require = require;
kernel.requireCSS = requireCSS;




// export
module.exports = {
	findModulePath,
	getInterpreter,
	requireFile,
	require,
	requireCSS,
	unloadCSS
};
