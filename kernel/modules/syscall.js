
const {
	wrapThread,
	ThreadKiller
} = await krequire('kernel/process/thread.js');



module.exports = (context) => {
	// append information to the system log
	const syslog = (message, options) => {
		return kernel.log(message, options);
	}



	// call special kernel functions
	const syscall = (func, ...args) => {
		if(!context.valid) {
			throw new ThreadKiller(context);
		}
		
		if(typeof func != 'string') {
			throw new Error("func must be a string");
		}
		func = ''+func;

		var funcParts = func.split('.');
		if(funcParts.length > 2) {
			throw new Error("invalid system call");
		}
		switch(funcParts[0]) {
			case 'log':
				if(funcParts.length > 1) {
					throw new Error("invalid system call");
				}
				return syslog(...args);

			case 'thread':
				if(funcParts.length > 1) {
					throw new Error("invalid system call");
				}
				const callback = args[0];
				const cancel = args[1];
				const options = Object.assign({}, args[2]);
				if(typeof callback !== 'function') {
					throw new TypeError("callback must be a function");
				}
				if(typeof cancel !== 'function') {
					throw new TypeError("cancel must be a function");
				}
				return wrapThread(context, {
					name: 'syscall.thread',
					...options,
					rethrowThreadKiller: true,
					cancel: cancel
				}, callback);

			case 'reboot':
				if(funcParts.length > 1) {
					throw new Error("invalid system call");
				}
				if(context.uid !== 0) {
					throw new Error("Permission Denied");
				}
				setTimeout(() => {
					kernel.reboot();
				}, 0);
				break;

			default:
				throw new Error("invalid system call");
		}
	}


	// export
	return {
		syscall,
		syslog
	};
};
