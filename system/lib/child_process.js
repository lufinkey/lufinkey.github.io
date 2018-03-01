
const child_process = {};
module.exports = child_process;


class ChildProcess
{
	constructor(command, subprocess, error)
	{
		if(!command)
		{
			throw new TypeError("invalid subprocess data");
		}

		if(subprocess == null)
		{
			setTimeout(() => {
				if(error)
				{
					this.emit("error", error);
				}
				else
				{
					this.emit("error", new Error("invalid command "+command));
				}
			}, 0);
		}
		else
		{
			if(typeof subprocess.pid !== 'number' || !(subprocess.promise instanceof Promise))
			{
				throw new TypeError("invalid subprocess data");
			}

			subprocess.promise.then((...args) => {
				setTimeout(() => {
					this.emit("exit", 0, null);
				}, 0);
			}).catch((error) => {
				setTimeout(() => {
					if(typeof error.exitCode === 'number' && Number.isInteger(error.exitCode))
					{
						this.emit("exit", error.exitCode, null);
					}
					else
					{
						this.emit("exit", 1, null);
					}
				}, 0);
			});
		}

		Object.defineProperty(this, 'pid', {
			get: () => {
				if(!subprocess)
				{
					return undefined;
				}
				return subprocess.pid;
			}
		});
	}

	emit(eventName, ...args)
	{
		// TODO this is just a placeholder for now
	}
}




function spawn(command, args=[], options=null)
{
	if(typeof args === 'object' && !(args instanceof Array))
	{
		options = args;
		args = [];
	}
	if(typeof command !== 'string')
	{
		throw new TypeError("command must be a string");
	}
	if(!(args instanceof Array))
	{
		throw new TypeError("args must be an array");
	}

	let subprocess = null;
	let subprocessError = null;
	try
	{
		subprocess = syscall('execute', command, args, options);
	}
	catch(error)
	{
		if(error instanceof TypeError)
		{
			throw error;
		}
		else
		{
			subprocessError = error;
		}
	}

	return new ChildProcess(command, subprocess, subprocessError);
}
