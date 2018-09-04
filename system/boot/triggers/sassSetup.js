
const Sass = require('sass');
const { download } = require('misc');

// download sass worker
download('https://cdnjs.cloudflare.com/ajax/libs/sass.js/0.10.9/sass.worker.min.js').then((workerData) => {
	// apply downloaded worker data to Sass
	const workerURL = 'data:application/javascript;base64,'+btoa(workerData);
	Sass.setWorkerUrl(workerURL);
	process.exit(0);
}).catch((error) => {
	console.error(error);
	process.exit(1);
});
