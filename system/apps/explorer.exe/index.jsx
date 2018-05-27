
requireCSS('./style.css');
const React = require('react');
const ReactDOM = require('react-dom');
const FileIconLayout = require('shell32.dll/FileIconLayout');
const fs = require('fs');
const { spawn } = require('child_process');

var windowManager = process.env['WINDOW_MANAGER'];
if(!windowManager)
{
	console.error("no window manager detected");
	process.exit(1);
}

windowManager.createWindow().then((window) => {
	// window created

	let files = [];
	let filesError = null;
	function reloadFiles(dir)
	{
		try
		{
			files = fs.readdirSync(dir);
		}
		catch(error)
		{
			filesError = error;
		}
	}
	reloadFiles('/');

	function onFileOpen(filename)
	{
		console.log("onFileOpen");
		try
		{
			var stats = fs.statSync('./'+filename);
			if(stats.isDirectory())
			{
				process.chdir('./'+filename);
				console.log("directory switched to "+process.cwd());
				reloadFiles(process.cwd());
				window.setState({
					dir: process.cwd()
				});
			}
			else if(stats.isFile())
			{
				child_process.spawn('open', ['./'+filename]);
			}
			else
			{
				throw new Error("cannot open unknown file type");
			}
		}
		catch(error)
		{
			console.error(error);
		}
	}

	// render content
	window.renderContent = () => {
		return (
			<div className="explorer">
				{ filesError
					? (<div className="error">{filesError.message}</div>)
					: (<FileIconLayout files={files} onFileOpen={onFileOpen}/>) }
			</div>
		);
	};

	// handle close button
	window.onCloseButtonClick = () => {
		window.close();
		process.exit(0);
	};

	// set initial state
	window.setState({
		title: 'explorer.exe',
		dir: '/'
	});
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});