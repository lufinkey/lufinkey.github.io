
const {
	ProcPromise
} = await krequire('kernel/process/thread.js');

const builtInsGenerator = await (async () => {
	const code = await kernel.download('https://cdn.jsdelivr.net/npm/node-builtin-map/dist/node-builtin-map.js');
	const generatorCode =
		'return ({ setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate, Promise }) => {\n'+
			'let require = null;\n'+
			'(() => {\n'+
				code+'\n'+
			'})();\n'+
			'return require;\n'+
		'}';
	
	return kernel.runScript(generatorCode);
})();

module.exports = (context) => {
	const {
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		setImmediate,
		clearImmediate
	} = context.kernelModules.require('timers');

	return builtInsGenerator({
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		setImmediate,
		clearImmediate,
		Promise: ProcPromise
	})('node-builtin-map').require;
};
