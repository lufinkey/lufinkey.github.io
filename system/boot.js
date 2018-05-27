
const fs = require('fs');
const rimraf = require('rimraf');
const { spawn } = require('child_process');

// log information about the boot sequence
let bootlogs = [];
let bootlogPipes = [];
function bootlog(message, options)
{
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
function download(url)
{
	return new Promise((resolve, reject) => {
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = () => {
			if(xhr.readyState === 4)
			{
				if(xhr.status === 200)
				{
					resolve(xhr.responseText);
				}
				else
				{
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
function downloadFile(url, path, options={})
{
	return new Promise((resolve, reject) => {
		download(url).then((data) => {
			fs.writeFile(path, data, (error) => {
				if(error) {
					reject(error);
				}
				else {
					resolve();
				}
			})
		}).catch((error) => {
			reject(error);
		});
	});
}

// download data for multiple files
function downloadFiles(structure, path=null)
{
	const structKeys = Object.keys(structure);
	if(structKeys.length === 0) {
		return Promise.resolve();
	}

	// get current entry
	const entryName = structKeys[0];
	const entry = structure[entryName];
	let entryPath = null;
	if(!path) {
		entryPath = entryName;
	}
	else {
		entryPath = path+'/'+entryName;
	}

	// get next structure to parse
	const nextStructure = Object.assign({}, structure);
	delete nextStructure[entryName];

	return new Promise((resolve, reject) => {
		if(typeof entry === 'string') {
			// get file URL
			var url = entry;
			if(entry.length === 0) {
				url = entryPath
			}
			
			// download file
			bootlog("downloading /"+entryPath);
			downloadFile(url, '/'+entryPath).then(() => {
				bootlog("downloaded /"+entryPath);
				// load next file in structure
				downloadFiles(nextStructure, path).then(() => {
					resolve();
				}).catch((error) => {
					reject(error);
				});
			}).catch((error) => {
				// error
				bootlog("failed to download /"+entryPath, {color: 'red'});
				reject(error);
			});
		}
		else {
			// create directory
			try {
				if(!fs.existsSync('/'+entryPath)) {
					fs.mkdirSync('/'+entryPath);
				}
			}
			catch(error) {
				bootlog("failed to create directory /"+entryPath, {color: 'red'});
				bootlog(error.toString(), {color: 'red'});
				reject(error);
				return;
			}
			// fetch remote files in folder
			downloadFiles(entry, entryPath).then(() => {
				// load next file in structure
				downloadFiles(nextStructure, path).then(() => {
					resolve();
				}).catch((error) => {
					reject(error);
				});
			}).catch((error) => {
				reject(error);
			});
		}
	});
}

// setup the system from the system object
function setupSystem(system)
{
	// read current system.json
	let oldSystem = null;
	if(fs.existsSync('/system/system.json')) {
		oldSystem = JSON.parse(fs.readFileSync('/system/system.json'));
	}
	// check if system needs downloading
	let redownloadSystem = false;
	if(!oldSystem || system.alwaysRedownload || system.version != oldSystem.version) {
		// wipe base system
		let systemFiles = [];
		if(fs.existsSync('/system')) {
			systemFiles = fs.readdirSync('/system', {encoding: 'utf8'});
			for(const file of systemFiles) {
				if(file !== 'boot.js') {
					rimraf.sync('/system/'+file);
				}
			}
		}
		redownloadSystem = true;
	}
	// create system folder
	if(!fs.existsSync('/system')) {
		fs.mkdirSync('/system');
	}
	// set environment variables
	if(system.env) {
		for(const key in system.env) {
			process.env[key] = system.env[key];
		}
	}
	// download system
	let downloadPromise = Promise.resolve();
	if(system.bundles) {
		for(let bundle of system.bundles) {
			// process bundle
			if(redownloadSystem) {
				// download bundle files
				downloadPromise = downloadPromise.then(() => {
					return downloadFiles(bundle.files);
				});
			}
			if(bundle.triggers) {
				// execute bundle triggers
				for(const trigger of bundle.triggers) {
					downloadPromise = downloadPromise.then(() => {
						// promise to execute trigger
						return new Promise((resolve, reject) => {
							// execute trigger
							const proc = spawn(trigger.execute, trigger.args || [], {
								detached: trigger.detached
							});

							// handle trigger stdin
							let onExitHandler = null;
							switch(trigger.stdin) {
								case 'bootlog': {
									addBootlogPipe(proc.stdin);
									onExitHandler = () => {
										removeBootlogPipe(proc.stdin);
									}
								}
								break;
							}

							// handle trigger error
							proc.once('error', (error) => {
								if(!trigger.detached) {
									reject(error);
								}
							});

							// handle trigger exit
							proc.once('exit', (code, signal) => {
								if(onExitHandler) {
									onExitHandler();
								}
								if(!trigger.detached) {
									if(code != 0) {
										reject(new Error(trigger.execute+" exited with status "+code));
									}
									else {
										resolve();
									}
								}
							});

							if(trigger.detached) {
								resolve();
								return;
							}
						});
					});
				}
			}
		}
	}
	
	// finish
	return new Promise((resolve, reject) => {
		downloadPromise.then(() => {
			// write system.json to file
			fs.writeFileSync('/system/system.json', JSON.stringify(system, null, "\t"));
			// close bootlog pipes
			const pipes = bootlogPipes.slice(0);
			bootlogPipes = [];
			for(const pipe of pipes) {
				pipe.end();
			}
			resolve();
		}).catch((error) => {
			// error
			reject(error);
		});
	});
}

// download new system.json
let newSystem = null;
download('/system/system.json').then((data) => {
	// downloaded system.json
	return setupSystem(JSON.parse(data));
}).then(() => {
	// done setting up system
	process.exit(0);
}).catch((error) => {
	// error
	console.error(error);
	bootlog(error.toString(), {color: 'red'});
	process.exit(1);
});
