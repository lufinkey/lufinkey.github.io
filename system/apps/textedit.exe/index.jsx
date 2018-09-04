
requireCSS('./style.css');
const TextEdit = require('./TextEdit');
const { WindowManagerClient } = require('dwm');

// create window
WindowManagerClient.createWindow(TextEdit).then((window) => {
	// window created
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
