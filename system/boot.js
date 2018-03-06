
const rootContext = kernel.rootContext;

kernel.log(rootContext, "downloading init data...");

// create system folders
const dirOptions = {ignoreIfExists: true};
kernel.filesystem.createDir(rootContext, '/system', dirOptions);
kernel.filesystem.createDir(rootContext, '/system/bin', dirOptions);
kernel.filesystem.createDir(rootContext, '/system/lib', dirOptions);
kernel.filesystem.createDir(rootContext, '/system/slib', dirOptions);
kernel.filesystem.createDir(rootContext, '/system/share', dirOptions);
// delete and remake tmp
kernel.filesystem.deleteDir(rootContext, '/tmp');
kernel.filesystem.createDir(rootContext, '/tmp', dirOptions);

// download system files
const downloads = [];
const downloadOptions = {onlyIfMissing: true};
downloads.push( kernel.filesystem.downloadFile(rootContext, 'https://cdnjs.cloudflare.com/ajax/libs/react/15.4.2/react.js', '/system/slib/react.js', downloadOptions) );
downloads.push( kernel.filesystem.downloadFile(rootContext, 'https://cdnjs.cloudflare.com/ajax/libs/react/15.4.2/react-dom.js', '/system/slib/react-dom.js', downloadOptions) );
downloads.push( kernel.filesystem.downloadFile(rootContext, 'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/6.21.1/babel.js', '/system/slib/babel.js', downloadOptions) );
downloads.push( kernel.filesystem.downloadFile(rootContext, 'https://cdnjs.cloudflare.com/ajax/libs/sass.js/0.10.9/sass.js', '/system/slib/sass.js', downloadOptions) );
downloads.push( kernel.filesystem.downloadFile(rootContext, 'system/init.jsx?v='+(Math.random()*9999999999), '/system/init.jsx') );

// wait for files to finish downloading
const ProcPromise = kernel.ProcPromise;
ProcPromise.all(rootContext, downloads).then(() => {
	kernel.log(rootContext, "init data downloaded");
	
	// download sass.worker.js to give to scss
	kernel.log(rootContext, "preparing scss...");
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = () => {
		if(xhr.readyState == 4)
		{
			if(xhr.status == 200)
			{
				// apply downloaded worker data to Sass
				var workerData = xhr.responseText;
				var workerURL = 'data:application/javascript;base64,'+btoa(workerData);
				const Sass = kernel.require(rootContext, {}, '/', 'sass');
				Sass.setWorkerUrl(workerURL);
				kernel.log(rootContext, "done preparing scss");

				// boot
				kernel.log(rootContext, "starting...");
				kernel.execute(rootContext, '/system/init');
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
				kernel.log(rootContext, "fatal error", {color: 'red'});
				kernel.log(rootContext, errorMessage, {color: 'red'});
			}
		}
	}
	xhr.open('GET', 'https://cdnjs.cloudflare.com/ajax/libs/sass.js/0.10.9/sass.worker.min.js');
	xhr.send();
}).catch((error) => {
	console.error("kernel error: ", error);
	kernel.log(rootContext, "fatal error", {color: 'red'});
	kernel.log(rootContext, error.toString(), {color: 'red'});
});
