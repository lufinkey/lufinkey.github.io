
requireCSS('./style.css');
const fs = require('fs');
const React = require('react');

var windowManager = process.env['WINDOW_MANAGER'];
if(!windowManager)
{
	console.error("no window manager detected");
	process.exit(1);
}

if(process.argv.length > 2)
{
	console.error("too many arguments");
	process.exit(1);
}

var defaultTextBody = "";
try
{
	if(process.argv.length === 2)
	{
		defaultTextBody = fs.readFileSync(process.argv[1], {encoding: 'utf8'});
	}
}
catch(error)
{
	console.error("unable to read file: ", error);
	process.exit(2);
}

windowManager.createWindow().then((window) => {
	// window created
	window.renderContent = () => {
		return (
			<textarea className="textedit-area" defaultValue={defaultTextBody}></textarea>
		);
	};

	// handle close button
	window.onCloseButtonClick = () => {
		window.close();
		process.exit(0);
	};

	// set initial state
	window.setState({
		title: "textedit.exe"
	});
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
