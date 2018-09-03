
const { spawn } = require('child_process');
const DisplayManager = require('./DisplayManager');


(async () => {

	// create display manager
	const displayManager = await DisplayManager.create('displaymgr');
	// create default display
	const displayId = ':0';
	await displayManager.addDisplay(displayId, {active: true});
	
	// TODO check for greeter or shell settings in /etc

	// create environment variable for managing display
	const displayEnv = {
		addComponent: (key, component) => {
			displayManager.addDisplayComponent(displayId, key, component);
		},
		removeComponent: (key) => {
			displayManager.removeDisplayComponent(displayId, key);
		}
	};

	// start shell32
	// TODO start shell32 as non-root user
	const shell32Proc = spawn('shell32.exe', [], {
		env: {
			'display': displayEnv
		}
	});
	// wait for shell32 to exit
	await new Promise((resolve, reject) => {
		if(!shell32Proc.pid) {
			shell32Proc.once('error', (error) => {
				reject(error);
			});
		}
		shell32Proc.once('exit', (code, signal) => {
			resolve();
		});
	});

	DisplayManager.destroy('displaymgr');

})().then(() => {
	// done
	process.exit(0);
}).catch((error) => {
	// error
	console.error(error);
	process.exit(1);
});

