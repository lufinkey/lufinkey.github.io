
// get window manager
const windowManager = process.env['WINDOW_MANAGER'];

let windowThreads = {};

const createWindow = (component, options) => {
	return new Promise((resolve, reject) => {
		if(!windowManager) {
			reject(new Error("no window manager detected"));
			return;
		}
		let windowId = null;
		syscall('thread', () => {
			return new Promise((resolve, reject) => {
				windowManager.createWindow(component, {
					...options,
					onDestroy: () => {
						const thread = windowThreads[windowId];
						delete windowThreads[windowId];
						thread.promise.resolve();
					}
				}).then((window) => {
					windowId = window.id;
					windowThreads[windowId] = {
						window: window,
						promise: {
							resolve: resolve,
							reject: reject
						}
					};
				}).catch((error) => {
					reject(error);
				});
			});
		}, () => {
			if(windowId != null && windowThreads[windowId]) {
				destroyWindow(window);
			}
		}, {})
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
		windowManager.destroyWindow(window).then(resolve, reject);
	});
}


const WindowMgrClient = {
	createWindow: createWindow,
	destroyWindow: destroyWindow
};

module.exports = WindowMgrClient;
