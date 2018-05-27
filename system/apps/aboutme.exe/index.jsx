
requireCSS('./style.css');
const AboutMe = require('./AboutMe');

// get window manager
const windowManager = process.env['WINDOW_MANAGER'];
if(!windowManager) {
	console.error("no window manager detected");
	process.exit(1);
}

// create window
windowManager.createWindow(AboutMe).then((window) => {
	// window created
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
