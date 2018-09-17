
// throwable to kill thread
class ThreadKiller {
	constructor(context) {
		if(context) {
			if(kernel.options.logThreadKillers) {
				console.error(new Error("pid "+context.pid+" is dead"));
			}
		}
	}
}



// thread lifecycle functions

function startThread(context, options={}) {
	if(!context.valid) {
		throw new ThreadKiller(context);
	}
	options = Object.assign({}, options);
	const threadID = context.nextThreadID;
	context.nextThreadID++;
	const thread = {
		id: threadID,
		name: options.name,
		cancel: options.cancel,
		cancelled: false
	};
	if(kernel.options.logThreads) {
		console.error("pid "+context.pid+": thread "+thread.id+" ("+thread.name+") started");
	}
	context.threads.push(thread);
	return threadID;
}

function removeThread(context, threadID) {
	for(var i=0; i<context.threads.length; i++) {
		var thread = context.threads[i];
		if(thread.id === threadID) {
			if(kernel.options.logThreads) {
				console.error("pid "+context.pid+": thread "+thread.id+" ("+thread.name+") finished");
			}
			context.threads.splice(i, 1);
			break;
		}
	}
}



function prepareToMaybeDie(context, options, unRef) {
	if(context.valid && !context.invalidating && !context.hasRunningCode(options)) {
		if(context.process != null) {
			try {
				context.process.emit('beforeExit');
			}
			catch(error) {
				console.error(error);
			}
		}
		unRef();
		if(context.valid && !context.invalidating && !context.hasRunningCode()) {
			console.error(new Error(context.filename+" ("+context.pid+") has no more threads to run"));
			context.invalidate(0, null);
		}
	}
	else {
		unRef();
	}
}



function finishThread(context, threadID) {
	prepareToMaybeDie(context, {ignoreThreads: [threadID]}, () => {
		removeThread(context, threadID);
	});
}



// wrap a function as a "thread"
function wrapThread(context, options={}, threadFunc) {
	if(typeof options === 'function') {
		threadFunc = options;
		options = {};
	}
	options = Object.assign({}, options);

	let retVal = undefined;
	const threadID = startThread(context, options);
	try {
		retVal = threadFunc();
	}
	catch(error) {
		// error
		finishThread(context, threadID);
		if(error instanceof ThreadKiller) {
			if(options.rethrowThreadKiller) {
				throw error;
			}
		}
		else {
			console.error(error);
		}
		return;
	}
	// handle result
	if(retVal instanceof Promise) {
		// promise
		let threadKiller = null;
		let retPromise = retVal;
		retVal = new ProcPromise((resolve, reject) => {
			retPromise.then((...results) => {
				// done
				if(context.valid) {
					resolve(...results);
				}
				setTimeout(() => {
					finishThread(context, threadID);
				}, 0);
			}, (error) => {
				// error
				if(error instanceof ThreadKiller) {
					if(options.rethrowThreadKiller) {
						threadKiller = error;
					}
				}
				else if(context.valid) {
					reject(error);
				}
				setTimeout(() => {
					finishThread(context, threadID);
				}, 0);
			});
		});
		if(threadKiller != null && options.rethrowThreadKiller) {
			throw threadKiller;
		}
	}
	else {
		finishThread(context, threadID);
	}
	return retVal;
}


// promise to catch and eliminate a thrown ThreadKiller
class ProcPromise extends Promise {
	
	then(onResolve, onReject, ...args) {
		if(typeof onResolve === 'function') {
			let innerOnResolve = onResolve;
			onResolve = (...args) => {
				let retVal = undefined;
				try {
					retVal = innerOnResolve(...args);
				}
				catch(e) {
					if(e instanceof ThreadKiller) {
						return;
					}
					throw e;
				}
				return retVal;
			};
		}
		if(typeof onReject === 'function') {
			let innerOnReject = onReject;
			onReject = (...args) => {
				let retVal = undefined;
				try {
					retVal = innerOnReject(...args);
				}
				catch(e) {
					if(e instanceof ThreadKiller) {
						console.log("caught inner ThreadKiller and extinguished");
						return;
					}
					throw e;
				}
				return retVal;
			};
		}
		let retVal = super.then(onResolve, onReject, ...args);
		if(retVal === this) {
			return retVal;
		}
		else if((retVal instanceof Promise) && !(retVal instanceof ProcPromise)) {
			return new ProcPromise((resolve, reject) => {
				retVal.then(resolve, reject);
			});
		}
		return retVal;
	}

	catch(onReject, ...args) {
		if(typeof onReject === 'function') {
			let innerOnReject = onReject;
			onReject = (...args) => {
				let retVal = undefined;
				try {
					retVal = innerOnReject(...args);
				}
				catch(e) {
					if(e instanceof ThreadKiller) {
						return;
					}
					throw e;
				}
				return retVal;
			};
		}
		let retVal = super.catch(onReject, ...args);
		if(retVal === this) {
			return retVal;
		}
		else if((retVal instanceof Promise) && !(retVal instanceof ProcPromise)) {
			return new ProcPromise((resolve, reject) => {
				retVal.then(resolve, reject);
			});
		}
		return retVal;
	}

	finally(onFinally, ...args) {
		if(typeof onFinally === 'function') {
			let innerOnFinally = onFinally;
			onFinally = (...args) => {
				let retVal = undefined;
				try {
					retVal = innerOnFinally(...args);
				}
				catch(e) {
					if(e instanceof ThreadKiller) {
						return;
					}
					throw e;
				}
				return retVal;
			};
		}
		let retVal = super.finally(onFinally, ...args);
		if(retVal === this) {
			return retVal;
		}
		else if((retVal instanceof Promise) && !(retVal instanceof ProcPromise)) {
			return new ProcPromise((resolve, reject) => {
				retVal.then(resolve, reject);
			});
		}
		return retVal;
	}

	static resolve(...args) {
		return new ProcPromise((resolve, reject) => {
			resolve(...args);
		});
	}

	static reject(...args) {
		return new ProcPromise((resolve, reject) => {
			reject(...args);
		});
	}

	static race(...args) {
		let retVal = super.race(...args);
		return new ProcPromise((resolve, reject) => {
			retVal.then(resolve, reject);
		});
	}

	static all(...args) {
		let retVal = super.all(...args);
		return new ProcPromise((resolve, reject) => {
			retVal.then(resolve, reject);
		});
	}
}


// take a normal function and make it an asyncronous promise
function makeAsyncPromise(context, options, task) {
	if(!context.valid) {
		throw new ThreadKiller(context);
	}
	if(typeof options === 'function') {
		if(task != null) {
			console.error(new Error("accidentally did the wrong order of arguments"));
		}
		task = options;
		options = {};
	}
	return wrapThread(context, {
		name: 'asyncPromise',
		...options,
		rethrowThreadKiller:true
	}, () => {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				if(!context.valid) {
					reject(new ThreadKiller(context));
					return;
				}
				try {
					const retVal = task();
					setTimeout(() => {
						resolve(retVal);
					}, 0);
				}
				catch(error) {
					setTimeout(() => {
						reject(error);
					}, 0);
				}
			}, 0);
		});
	});
}


// thread to queue function at next convenient time
const queueCallback = (context, options, callback) => {
	if(typeof options === 'function') {
		callback = options;
		options = {};
	}
	let timeout = null;
	let timeoutResolve = null;
	wrapThread(context, {
		name: 'queuedCallback',
		...options,
		cancel: () => {
			if(timeout) {
				clearTimeout(timeout);
				timeoutResolve();
			}
		}
	}, () => {
		return new Promise((resolve, reject) => {
			timeoutResolve = resolve;
			timeout = setTimeout(() => {
				timeout = null;
				try {
					callback();
				}
				catch(error) {
					if(!(error instanceof ThreadKiller)) {
						console.error(error);
					}
				}
				resolve();
			}, 0);
		});
	});
};




// ensure the running context is valid
function validateContext(context) {
	if(!context.valid) {
		throw new ThreadKiller(context);
	}
}


// unix signals
const Signals = {
	SIGHUP: 1,
	SIGINT: 2,
	SIGQUIT: 3,
	SIGILL: 4,
	SIGABRT: 6,
	SIGFPE: 8,
	SIGKILL: 9,
	SIGSEGV: 11,
	SIGPIPE: 13,
	SIGALRM: 14,
	SIGTERM: 15
};

// return the name of a signal from its numeric value
function getSignalName(signal) {
	for(const signalName in Signals) {
		if(Signals[signalName] === signal) {
			return signalName;
		}
	}
	return null;
}




const createReffedEventEmitterClass = (context, options={}, hasRefState) => {
	if(typeof options === 'function') {
		updateRefState = options;
		options = {};
	}
	const EventEmitter = options.baseClass || context.kernelModules.require('events');

	const updateRefState = (emitter) => {
		if(context.valid && hasRefState(emitter)) {
			if(context.eventEmitters.indexOf(emitter) === -1) {
				context.eventEmitters.push(emitter);
			}
		}
		else {
			const index = context.eventEmitters.indexOf(emitter);
			if(index !== -1) {
				context.eventEmitters.splice(index, 1);
			}
		}
	}

	class ReffedEventEmitter extends EventEmitter
	{
		addListener(event, ...args) {
			let retVal = super.addListener(event, ...args);
			updateRefState(this);
			return retVal;
		}

		removeListener(event, ...args) {
			let retVal = super.removeListener(event, ...args);
			updateRefState(this);
			return retVal;
		}

		on(event, ...args) {
			let retVal = super.on(event, ...args);
			updateRefState(this);
			return retVal;
		}

		once(event, ...args) {
			let retVal = super.once(event, ...args);
			updateRefState(this);
			return retVal;
		}

		off(event, ...args) {
			let retVal = super.off(event, ...args);
			updateRefState(this);
			return retVal;
		}

		prependListener(event, ...args) {
			let retVal = super.prependListener(event, ...args);
			updateRefState(this);
			return retVal;
		}

		prependOnceListener(event, ...args) {
			let retVal = super.prependOnceListener(event, ...args);
			updateRefState(this);
			return retVal;
		}

		removeAllListeners(...args) {
			let retVal = super.removeAllListeners(...args);
			updateRefState(this);
			return retVal;
		}
	};

	return {
		updateRefState,
		ReffedEventEmitter
	};
};



module.exports = {
	wrapThread,
	ThreadKiller,
	makeAsyncPromise,
	validateContext,
	Signals,
	getSignalName,
	queueCallback,
	createReffedEventEmitterClass,
	prepareToMaybeDie,
	ProcPromise
};
