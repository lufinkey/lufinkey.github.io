
// a dictionary of ModuleRetrievers
let modules = {};

// function to resolve the path to a specified module
function resolveModulePath(path)
{
	return path+'.js?v='+(Math.random()*999999999);
}

// function to handle loading a module
const loadModule = function(scriptPath)
{
	// resolve the module path
	var fullScriptPath = resolveModulePath(scriptPath);
	// check if module retriever hasn't already been added
	if(!modules[fullScriptPath])
	{
		// add the module
		modules[fullScriptPath] = new ModuleRetriever(fullScriptPath);
	}

	// return a promise to retrieve the module
	return modules[fullScriptPath].retrieve();
}

// class to handle retrieving module for multiple dependents
class ModuleRetriever
{
	constructor(scriptPath)
	{
		console.log("loading module "+scriptPath);

		this.promiseCallbacks = [];
		this.retrieved = false;
		this.module = null;
		this.error = null;

		// send request to retrieve module
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = () => {
			if(xhr.readyState == 4)
			{
				if(xhr.status == 200)
				{
					// attempt to load the module's script
					var scriptCode = xhr.responseText;
					loadModuleScript(scriptPath, scriptCode).then((module) => {
						// resolve with the module
						this.resolve(module);
					}).catch((error) => {
						this.reject(error);
					});
				}
				else
				{
					this.reject(new Error("unable to load script at "+scriptPath));
				}
			}
		};
		xhr.open("GET", scriptPath);
		xhr.send();
	}

	resolve(module)
	{
		if(this.retrieved)
		{
			throw new Error("cannot resolve/reject a ModuleRetriever more than once");
		}
		this.retrieved = true;
		this.module = module;
		var promises = this.promiseCallbacks.slice(0);
		this.promiseCallbacks = [];
		for(const promise of promises)
		{
			promise.resolve(this.module);
		}
	}

	reject(error)
	{
		if(this.retrieved)
		{
			throw new Error("cannot resolve/reject a ModuleRetriever more than once");
		}
		this.retrieved = true;
		this.error = error;
		var promises = this.promiseCallbacks.slice(0);
		this.promiseCallbacks = [];
		for(const promise of promises)
		{
			promise.reject(this.error);
		}
	}

	retrieve()
	{
		return new Promise((resolve, reject) => {
			if(this.retrieved)
			{
				if(this.error)
				{
					reject(this.error);
				}
				else
				{
					resolve(this.module);
				}
				return;
			}

			this.promiseCallbacks.push({resolve: resolve, reject: reject});
		});
	}
}

// function to handle loading a module's script and returning the module
function loadModuleScript(scriptPath, code)
{
	return new Promise((resolve, reject) => {
		// create defineModule function
		const define = (dependencies, creator) => {
			// define the module
			defineModule(scriptPath, dependencies, creator).then((module) => {
				resolve(module);
			}).catch((error) => {
				reject(error);
			});
		}
		// evaluate the module
		evalModuleScript(define, code);
	});
}

// function to sandbox the eval function while it's loading the module
function evalModuleScript(defineModule, __code)
{
	eval(Babel.transform(__code, {presets:['react']}).code);
}

// function to handle loading a module's dependencies and then returning it
function defineModule(scriptPath, dependencies, creator)
{
	return new Promise((resolve, reject) => {
		// load dependencies
		var promises = [];
		for(const dependency of dependencies)
		{
			promises.push(loadModule(dependency));
		}

		// wait for dependencies to finish loading and resolve the result
		Promise.all(promises).then((dependencyModules) => {
			var module = null;
			// execute the function to create the module
			try
			{
				module = creator(...dependencyModules);
			}
			catch(error)
			{
				// an error occurred creating the module
				reject(error);
				return;
			}
			// the module has been created
			resolve(module);
		}).catch((error) => {
			// an error occurred loading a dependency
			reject(error);
		});
	});
}

// wait for page load
window.addEventListener('load', () => {
	// load the OS module
	loadModule('system/OS').then((OS) => {
		// render the OS
		console.log("done loading OS module");
		ReactDOM.render(
			React.createElement(OS),
			document.getElementById('root')
		);
	}).catch((error) => {
		console.error("Unable to load OS module: ", error);
	});
});
