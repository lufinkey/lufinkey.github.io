
const fs = require('fs');
const rimraf = require('rimraf');
const { spawn } = require('child_process');
const util = require('util');

// log information about the boot sequence
let bootlogs = [];
let bootlogPipes = [];
function bootlog(message, options) {
	bootlogs.push({message: message, options: Object.assign({}, options)});
	syscall('log', message, options);
	const pipes = bootlogPipes.slice(0);
	for(const pipe of pipes) {
		pipe.write(JSON.stringify({
			message: message,
			options: options
		}));
	}
}
// handle bootlog events
function addBootlogPipe(pipe) {
	bootlogPipes.push(pipe);
}
function removeBootlogPipe(pipe) {
	const index = bootlogPipes.indexOf(pipe);
	if(index !== -1) {
		bootlogPipes.splice(index, 1);
	}
}




// download data from a URL
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

		xhr.open('GET', url+'?v='+(Math.random()*999999999));
		//xhr.open('GET', url);
		/*xhr.setRequestHeader('cache-control', 'no-cache, must-revalidate, post-check=0, pre-check=0');
		xhr.setRequestHeader('cache-control', 'max-age=0');
		xhr.setRequestHeader('expires', '0');
		xhr.setRequestHeader('expires', 'Tue, 01 Jan 1980 1:00:00 GMT');
		xhr.setRequestHeader('pragma', 'no-cache');*/
		xhr.send();
	});
}




// download data from a URL and write it to a file
async function downloadFile(url, path, options={}) {
	const data = await download(url);
	await util.promisify(fs.writeFile)(path, data, options);
}




// download data for multiple files
async function downloadFiles(structure, path=null) {
	// ensure structure isn't empty
	if(structure.length == 0) {
		return;
	}

	// get current entry
	const entry = structure[0];
	const entryName = entry.name;
	let entryPath = null;
	if(!path) {
		entryPath = entryName;
	}
	else {
		entryPath = path+'/'+entryName;
	}

	// get next structure to parse
	const nextStructure = [].concat(structure);
	nextStructure.splice(0, 1);

	// get entry options
	let options = Object.assign({}, entry);
	delete options.name;
	delete options.type;
	delete options.url;
	delete options.content;

	// parse mode
	if(options.mode) {
		if(typeof options.mode === 'string') {
			options.mode = parseInt(options.mode, 8);
		}
		else if(typeof options.mode !== 'number') {
			throw new Error("invalid type for option \"mode\"");
		}
	}
	else {
		options.mode = 0o755;
	}

	if(entry.type === 'FILE') {
		// get file URL
		let url = entry.url;
		if(!url) {
			url = entryPath
		}
		
		// download file
		bootlog("downloading /"+entryPath);
		try {
			await downloadFile(url, entryPath, options);
		}
		catch(error) {
			bootlog("failed to download /"+entryPath, {color: 'red'});
			throw error;
		}
		bootlog("downloaded /"+entryPath);

		// load next file in structure
		await downloadFiles(nextStructure, path);
	}
	else if(entry.type === 'DIR') {
		// create directory
		try {
			if(!fs.existsSync('/'+entryPath)) {
				await util.promisify(fs.mkdir)('/'+entryPath, options.mode);
			}
		}
		catch(error) {
			bootlog("failed to create directory /"+entryPath, {color: 'red'});
			throw error;
		}
		
		// fetch remote files in folder
		const entryStructure = entry.content || [];
		await downloadFiles(entryStructure, entryPath);
		// load next file in structure
		await downloadFiles(nextStructure, path);
	}
}




// execute a trigger
let asyncTriggerProcs = [];
function executeTrigger(trigger) {
	return new Promise((resolve, reject) => {
		// validate trigger
		if(typeof trigger.execute !== 'string') {
			reject(new TypeError("\"execute\" must be a string"));
			return;
		}

		// spawn trigger process
		bootlog("executing trigger "+trigger.execute);
		const triggerProc = spawn(trigger.execute, trigger.args || []);

		// handle process finish
		if(trigger.async) {
			if(triggerProc.pid) {
				asyncTriggerProcs.push(new Promise((resolve, reject) => {
					triggerProc.once('exit', (code, signal) => {
						resolve();
					});
				}));
			}
		}
		else {
			if(!triggerProc.pid) {
				triggerProc.once('error', (error) => {
					reject(error);
				});
			}
			triggerProc.once('exit', (code, signal) => {
				if(code != null && code != 0) {
					reject(new Error(trigger.execute+" exited with status "+code));
				}
				else {
					resolve();
				}
			});
		}

		// handle other trigger options
		if(triggerProc.pid) {
			// add bootlog pipe
			switch(trigger.stdin) {
				case 'bootlog': {
					addBootlogPipe(triggerProc.stdin);
					triggerProc.prependOnceListener('exit', (code, signal) => {
						removeBootlogPipe(triggerProc.stdin);
					});
				}
				break;
			}

			if(!trigger.async) {
				// pipe stdout to bootlog
				triggerProc.stdout.on('data', (chunk) => {
					if(chunk instanceof Buffer) {
						chunk = chunk.toString('utf8');
					}
					bootlog(chunk);
				});
				// pipe stderr to bootlog
				triggerProc.stderr.on('data', (chunk) => {
					if(chunk instanceof Buffer) {
						chunk = chunk.toString('utf8');
					}
					bootlog(chunk, {color: 'red'});
				});
			}
		}

		// resolve if detached
		if(trigger.async) {
			setTimeout(() => {
				resolve();
			}, 0);
		}
	});
}




// boot the system from the system object
async function bootSystem(system) {
	// read current system.json
	const systemPath = '/system/system.json';
	let oldSystem = null;
	let oldSystemExists = true;
	try {
		await util.promisify(fs.access)(systemPath);
	}
	catch(error) {
		oldSystemExists = false;
	}
	if(oldSystemExists) {
		oldSystem = JSON.parse(await util.promisify(fs.readFile)(systemPath));
	}
	// check if system needs downloading
	let redownloadSystem = false;
	if(!oldSystem || system.alwaysRedownload || system.version != oldSystem.version) {
		// wipe base system
		let systemFiles = [];
		if(fs.existsSync('/system')) {
			systemFiles = await util.promisify(fs.readdir)('/system', {encoding: 'utf8'});
			for(const file of systemFiles) {
				if(file !== 'init.js') {
					await util.promisify(rimraf)('/system/'+file);
				}
			}
		}
		redownloadSystem = true;
	}
	// create system folder
	if(!fs.existsSync('/system')) {
		await util.promisify(fs.mkdir)('/system', 0o755);
	}
	// set environment variables
	if(system.env) {
		for(const key in system.env) {
			process.env[key] = system.env[key];
		}
	}
	// download system
	if(system.bundles) {
		for(let bundle of system.bundles) {
			// process bundle
			if(redownloadSystem) {
				// download bundle files
				await downloadFiles(bundle.filesystem);
			}
			if(bundle.triggers) {
				// execute bundle triggers
				for(const trigger of bundle.triggers) {
					await executeTrigger(trigger);
				}
			}
		}
	}
	// write system.json to file
	await util.promisify(fs.writeFile)(systemPath, JSON.stringify(system, null, "\t"), {mode: 0o644});
	// close bootlog pipes
	const pipes = bootlogPipes.slice(0);
	bootlogPipes = [];
	for(const pipe of pipes) {
		pipe.destroy();
	}
}




// main
(new Promise((resolve, reject) => {
	(async () => {
		// perform system initialization
		const systemData = await download('system/system.json');
		const system = JSON.parse(systemData);
		// boot system
		await bootSystem(system);
		// wait for all async triggers to finish
		await Promise.all(asyncTriggerProcs);
	})().then(resolve, reject);
})).then(() => {
	// done
	process.exit(0);
}).catch((error) => {
	// error
	bootlog(error.toString(), {color: 'red'});
	process.exit(1);
});
