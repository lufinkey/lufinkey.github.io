
const fs = require('fs');

var dir = process.cwd();
if(process.argv[1])
{
	dir = process.argv[1];
}

try
{
	var contents = fs.readdirSync(dir);
	for(const entry of contents)
	{
		process.stdout.write(entry+'\n');
	}
}
catch(error)
{
	console.error(error.message);
	process.exit(1);
}

process.exit(0);
