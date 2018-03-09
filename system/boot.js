
const fs = require('fs');
const { spawn } = require('child_process');

syscall('log', "downloading init data...");

// set system paths
process.env.paths = ['/system/bin','/apps','/bin'];

// function to make a directory if it's missing
function mkdirIfMissing(path)
{
	if(!fs.existsSync(path))
	{
		fs.mkdirSync(path);
	}
}

// function to download a file to the "disk"
function downloadFile(url, path, options)
{
	options = Object.assign({}, options);
	return new Promise((resolve, reject) => {
		if(options.onlyIfMissing)
		{
			if(fs.existsSync(path))
			{
				resolve();
				return;
			}
		}
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = () => {
			if(xhr.readyState === 4)
			{
				if(xhr.status === 200)
				{
					fs.writeFileSync(path, xhr.responseText);
					resolve();
				}
				else
				{
					reject(new Error(xhr.status+": "+xhr.statusText));
				}
			}
		};

		xhr.open('GET', url+'?v='+(Math.random()*999999999));
		xhr.send();
	});
}

// create system folders
mkdirIfMissing('/system');
mkdirIfMissing('/system/bin');
mkdirIfMissing('/system/lib');
mkdirIfMissing('/system/slib');
mkdirIfMissing('/system/share');

// download system files
const downloads = [];
const downloadOptions = {onlyIfMissing: true};
downloads.push( downloadFile('cdn/ajax/libs/react/15.4.2/react.js', '/system/slib/react.js', downloadOptions) );
downloads.push( downloadFile('cdn/ajax/libs/react/15.4.2/react-dom.js', '/system/slib/react-dom.js', downloadOptions) );
downloads.push( downloadFile('cdn/ajax/libs/babel-standalone/6.21.1/babel.js', '/system/slib/babel.js', downloadOptions) );
downloads.push( downloadFile('cdn/ajax/libs/sass.js/0.10.9/sass.js', '/system/slib/sass.js', downloadOptions) );
downloads.push( downloadFile('system/init.jsx?v='+(Math.random()*9999999999), '/system/init.jsx') );

// wait for files to finish downloading
Promise.all(downloads).then(() => {
	syscall('log', "init data downloaded");
	
	// download sass.worker.js to give to scss
	syscall('log', "preparing scss...");
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = () => {
		if(xhr.readyState == 4)
		{
			if(xhr.status == 200)
			{
				// apply downloaded worker data to Sass
				var workerData = xhr.responseText;
				var workerURL = 'data:application/javascript;base64,'+btoa(workerData);
				const Sass = require('sass');
				Sass.setWorkerUrl(workerURL);
				syscall('log', "done preparing scss");

				// boot
				syscall('log', "starting...");
				spawn('/system/init');
			}
			else
			{
				// error
				var errorMessage = "sass.worker.js download failed";
				if(xhr.status !== 0)
				{
					errorMessage += " with status "+xhr.status;
					if(xhr.statusText)
					{
						errorMessage += ": "+xhr.statusText;
					}
				}
				console.error(errorMessage);
				syscall('log', "fatal error", {color: 'red'});
				syscall('log', errorMessage, {color: 'red'});
			}
		}
	}
	xhr.open('GET', 'cdn/ajax/libs/sass.js/0.10.9/sass.worker.min.js');
	xhr.send();
}).catch((error) => {
	console.error("kernel error: ", error);
	syscall('log', "fatal error", {color: 'red'});
	syscall('log', error.toString(), {color: 'red'});
});
