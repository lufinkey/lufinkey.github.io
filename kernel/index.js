
const {
	Context
} = await krequire('kernel/process/Context.js');
const {
	makeLeadingDirs
} = await krequire('kernel/util.js');
const {
	wrapThread,
	Signals
} = await krequire('kernel/process/thread.js');


if(!kernel.options.boot || !kernel.options.boot.url || !kernel.options.boot.path) {
	throw new Error("boot.url and boot.path must be specified in options");
}


const resetKernel = () => {
	kernel.loadedCSS = {};
	
	kernel.pidCounter = 0;
	kernel.runningProcesses = {};

	kernel.rootContext = null;
};


let bootData = null;
let bootDataPromise = kernel.download(kernel.options.boot.url);
const getBootData = async () => {
	if(bootData) {
		return bootData;
	}
	bootData = await bootDataPromise;
	bootDataPromise = null;
	return bootData;
}



let booted = false;
const boot = async () => {
	if(booted) {
		throw new Error("already booted");
	}
	booted = true;
	resetKernel();

	kernel.log(null, "starting boot...");

	// create root context
	const rootContext = new Context(null);
	rootContext.becomeProcess({
		filename: '[kernel]',
		argv: [],
		uid: 0,
		gid: 0
	});
	kernel.rootContext = rootContext;

	// download boot data
	let bootData = await getBootData();
	kernel.log(null, "boot data downloaded");

	// start boot
	wrapThread(rootContext, {name:'root'}, async () => {
		const util = rootContext.kernelModules.require('util');
		const fs = rootContext.kernelModules.require('fs');
		const child_process = rootContext.kernelModules.require('child_process');

		// write boot data to path
		const bootPath = kernel.options.boot.path;
		makeLeadingDirs(rootContext, bootPath);
		await util.promisify(fs.writeFile)(bootPath, bootData, {mode: 0o700});

		// execute boot file
		kernel.log(null, "booting...");
		await new Promise((resolve, reject) => {
			const initProc = child_process.spawn(bootPath);
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

		// wait for processes to die
		let deadProcessPromises = [];
		let deadProcesses = Object.assign({}, kernel.runningProcesses);
		delete deadProcesses['0'];
		for(let pid in deadProcesses) {
			let context = deadProcesses[pid];
			deadProcessPromises.push(new Promise((resolve, reject) => {
				context.waitForProcessToDie({log: true}, () => {
					resolve();
				});
			}));
		}
		await Promise.all(deadProcessPromises);

		booted = false;
	});
};



let shuttingDown = false;
const shutdown = async () => {
	if(shuttingDown) {
		throw new Error("already shutting down");
	}
	if(!booted) {
		throw new Error("not booted");
	}
	shuttingDown = true;
	// kill base context
	const baseContext = kernel.runningProcesses['1'];
	if(baseContext != null && baseContext.valid) {
		baseContext.signal(Signals.SIGKILL);
	}
	// wait for root context to die
	await new Promise((resolve, reject) => {
		kernel.rootContext.waitForProcessToDie({log: true}, () => {
			resolve();
		});
	});
	// reset the kernel
	resetKernel();
	shuttingDown = false;
};



const reboot = async () => {
	await shutdown();
	await boot();
}



kernel.shutdown = shutdown;
kernel.reboot = reboot;




module.exports = async () => {
	await boot();
};
