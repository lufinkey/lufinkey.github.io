
const {
	wrapThread,
	ThreadKiller
} = await krequire('kernel/process/thread.js');



module.exports = (context) => {
	const EventEmitter = context.kernelModules.requireBuiltIn('events');

	const superEmit = EventEmitter.prototype.emit;
	EventEmitter.prototype.emit = function(eventName, ...args) {
		// ensure context is valid
		if(!context.valid) {
			throw new ThreadKiller(context);
		}
		// send event
		return wrapThread(context, {
			name: 'event:'+eventName,
			rethrowThreadKiller:true
		}, () => {
			return superEmit.call(this, eventName, ...args);
		});
	};

	return EventEmitter;
};
