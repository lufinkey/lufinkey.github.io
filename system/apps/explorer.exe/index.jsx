
requireCSS('./style.css');
const Explorer = require('./Explorer');

// get window manager
const windowManager = process.env['WINDOW_MANAGER'];
if(!windowManager) {
	console.error("no window manager detected");
	process.exit(1);
}

// create window
windowManager.createWindow(Explorer).then((window) => {
	// window created
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
