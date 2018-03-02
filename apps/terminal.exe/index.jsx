
requireCSS('./style.css');
const React = require('react');

var windowManager = process.env['WINDOW_MANAGER'];
if(!windowManager)
{
	console.error("no window manager detected");
	process.exit(1);
}

windowManager.createWindow().then((window) => {
	// window created
	window.renderContent = () => {
		return (
			<div className="terminal-content">
				<div className="terminal-output"></div>
				<input type="text" className="terminal-input"/>
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
		title: "terminal.exe"
	});
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
