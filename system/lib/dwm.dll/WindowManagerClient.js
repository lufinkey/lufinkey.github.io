
// get window manager
const windowManager = process.env['WINDOW_MANAGER'];

let windowThreads = {};

const createWindow = (component, options) => {
	return new Promise((resolve, reject) => {
		if(!windowManager) {
			reject(new Error("no window manager detected"));
			return;
		}
		windowManager.createWindow(component, options).then((window) => {
			syscall('thread', () => {
				return new Promise((resolve, reject) => {
					windowThreads[window.id] = {
						window: window,
						promise: {
							resolve: resolve,
							reject: reject
						}
					};
				});
			}, () => {
				if(windowThreads[window.id]) {
					destroyWindow(window);
				}
			});
		})
	});
}


const destroyWindow = (window) => {
	return new Promise((resolve, reject) => {
		if(!window) {
			reject(new Error("no window given"));
			return;
		}
		const thread = windowThreads[window.id];
		if(!thread) {
			reject(new Error("no matching window"));
		}
		delete windowThreads[window.id];
		thread.promise.resolve();
		windowManager.destroyWindow(window).then(resolve, reject);
	});
}


const WindowMgrClient = {
	createWindow: createWindow,
	destroyWindow: destroyWindow
};

module.exports = WindowMgrClient;
