
requireCSS('./style.css');
const iFrame = require('./iFrame');
const { WindowManagerClient } = require('dwm');

// create window
WindowManagerClient.createWindow(iFrame).then((window) => {
	// window created
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
