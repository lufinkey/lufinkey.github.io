
const { spawn } = require('child_process');

var subprocess = spawn('aboutme');

subprocess.on('error', (error) => {
	console.error(error);
	process.exit(1);
});

subprocess.on('exit', (exitCode) => {
	process.exit(exitCode);
});
