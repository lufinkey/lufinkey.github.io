
function Kernel(kernelOptions) {
	if(!(this instanceof Kernel)) {
		throw new Error("Kernel must be instantiated with 'new' keyword");
	}

	const kernel = {};

	// function to evaluate a given script
	function evalJavaScript(__scope, __code) {
		// make sure globals aren't available in the eval call
		let Kernel = undefined;
		let kernel = undefined;
		let kernelOptions = undefined;
		let evalJavaScript = undefined;
		// sandbox script
		return (function(){
			return eval(__code);
		}).bind({})();
	}




	// sandbox kernel internals
	(function() {
		kernel.options = Object.assign({}, kernelOptions);
		kernel.osName = ''+(kernel.options.osName || 'finkeos');

		kernel.kernelModuleWaiters = {};
		kernel.downloadingKernelModules = [];
		kernel.kernelModules = {};
		kernel.sharedModules = {};
		kernel.loadedCSS = {};
		
		kernel.pidCounter = 0;
		kernel.runningProcesses = [];

		const global = {};

		// clear localStorage for now
		window.localStorage.clear();



		// download a file
		kernel.download = (url) => {
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



		// run a script with a given scope
		kernel.runScript = (code, scope={}, options={}) => {
			options = Object.assign({}, options);
			if(!scope) {
				scope = {};
			}
			if(!scope.global) {
				scope.global = {};
			}

			// get async func prefixes for an async call if needed
			let asyncFuncPrefix = '';
			let awaitFuncPrefix = '';
			if(options.async) {
				asyncFuncPrefix = 'async ';
				awaitFuncPrefix = 'await ';
			}

			// create filtered code string
			const filteredCode =
				'('+asyncFuncPrefix+'() => {\n'+
					'let ___result = '+awaitFuncPrefix+'('+asyncFuncPrefix+'() => {\n'+
						'let __result = undefined;\n'+
						'let __code = undefined;\n'+
						'with(__scope) {\n'+
							'let __scope = undefined;\n'+
							'with(global) {\n'+
								'return '+awaitFuncPrefix+'('+asyncFuncPrefix+'() => {\n'+
									code+'\n'+
								'})();\n'+
							'}\n'+
						'}\n'+
					'})();\n'+
					'return ___result;\n'+
				'})()';

			// evaluate the code
			return evalJavaScript(scope, filteredCode);
		}



		// require a kernel module
		kernel.krequire = async (path) => {
			if(path in kernel.kernelModules) {
				return kernel.kernelModules[path];
			}
			if(kernel.downloadingKernelModules.indexOf(path) !== -1) {
				// wait for pending download
				let waiter = {};
				const promise = new Promise((resolve, reject) => {
					waiter = {
						resolve,
						reject
					};
				});
				if(!(path in kernel.kernelModuleWaiters)) {
					kernel.kernelModuleWaiters[path] = [];
				}
				kernel.kernelModuleWaiters[path].push(waiter);
				return await promise;
			}
			// start download
			kernel.downloadingKernelModules.push(path);
			const data = await kernel.download(path+'?v='+(Math.random()*99999999999));

			let moduleExports = {};

			// define scope
			const scope = Object.defineProperties({}, {
				exports: {
					get:() => {return moduleExports},
					set:(value) => {moduleExports = value}
				},
				module: {
					value: Object.defineProperties({}, {
						exports: {
							get:() => {return moduleExports},
							set:(value) => {moduleExports = value}
						}
					}),
					writable: false
				},
				global: {value: global, writable: false},
				kernel: {value: kernel, writable: false},
				krequire: {value: kernel.krequire, writable: false}
			});

			// execute script
			await kernel.runScript(data, scope, {async: true});
			kernel.kernelModules[path] = moduleExports;

			// resolve waiting krequires
			const downloadIndex = kernel.downloadingKernelModules.indexOf(path);
			kernel.downloadingKernelModules.splice(downloadIndex, 1);
			const waiters = kernel.kernelModuleWaiters[path];
			delete kernel.kernelModuleWaiters[path];
			if(waiters) {
				for(const waiter of waiters) {
					waiter.resolve(moduleExports);
				}
			}

			return moduleExports;
		}



		// append information to the kernel log
		kernel.log = (message, options={}) => {
			options = Object.assign({}, options);
			const kernelElement = document.getElementById("kernel");
			if(kernelElement != null) {
				const logElement = document.createElement("DIV");
				logElement.textContent = message;
				logElement.style.color = options.color;

				kernelElement.appendChild(logElement);
				kernelElement.scrollTop = kernelElement.scrollHeight;
			}
		}



		// boot the kernel
		let booting = false;
		let booted = false;
		kernel.boot = async (path) => {
			if(booting) {
				throw new Error("already booting");
			}
			else if(booted) {
				throw new Error("already booted");
			}
			booting = true;
			const main = await kernel.krequire('kernel/index.js');
			await main();
			booted = true;
			booting = false;
		}
	})();



	// define kernel properties
	Object.defineProperties(this, {
		boot: {
			value: kernel.boot,
			writable: false
		},
		log: {
			value: kernel.log,
			writable: false
		},
		require: {
			get: () => {
				return kernel.require;
			}
		}
	});
};
