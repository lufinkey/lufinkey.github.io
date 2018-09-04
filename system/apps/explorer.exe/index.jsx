
requireCSS('./style.css');
const Explorer = require('./Explorer');
const { WindowManagerClient } = require('dwm');

// create window
WindowManagerClient.createWindow(Explorer).then((window) => {
	// window created
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
