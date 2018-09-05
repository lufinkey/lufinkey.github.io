
const PrivateSystemUI = require('./sysui.private');


function validateUser() {
	if(process.uid != 0) {
		throw new Error("sysui cannot be accessed as non-root");
	}
}



const screens = {};

const initialize = () => {
	validateUser();
	if(!PrivateSystemUI.started) {
		PrivateSystemUI.start();
	}
};


const register = (key, component) => {
	validateUser();
	// start if needed
	if(!PrivateSystemUI.started) {
		PrivateSystemUI.start();
	}
	// register screen
	PrivateSystemUI.registerScreen(key, component, process.pid);
	// add to screens
	syscall('thread', () => {
		return new Promise((resolve, reject) => {
			screens[key] = {
				promise: {
					resolve: resolve,
					reject: reject
				},
				component: component
			}
		});
	}, () => {
		unregister(key, process.pid);
	});
};



const unregister = (key) => {
	validateUser();
	// unregister screen
	PrivateSystemUI.unregisterScreen(key, process.pid);
	// remove from screens
	const screen = screens[key];
	if(screen) {
		delete screens[key];
		screen.promise.resolve();
	}
};


const SystemUI = Object.defineProperties({}, {
	initialize: {
		value: initialize,
		writable: false
	},
	register: {
		value: register,
		writable: false
	},
	unregister: {
		value: unregister,
		writable: false
	},
	started: {
		get: () => {
			return PrivateSystemUI.started;
		}
	}
});


module.exports = SystemUI;
