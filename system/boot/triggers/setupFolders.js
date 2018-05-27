
const fs = require('fs');

const requiredFolders = [
	'/apps',
	'/home',
	'/home/Desktop'
];

for(const folder of requiredFolders) {
	if(!fs.existsSync(folder)) {
		fs.mkdirSync(folder);
	}
}

process.exit(0);
