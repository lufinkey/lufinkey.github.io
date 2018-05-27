
requireCSS('./style.css');
const iFrame = require('./iFrame');

// get window manager
const windowManager = process.env['WINDOW_MANAGER'];
if(!windowManager) {
	console.error("no window manager detected");
	process.exit(1);
}

// create window
windowManager.createWindow(iFrame).then((window) => {
	// window created
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
