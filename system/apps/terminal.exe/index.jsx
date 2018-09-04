
requireCSS('./style.css');
const Terminal = require('./Terminal');
const { WindowManagerClient } = require('dwm');

// create window
WindowManagerClient.createWindow(Terminal).then((window) => {
	// window created
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
