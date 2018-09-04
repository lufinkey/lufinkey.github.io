
requireCSS('./style.css');
const AboutMe = require('./AboutMe');
const { WindowManagerClient } = require('dwm');

// create window
WindowManagerClient.createWindow(AboutMe).then((window) => {
	// window created
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
