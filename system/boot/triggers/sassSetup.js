
const Sass = require('sass');

// download sass worker
var xhr = new XMLHttpRequest();
xhr.onreadystatechange = () => {
	if(xhr.readyState == 4)
	{
		if(xhr.status == 200)
		{
			// apply downloaded worker data to Sass
			var workerData = xhr.responseText;
			var workerURL = 'data:application/javascript;base64,'+btoa(workerData);
			Sass.setWorkerUrl(workerURL);
			process.exit(0);
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
			process.exit(1);
		}
	}
}
xhr.open('GET', 'https://cdnjs.cloudflare.com/ajax/libs/sass.js/0.10.9/sass.worker.min.js');
xhr.send();
