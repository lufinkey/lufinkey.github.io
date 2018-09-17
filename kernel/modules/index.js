
const __dirname = 'kernel/modules';

// download modules
const modules = await (async () => {
	const moduleNames = [
		'builtins',
		'child_process',
		'events',
		'fs',
		'misc',
		'process',
		'rimraf',
		'syscall',
		'timers',
		'util'
	];
	const modulePromises = {};
	for(const moduleName of moduleNames) {
		modulePromises[moduleName] = krequire(__dirname+'/'+moduleName+'.js');
	}
	const modules = {};
	for(const moduleName in modulePromises) {
		modules[moduleName] = await modulePromises[moduleName];
	}
	return modules;
})();



// declare module loader
class KernelModuleLoader
{
	constructor(context) {
		this.context = context;
		this.loadedModules = [];
	}

	require(moduleName) {
		if(this.loadedModules[moduleName]) {
			return this.loadedModules[moduleName];
		}
		const moduleCreator = modules[moduleName];
		if(moduleCreator) {
			const moduleExports = moduleCreator(this.context);
			this.loadedModules[moduleName] = moduleExports;
			return moduleExports;
		}
		return this.requireBuiltIn(moduleName);
	}

	requireBuiltIn(moduleName) {
		let builtInsRequire = this.loadedModules['builtins'];
		if(!builtInsRequire) {
			builtInsRequire = modules['builtins'](this.context);
			this.loadedModules['builtins'] = builtInsRequire;
		}
		return builtInsRequire(moduleName);
	}
}


// export
module.exports = KernelModuleLoader;
