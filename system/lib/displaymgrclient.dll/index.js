
let displayComponents = {};

let display = process.env['display'];

const addComponent = (key, component) => {
	if(!display) {
		throw new Error("no display available");
	}
	display.addComponent(key, component);
	syscall('thread', () => {
		return new Promise((resolve, reject) => {
			displayComponents[key] = {
				promise: {
					resolve: resolve,
					reject: reject
				}
			};
		});
	}, () => {
		removeComponent(key);
	})
}


const removeComponent = (key) => {
	if(!display) {
		throw new Error("no display available");
	}
	display.removeComponent(key);
	const obj = displayComponents[key];
	delete displayComponents[key];
	obj.promise.resolve();
}



const DisplayMgrClient = {
	addComponent: addComponent,
	removeComponent: removeComponent
};

module.exports = DisplayMgrClient;
