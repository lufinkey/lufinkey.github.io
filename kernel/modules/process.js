
const {
	resolveRelativePath
} = await krequire('kernel/util.js');
const {
	ThreadKiller
} = await krequire('kernel/process/thread.js');



module.exports = (context) => {
	
	const EventEmitter = context.kernelModules.require('events');

	class Process extends EventEmitter
	{
		constructor() {
			super();

			let argv = context.argv.slice(0);
			Object.defineProperties(this, {
				'argv': {
					value: argv
				},
				'chdir': {
					value: (path) => {
						path = resolveRelativePath(context, path);
						var stats = context.kernelModules.require('fs').statSync(path);
						if(!stats.isDirectory()) {
							throw new Error("path is not a directory");
						}
						context.cwd = path;
					},
					writable: false
				},
				'cwd': {
					value: () => {
						return context.cwd;
					},
					writable: false
				},
				'env': {
					get: () => {
						return context.env;
					},
					set: (value) => {
						context.env = value;
					}
				},
				'exit': {
					value: (code) => {
						if(code == null) {
							code = 0;
						}
						if(typeof code !== 'number' || !Number.isInteger(code) || code < 0) {
							throw new Error("invalid exit code");
						}
						if(context.exiting) {
							throw new Error("cannot exit process more than once");
						}
						context.exiting = true;
						if(context.valid) {
							// call exit event
							try {
								this.emit('exit', code, null);
							}
							catch(error) {
								console.error(error);
							}
							// end process
							context.invalidate(code, null);
						}
						throw new ThreadKiller(context);
					},
					writable: false
				},
				'kill': {
					value: (pid, signal) => {
						if(!Number.isInteger(pid) || pid < 0) {
							throw new TypeError("pid must be a positive integer");
						}
						if(typeof signal === 'string') {
							var signalNum = signals[signal];
							if(signalNum == null) {
								throw new Error("invalid signal "+signal);
							}
							signal = signalNum;
						}
						if(!Number.isInteger(signal) || signal < 0) {
							throw new Error("signal must be a positive integer or a valid string");
						}
						const killContext = processes[''+pid];
						if(!killContext) {
							throw new Error("pid does not exist");
						}
						else if(context.uid !== 0 && killContext.uid !== context.uid && killContext.gid !== context.gid) {
							throw new Error("pid does not exist");
						}
						killContext.signal(signal);
					},
					writable: false
				},
				'uid': {
					get: () => {
						return context.uid;
					}
				},
				'gid': {
					get: () => {
						return context.gid;
					}
				},
				'pid': {
					get: () => {
						return context.pid;
					}
				},
				'ppid': {
					get: () => {
						if(context.parentContext == null) {
							return null;
						}
						return context.parentContext.pid;
					}
				},
				'platform': {
					get: () => {
						return kernel.osName;
					}
				},
				'stdin': {
					get: () => {
						return context.stdin.reader;
					}
				},
				'stdout': {
					get: () => {
						return context.stdout.writer;
					}
				},
				'stderr': {
					get: () => {
						return context.stderr.writer;
					}
				}
			});
		}
	};


	return new Process();
};
