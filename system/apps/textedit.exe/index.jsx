
requireCSS('./style.css');
const TextEdit = require('./TextEdit');

// get window manager
const windowManager = process.env['WINDOW_MANAGER'];
if(!windowManager) {
	console.error("no window manager detected");
	process.exit(1);
}

// create window
windowManager.createWindow(TextEdit).then((window) => {
	// window created
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
