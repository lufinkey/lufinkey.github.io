
requireCSS('./style.css');
const fs = require('fs');
const React = require('react');

var windowManager = process.env['WINDOW_MANAGER'];
if(!windowManager)
{
	console.error("no window manager detected");
	process.exit(1);
}

// parse arguments
let url = null;
var urlFile = null;
for(var i=1; i<process.argv.length; i++)
{
	var arg = process.argv[i];
	if(arg == "-f")
	{
		if(urlFile)
		{
			console.error("cannot specify multiple files to open");
			process.exit(1);
		}
		i++;
		var value = process.argv[i];
		urlFile = value;
	}
	else
	{
		if(url)
		{
			console.error("cannot specify multiple URLs");
			process.exit(1);
		}
		url = arg;
	}
}
if(url && urlFile)
{
	console.error("cannot specify both url and file");
	process.exit(1);
}

// read the url from the file, if specified
if(urlFile)
{
	url = fs.readFileSync(urlFile, {encoding:'utf8'});
}

// create window
windowManager.createWindow().then((window) => {
	// window created
	
	// render the window
	window.renderContent = () => {
		return (
			<iframe className="iframe-content" src={url} scrolling='yes'></iframe>
		);
	};

	// handle close button
	window.onCloseButtonClick = () => {
		window.close();
		process.exit(0);
	};

	// set initial state
	window.setState({
		title: "iframe.exe"
	});
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
