
requireCSS('./style.css');
const React = require('react');
const { spawn } = require('child_process');
const Terminal = require('./terminal');

var windowManager = process.env['WINDOW_MANAGER'];
if(!windowManager)
{
	console.error("no window manager detected");
	process.exit(1);
}

windowManager.createWindow().then((window) => {
	// create terminal
	var terminal = new Terminal();

	// scroll to the bottom of the terminal
	function scrollToBottom()
	{
		if(terminal.html.parentNode)
		{
			terminal.html.parentNode.scrollTop = terminal.html.parentNode.scrollHeight;
		}
	}

	// handle terminal input loop
	function terminalInputLoop()
	{
		scrollToBottom();
		terminal.input("~$", (entered) => {
			scrollToBottom();
			var cmdParts = entered.split(' ');
			
			try
			{
				// start subprocess
				var subprocess = spawn(cmdParts[0], cmdParts.slice(1));

				// handle error
				subprocess.on('error', (error) => {
					terminal.print(error.toString());
					terminalInputLoop();
				});

				// handle exit
				subprocess.on('exit', (exitCode) => {
					terminalInputLoop();
				});
			}
			catch(error)
			{
				terminal.print(error.toString());
				terminalInputLoop();
			}
		});
	}

	// handle DOM element reference
	let reffed = false;
	function onRef(element)
	{
		if(reffed)
		{
			return;
		}
		reffed = true;
		element.appendChild(terminal.html);
		terminalInputLoop();
	}

	// window created
	window.renderContent = () => {
		return (
			<div ref={(element) => {onRef(element)}} className="terminal-content">
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
