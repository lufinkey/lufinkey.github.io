
const delayTime = Number.parseInt(process.argv[1]);
if(!delayTime) {
	delayTime = 1000;
}

setTimeout(() => {
	process.exit(0);
}, delayTime);
