
const KernelModuleLoader = await krequire('kernel/modules/index.js');
const {
	resolveRelativePath,
	deepCopyObject
} = await krequire('kernel/util.js');
const {
	Signals,
	getSignalName,
	prepareToMaybeDie
} = await krequire('kernel/process/thread.js');
const {
	unloadCSS
} = await krequire('kernel/require.js');



class Context
{
	constructor(parentContext = null, options={}) {
		options = Object.assign({}, options);

		// validate options
		if(options.cwd != null) {
			if(typeof options.cwd !== 'string') {
				throw new TypeError("options.cwd must be a string");
			}
			options.cwd = resolveRelativePath(parentContext, options.cwd);
		}
		let env = deepCopyObject(parentContext ? parentContext.env : {});
		if(options.env) {
			env = Object.assign(env, options.env);
		}

		// assign properties
		Object.assign(this, {
			pid: undefined,
			cwd: options.cwd || (parentContext ? parentContext.cwd : '/'),
			uid: parentContext ? parentContext.uid : 0,
			gid: parentContext ? parentContext.gid : 0,
			umask: parentContext ? parentContext.umask : 0o022,

			global: {},

			stdin: null,
			stdout: null,
			stderr: null,

			argv: [],
			env: env,
			filename: parentContext ? parentContext.filename : null,
			childProcess: null,
			
			timeouts: [],
			intervals: [],
			immediates: [],
			nextThreadID: 1,
			threads: [],
			eventEmitters: [],
			childContexts: [],
			parentContext: parentContext,

			kernelModules: new KernelModuleLoader(this),
			modules: {},
			loadedCSS: [],

			valid: true,
			invalidating: false,
			exiting: false
		});
	}



	becomeProcess({ uid, gid, filename, argv, stdio, ...options }) {
		if(this.pid != null) {
			throw new Error("context has already become a process");
		}
		// set uid and gid
		this.uid = uid;
		this.gid = gid;
		// set filename + command arguments
		this.filename = filename;
		this.argv = argv;
		// set stdio
		if(stdio) {
			if(stdio.in) {
				this.stdin = {
					writer: stdio.in.writer,
					reader: stdio.in.reader
				};
			}
			if(stdio.out) {
				this.stdout = {
					writer: stdio.out.writer,
					reader: stdio.out.reader
				};
			}
			if(stdio.err) {
				this.stderr = {
					writer: stdio.err.writer,
					reader: stdio.err.reader
				};
			}
		}
		// set extra args
		if(options.childProcess) {
			this.childProcess = options.childProcess;
		}
		// check if detached
		if(!options.detached) {
			// store in parent context
			if(this.parentContext) {
				this.parentContext.childContexts.push(this);
			}
		}
		else {
			// store in base context (pid=1)
			const baseContext = kernel.runningProcesses['1'];
			if(!baseContext) {
				throw new Error("no running base context to attach process to");
			}
			this.parentContext = baseContext;
			baseContext.childContexts.push(this);
		}
		// set pid
		this.pid = kernel.pidCounter;
		kernel.pidCounter++;
		// add process to list
		kernel.runningProcesses[''+this.pid] = this;
	}

	get process() {
		return this.kernelModules.require('process');
	}



	createChildContext(options) {
		return new Context(this, options);
	}



	// check if any threads, timeouts, intervals, or immediates exist that would stop the context from finishing
	hasRunningCode(options={}) {
		options = Object.assign({}, options);
		/*console.log("pid "+this.pid+" has "+
			this.threads.length+" threads, "+
			this.childContexts.length+" children, "+
			this.timeouts.length+" timeouts, "+
			this.intervals.length+" intervals, "+
			"and "+this.immediates.length+" immediates");*/
		if(options.ignoreThreads) {
			for(const thread of this.threads) {
				if(options.ignoreThreads.indexOf(thread.id) === -1) {
					return true;
				}
			}
		}
		else if(this.threads.length > 0) {
			return true;
		}
		else if(this.eventEmitters.length > 0) {
			return true;
		}
		if(options.ignorePIDs) {
			for(const childContext of this.childContexts) {
				if(options.ignorePIDs.indexOf(childContext.pid) === -1) {
					return true;
				}
			}
		}
		else if(this.childContexts.length > 0) {
			return true;
		}
		for(let timeout of this.timeouts) {
			if(timeout.hasRef()) {
				return true;
			}
		}
		for(let interval of this.intervals) {
			if(interval.hasRef()) {
				return true;
			}
		}
		for(let immediate of this.immediates) {
			if(immediate.hasRef()) {
				return true;
			}
		}
		return false;
	}



	// send a signal to the running context
	signal(signal) {
		if(!Number.isInteger(signal) || signal < 0) {
			throw new TypeError("signal must be a positive integer");
		}
		// ignore signal if context is invalid
		if(!this.valid) {
			throw new Error("process "+this.pid+" does not exist");
		}
		// kill immediately if sigkill
		if(signal === Signals.SIGKILL) {
			this.invalidate(null, signal);
			return;
		}
		// ignore if signal is 0
		if(signal === 0) {
			return;
		}
		// get signal name and emit event if there is a listener
		const signalName = getSignalName(signal);
		if(signalName != null && this.process != null && this.process.listenerCount(signalName) > 0) {
			try {
				this.process.emit(signalName);
			}
			catch(error) {
				console.error(error);
			}
			if(!this.hasRunningCode()) {
				this.invalidate(0, null);
			}
		}
		else {
			this.invalidate(null, signal);
		}
	}



	invalidate(exitCode, signal) {
		if(this.valid && !this.invalidating) {
			this.invalidating = true;

			// unload CSS
			if(this.pid != null) {
				for(const cssPath in kernel.loadedCSS) {
					var info = kernel.loadedCSS[cssPath];
					var index = info.pids.indexOf(this.pid);
					if(index != -1) {
						info.pids.splice(index, 1);
					}
					if(info.pids.length == 0) {
						unloadCSS(this, cssPath);
					}
				}
			}

			// destroy timeouts, intervals, and immediates
			for(const timeout of this.timeouts) {
				clearTimeout(timeout.id);
			}
			this.timeouts = [];
			for(const interval of this.intervals) {
				clearInterval(interval.id);
			}
			this.intervals = [];
			for(const immediate of this.immediates) {
				clearInterval(immediate.id);
			}
			this.immediates = [];

			// clear event emitters
			this.eventEmitters = [];

			// kill threads
			const threads = this.threads.slice(0);
			for(let thread of threads) {
				if(thread.cancel) {
					try {
						thread.cancel();
					}
					catch(error) {
						console.error(error);
					}
				}
				thread.cancelled = true;
			}

			// kill child contexts
			const childContexts = this.childContexts.slice(0);
			this.childContexts = [];
			for(const childContext of childContexts) {
				// send signal to child context if it's valid
				if(childContext.valid) {
					if(signal != null) {
						childContext.signal(signal);
					}
					else {
						childContext.signal(Signals.SIGHUP);
					}
				}
				// reassign child's parent if the child is still alive
				if(childContext.valid && !childContext.invalidating) {
					// set next valid parent context
					const nextParentContext = this.parentContext;
					while(nextParentContext != null && !nextParentContext.valid) {
						nextParentContext = nextParentContext.parentContext;
					}
					if(nextParentContext == null || nextParentContext.pid === 0) {
						// kill child if there's no valid parent
						childContext.invalidate(null, Signals.SIGKILL);
					}
					else {
						// reassign parent context
						childContext.parentContext = nextParentContext;
					}
				}
			}

			// destroy pipes
			if(this.stdin) {
				this.stdin.writer.destroy();
				this.stdin.reader.destroy();
			}
			if(this.stdout) {
				this.stdout.writer.destroy();
				this.stdout.reader.destroy();
			}
			if(this.stderr) {
				this.stderr.writer.destroy();
				this.stderr.reader.destroy();
			}

			// make context invalid
			this.valid = false;

			// wait for death
			this.waitForProcessToDie(() => {
				// remove from process list
				delete kernel.runningProcesses[''+this.pid];
			});

			// send exit event to parent process if necessary
			if(this.childProcess && (exitCode != null || signal != null)) {
				// wait for next queue to emit event
				setTimeout(() => {
					this.childProcess.emit('exit', exitCode, signal);
				}, 0);
			}

			// remove from parent context
			setTimeout(() => {
				if(this.parentContext) {
					if(this.parentContext.valid && !this.parentContext.invalidating) {
						prepareToMaybeDie(this.parentContext, {ignorePIDs: [this.pid]}, () => {
							if(this.parentContext) {
								const index = this.parentContext.childContexts.indexOf(this);
								if(index !== -1) {
									this.parentContext.childContexts.splice(index, 1);
								}
								this.parentContext = null;
							}
						});
					}
					else {
						const index = this.parentContext.childContexts.indexOf(this);
						if(index !== -1) {
							this.parentContext.childContexts.splice(index, 1);
						}
						this.parentContext = null;
					}
				}
			}, 0);
		}
	}



	waitForProcessToDie(options={}, callback) {
		if(typeof options === 'function') {
			callback = options;
			options = {};
		}
		else if(options == null || typeof options !== 'object') {
			options = {};
		}
		if(this.threads.length == 0) {
			if(options.log) {
				console.log("process "+this.pid+" has died");
			}
			callback();
			return;
		}
		if(options.log) {
			console.log("process "+this.pid+" has "+this.threads.length+" threads waiting to die");
			console.log(this.threads);
		}
		setTimeout(() => {
			this.waitForProcessToDie(options, callback);
		}, 100);
	}
}




// export
module.exports = {
	Context
};
