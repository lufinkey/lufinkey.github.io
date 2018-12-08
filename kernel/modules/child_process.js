
const {
	deepCopyObject
} = await krequire('kernel/util.js');
const {
	findModulePath,
	requireScriptFile
} = await krequire('kernel/require.js');
const {
	createTwoWayStream
} = await krequire('kernel/process/streams.js');
const {
	queueCallback
} = await krequire('kernel/process/thread.js');




module.exports = (context) => {

	const EventEmitter = context.kernelModules.require('events');
	const fs = context.kernelModules.require('fs');
	const Path = context.kernelModules.require('path');


	class ChildProcess extends EventEmitter
	{
		constructor(path, args=[], options={}) {
			super();

			// validate parameters
			if(typeof path !== 'string') {
				throw new TypeError("path must be a string");
			}
			if(!(args instanceof Array)) {
				throw new TypeError("args must be an Array");
			}
			for(const arg of args) {
				if(typeof arg !== 'string') {
					throw new TypeError("args must be an array of strings");
				}
			}
			options = Object.assign({}, options);

			// create new context
			const childContext = context.createChildContext({
				cwd: options.cwd,
				env: options.env
			});
			const procInfo = {
				childProcess: this,
				detached: options.detached
			};

			// validate options
			let argv0 = path;
			if(options.cwd != null) {
				if(typeof options.cwd !== 'string') {
					throw new TypeError("options.cwd must be a string");
				}
			}
			if(options.env != null) {
				if(typeof options.env !== 'object') {
					throw new TypeError("options.env must be an object")
				}
			}
			if(options.argv0 != null) {
				if(typeof options.argv0 !== 'string') {
					throw new TypeError("options.argv0 must be a string");
				}
				argv0 = options.argv0;
			}
			if(options.uid != null) {
				if(!Number.isInteger(options.uid) || options.uid < 0) {
					throw new TypeError("options.uid must be a positive integer");
				}
			}
			if(options.gid != null) {
				if(!Number.isInteger(options.gid) || options.gid < 0) {
					throw new TypeError("options.gid must be a positive integer");
				}
			}
			procInfo.argv = [argv0].concat(args);

			// build I/O streams
			procInfo.stdio = {
				in: createTwoWayStream(context, childContext, {threading: true}),
				out: createTwoWayStream(childContext, context, {threading: true}),
				err: createTwoWayStream(childContext, context, {threading: true})
			};

			// TODO apply all properties
			Object.defineProperties(this, {
				pid: {
					get: () => {
						return childContext.pid;
					}
				},
				stdin: {
					value: procInfo.stdio.in.writer,
					writable: false
				},
				stdout: {
					value: procInfo.stdio.out.reader,
					writable: false
				},
				stderr: {
					value: procInfo.stdio.err.reader,
					writable: false
				},
				kill: {
					value: (signal) => {
						if(signal == null) {
							signal = signals.SIGTERM;
						}
						else if(typeof signal === 'string') {
							var signalNum = signals[signal];
							if(signalNum == null) {
								throw new Error("invalid signal "+signal);
							}
							signal = signalNum;
						}
						if(!Number.isInteger(signal) || signal < 0) {
							throw new TypeError("signal must be a positive integer or a valid string");
						}
						childContext.signal(signal);
					},
					writable: false
				}
			});

			// try to start the process
			try {
				// set uid and gid
				procInfo.uid = context.uid;
				if(options.uid != null) {
					if(options.uid !== context.uid && context.uid !== 0) {
						throw new Error("Permission Denied: cannot set uid of child process from underprivileged user");
					}
					procInfo.uid = options.uid;
				}
				procInfo.gid = context.gid;
				if(options.gid != null) {
					// TODO check if uid is in gid group
					if(context.gid !== 0 && options.gid === 0) {
						throw new Error("Permission Denied: cannot join root group from underprivileged user");
					}
					procInfo.gid = options.gid;
				}

				// get full module path
				var paths = [];
				if(context.env && context.env.paths) {
					paths = context.env.paths;
				}
				const filename = findModulePath(context, paths, context.cwd, path, {dirExtensions: kernel.options.binDirExtensions});
				const dirname = Path.dirname(filename);
				fs.accessSync(filename, fs.constants.X_OK);
				procInfo.filename = filename;

				// create process
				childContext.becomeProcess(procInfo);

				// create child process kernel modules in next queue
				queueCallback(childContext, {name: 'preMain'}, () => {
					// load child kernel modules
					childContext.kernelModules.require('builtins');
					childContext.kernelModules.require('process');
					childContext.kernelModules.require('fs');
					// start the process in the next queue
					queueCallback(childContext, {name: 'main'}, () => {
						// start the process
						requireScriptFile(childContext, filename);
					});
				});
			}
			catch(error) {
				childContext.invalidate();
				// send error in the next queue
				
				queueCallback(context, {name: 'childProcessError'}, () => {
					// send error
					this.emit('error', error);
				});
			}
		}
	}



	// spawn a child process
	const spawn = (command, args=[], options=null) => {
		if(args != null && typeof args === 'object' && !(args instanceof Array)) {
			options = args;
			args = [];
		}
		if(typeof command !== 'string') {
			throw new TypeError("command must be a string");
		}
		return new ChildProcess(command, args, options);
	}



	// export
	return {
		ChildProcess,
		spawn
	};
}
