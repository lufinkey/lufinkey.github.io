
const path = require('path');

if(process.argv.length !== 2)
{
	console.error("invalid number of arguments");
	process.exit(1);
}

// get filename and extension
var filename = process.argv[1];
var extension = path.extname(filename);
if(extension.startsWith('.'))
{
	extension = extension.substring(1, extension.length);
}

// load app defaults
var appdefaults = null;
try
{
	appdefaults = JSON.parse(syscall('filesystem.readFile', '/system/share/appdefaults.json'));
}
catch(error)
{
	console.error("unable to read app defaults: "+error.message);
	process.exit(1);
}

var defaultcmd = appdefaults[extension];
if(!defaultcmd)
{
	console.error("no default app is defined for "+extension);
	process.exit(1);
}
else if(!(defaultcmd instanceof Array))
{
	console.error("invalid appdefaults entry");
	process.exit(1);
}
else if(defaultcmd.length === 0)
{
	console.error("appdefaults entry must have arguments");
	process.exit(1);
}

for(var i=1; i<defaultcmd.length; i++)
{
	var arg = defaultcmd[i];
	if(typeof arg !== 'string')
	{
		console.error("invalid argument for appdefaults entry");
		process.exit(1);
	}
	else
	{
		defaultcmd[i] = arg.replace('%@', filename);
	}
}

// launch the process
console.log("launching \""+defaultcmd.join('" "')+"\"");
syscall('execute', defaultcmd[0], defaultcmd.slice(1)).promise.then(() => {
	// the process executed successfully
	process.exit(0);
}).catch((error) => {
	// TODO maintain the program's exit code
	console.error("program execution failed:");
	console.error(error);
	process.exit(2);
});
