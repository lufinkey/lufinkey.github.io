
const PrivateSystemUI = require('./sysui.private');


function validateUser() {
	if(process.uid != 0) {
		throw new Error("sysui cannot be accessed as non-root");
	}
}



const SystemUI = {};

SystemUI.initialize = () => {
	validateUser();
	if(!PrivateSystemUI.started) {
		PrivateSystemUI.start();
	}
};


SystemUI.register = (key, component) => {
	validateUser();
	// start if needed
	if(!PrivateSystemUI.started) {
		PrivateSystemUI.start();
	}
	// register screen
	PrivateSystemUI.registerScreen(key, component, process.pid);
	// remove screen when exiting
	let exited = false;
	const exitListener = (code) => {
		exited = true;
		PrivateSystemUI.unregisterScreen(key, process.pid);
	};
	process.once('exit', exitListener);
	PrivateSystemUI.addScreenListener(key, 'unregister', () => {
		if(!exited) {
			process.removeListener('exit', exitListener);
		}
	});
};



SystemUI.unregister = (key) => {
	validateUser();
	// unregister screen
	PrivateSystemUI.unregisterScreen(key, process.pid);
};



module.exports = SystemUI;
