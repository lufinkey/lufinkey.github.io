
const fs = require('fs');

var filename = process.argv[1];
if(filename == null)
{
	console.error("no filename specified");
	process.exit(1);
}

try
{
	var data = fs.readFileSync(filename, {encoding: 'utf8'});
	process.stdout.write(data+'\n');
}
catch(error)
{
	console.error(error.message);
	process.exit(1);
}

process.exit(0);
