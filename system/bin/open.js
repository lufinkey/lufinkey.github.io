
const fs = require('fs');
const { spawn } = require("child_process");
const MimeType = require('mimetype');

if(process.argv.length !== 2)
{
	console.error("invalid number of arguments");
	process.exit(1);
}

// get filename
var filename = process.argv[1];

// determine mime type
var mimeType = MimeType.determine(filename);

// load app defaults
var appdefaults = null;
try
{
	appdefaults = JSON.parse(fs.readFileSync('/system/share/appdefaults.json', {encoding: 'utf8'}));
}
catch(error)
{
	console.error("unable to read app defaults: "+error.message);
	process.exit(1);
}

// get command to use to launch the file
var defaultcmd = appdefaults[mimeType];
if(!defaultcmd)
{
	console.error("no default app is defined for file type "+mimeType);
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

// replace %@ with the filename
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
var subprocess = spawn(defaultcmd[0], defaultcmd.slice(1));

subprocess.on('error', (error) => {
	console.error("program execution failed:");
	console.error(error);
	process.exit(1);
});

subprocess.on('exit', (exitCode) => {
	process.exit(exitCode);
});
