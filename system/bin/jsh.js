
const fs = require('fs');
const { spawn } = require('child_process');

var currentPromise = null;
var currentProcess = null;


function prompt()
{
	process.stdout.write("~$ ");
}


function runShellCommand(command, ...args)
{
	switch(command)
	{
		default:
			return null;

		case 'cd':
			if(args[0])
			{
				try
				{
					process.chdir(args[0]);
				}
				catch(error)
				{
					console.error(error);
					return 1;
				}
			}
			return 0;

		case 'exit':
			var exitCode = 0;
			if(args[0])
			{
				exitCode = parseInt(args[0]);
				if(Number.isNaN(exitCode) || exitCode < 0)
				{
					console.error(""+args[0]+" is not a positive integer");
					return 1;
				}
			}
			process.exit(exitCode);
			return 0;
	}
}


function runCommand(command, ...args)
{
	return new Promise((resolve, reject) => {
		// try to run command as a built-in
		try
		{
			var retVal = runShellCommand(command, ...args);
			if(retVal != null)
			{
				// command run as a built-in
				if(retVal instanceof Promise)
				{
					retVal.then((exitCode) => {
						resolve(exitCode);
					}).catch((error) => {
						reject(error);
					});
				}
				else if(typeof retVal === 'number')
				{
					resolve(retVal);
				}
				else
				{
					resolve(0);
				}
				return;
			}
		}
		catch(error)
		{
			if(error instanceof ExitSignal)
			{
				throw error;
			}
			console.error(error);
			resolve(1);
			return;
		}

		// try to run executable
		var subprocess = spawn(command, args);

		// forward I/O
		subprocess.stdout.on('data', (chunk) => {
			process.stdout.write(chunk);
		});
		subprocess.stderr.on('data', (chunk) => {
			process.stderr.write(chunk);
		});

		let processExited = false;

		// handle error
		subprocess.on('error', (error) => {
			currentProcess = null;
			if(!processExited)
			{
				processExited = true;
				reject(error);
			}
		});

		// handle exit
		subprocess.on('exit', (exitCode) => {
			currentProcess = null;
			if(!processExited)
			{
				processExited = true;
				resolve(exitCode);
			}
		});

		currentProcess = subprocess;
	});
}



// listen for input
process.stdin.on('data', (chunk) => {
	if(currentProcess)
	{
		currentProcess.stdin.write(chunk);
		return;
	}
	else if(currentPromise)
	{
		return;
	}

	var command = ''+chunk;
	var cmdParts = command.split(new RegExp('\\s+'));
	for(var i=0; i<cmdParts.length; i++)
	{
		if(cmdParts[i]=="")
		{
			cmdParts.splice(i,1);
			i--;
		}
	}

	if(cmdParts.length == 0)
	{
		process.stdout.write('\n');
		prompt();
		return;
	}

	process.stdout.write(command);
	currentPromise = runCommand(cmdParts[0], ...cmdParts.slice(1));
	currentPromise.then(() => {
		currentPromise = null;
		prompt();
	}).catch((error) => {
		currentPromise = null;
		console.error(error.message);
		prompt();
	});
});


prompt();
