
const {
	wrapThread,
	ThreadKiller
} = await krequire('kernel/process/thread.js');



module.exports = (context) => {

	// Timeout
	class Timeout {
		constructor(idProvider, refresh) {
			let reffed = true;
			Object.defineProperties(this, {
				id: {
					get: () => {
						return idProvider();
					}
				},
				ref: {
					value: () => {
						reffed = true;
						return this;
					},
					writable: false
				},
				unref: {
					value: () => {
						reffed = false;
						return this;
					},
					writable: false
				},
				hasRef: {
					value: () => {
						return reffed;
					},
					writable: false
				},
				refresh: {
					value: () => {
						refresh();
						return this;
					},
					writable: false
				}
			});
		}
	};



	// Immediate
	class Immediate {
		constructor(idProvider) {
			let reffed = false;
			Object.defineProperties(this, {
				id: {
					get: () => {
						return idProvider();
					}
				},
				ref: {
					value: () => {
						reffed = true;
						return this;
					},
					writable: false
				},
				unref: {
					value: () => {
						reffed = false;
						return this;
					},
					writable: false
				},
				hasRef: {
					value: () => {
						return reffed;
					},
					writable: false
				}
			});
		}
	};



	// helper functions
	const getTimerIndex = (timers, id) => {
		for(var i=0; i<timers.length; i++) {
			const timer = timers[i];
			if(timer.id === id) {
				return i;
			}
		}
		return null;
	};
	const removeTimer = (timers, id) => {
		var index = getTimerIndex(timers, id);
		if(index != null) {
			timers.splice(index, 1);
		}
	};
	const getTimer = (timers, id) => {
		var index = getTimerIndex(timers, id);
		if(index != null) {
			return timers[index];
		}
		return null;
	};



	// create module
	const timers = {};

	// timeout

	timers.setTimeout = (callback, delay, ...args) => {
		if(!context.valid) {
			throw new ThreadKiller(context);
		}
		if(typeof callback !== 'function') {
			throw new TypeError("callback must be a function");
		}
		// timeout creator function
		const createTimeout = () => {
			const id = setTimeout((...args) => {
				// find matching timeout and remove
				removeTimer(context.timeouts, id);
				// run callback in "thread"
				return wrapThread(context, {
					name: 'setTimeout',
					rethrowThreadKiller:true
				}, () => {
					return callback(...args);
				});
			}, delay, ...args);
			return id;
		};
		// create timeout object
		let id = createTimeout();
		const timeout = new Timeout(() => {return id}, () => {
			if(!context.valid) {
				throw new ThreadKiller(context);
			}
			const oldTimeout = getTimer(context.timeouts, id);
			clearTimeout(id);
			id = createTimeout();
			// re-add timeout to list if necessary
			if(oldTimeout == null) {
				context.timeouts.push(timeout);
			}
		});
		// add timeout to list
		context.timeouts.push(timeout);
		return timeout;
	};

	timers.clearTimeout = (timeout) => {
		if(!(timeout instanceof Timeout)) {
			throw new Error("timeout arg must be a Timeout created with setTimeout");
		}
		var index = context.timeouts.indexOf(timeout);
		if(index === -1) {
			return;
		}
		clearTimeout(timeout.id);
		context.timeouts.splice(index, 1);
	};




	// immediate

	timers.setImmediate = (callback, ...args) => {
		if(!context.valid) {
			throw new ThreadKiller(context);
		}
		if(typeof callback !== 'function') {
			throw new TypeError("callback must be a function");
		}
		// immediate creator function
		const createImmediate = () => {
			const id = setTimeout((...args) => {
				// find matching immediate and remove
				removeTimer(context.immediates, id);
				// run callback in "thread"
				return wrapThread(context, {
					name: 'setImmediate',
					rethrowThreadKiller:true
				}, () => {
					return callback(...args);
				});
			}, 0, ...args);
			return id;
		};
		// create immediate object
		let id = createImmediate();
		const immediate = new Immediate(() => {return id});
		// add immediate to list
		context.immediates.push(immediate);
		return immediate;
	};

	timers.clearImmediate = (immediate) => {
		if(!(immediate instanceof Immediate)) {
			throw new Error("immediate arg must be an Immediate created with setImmediate");
		}
		var index = context.immediates.indexOf(immediate);
		if(index === -1) {
			return;
		}
		clearTimeout(immediate.id);
		context.immediates.splice(index, 1);
	};




	// interval

	timers.setInterval = (callback, delay, ...args) => {
		if(!context.valid) {
			throw new ThreadKiller(context);
		}
		if(typeof callback !== 'function') {
			throw new TypeError("callback must be a function");
		}
		// interval creator function
		const createInterval = () => {
			const id = setInterval((...args) => {
				// run callback in "thread"
				return wrapThread(context, {
					name: 'setInterval',
					rethrowThreadKiller:true
				}, () => {
					return callback(...args);
				});
			}, delay, ...args);
			return id;
		}
		// create timeout object
		let id = createInterval();
		const timeout = new Timeout(() => {return id}, () => {
			if(!context.valid) {
				throw new ThreadKiller(context);
			}
			const oldInterval = getTimer(context.intervals, id);
			clearInterval(id);
			id = createInterval();
			// re-add interval to list if necessary
			if(oldInterval == null) {
				context.intervals.push(timeout);
			}
		});
		// add timeout to list
		context.intervals.push(timeout);
		return timeout;
	};

	timers.clearInterval = (timeout) => {
		if(!(timeout instanceof Timeout)) {
			throw new Error("timeout arg must be a Timeout created with setInterval");
		}
		var index = context.intervals.indexOf(timeout);
		if(index === -1) {
			return;
		}
		clearInterval(timeout.id);
		context.intervals.splice(index, 1);
	};



	// classes

	timers.Timeout = Timeout;
	timers.Immediate = Immediate;

	return timers;
};
