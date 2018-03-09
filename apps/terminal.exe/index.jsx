
requireCSS('./style.css');
const React = require('react');
const ReactDOM = require('react-dom');
const { spawn } = require('child_process');

var windowManager = process.env['WINDOW_MANAGER'];
if(!windowManager)
{
	console.error("no window manager detected");
	process.exit(1);
}

windowManager.createWindow().then((window) => {
	// window created

	// spawn shell
	var shellProcess = spawn('jsh');
	shellProcess.on('error', (error) => {
		console.error(error);
		window.close();
		process.exit(1);
	});
	shellProcess.on('exit', (exitCode) => {
		window.close();
		process.exit(exitCode);
	});



	// listen for shell output
	let shellOutput = [];

	function appendShellOutput(output, color='white')
	{
		var shouldAutoScroll = false;
		var termContent = getTerminalContent();
		if(termContent)
		{
			var scrollBottom = termContent.scrollHeight - termContent.getBoundingClientRect().height;
			var scrollDiff = Math.abs(scrollBottom - termContent.scrollTop);

			if(scrollDiff < 18)
			{
				shouldAutoScroll = true;
			}
		}

		var outputLines = output.split('\n');
		for(var i=0; i<outputLines.length; i++)
		{
			var line = outputLines[i];
			shellOutput.push({
				content: line,
				color: color
			});
			if(i<(outputLines.length-1))
			{
				shellOutput.push({
					break: true
				});
			}
		}

		// update window state
		window.forceUpdate(() => {
			setTimeout(() => {
				if(shouldAutoScroll)
				{
					scrollToBottom();
				}
			}, 0);
		});
	}

	shellProcess.stdout.on('data', (chunk) => {
		appendShellOutput(''+chunk);
	});

	shellProcess.stderr.on('data', (chunk) => {
		appendShellOutput(''+chunk, 'red');
	});



	// listen for shell input
	let shellInput = "";

	function getTextArea()
	{
		var windowNode = ReactDOM.findDOMNode(window);
		if(windowNode)
		{
			return windowNode.querySelector('.terminal-content textarea.shell-input');
		}
		return null;
	}

	function getTerminalContent()
	{
		var windowNode = ReactDOM.findDOMNode(window);
		if(windowNode)
		{
			return windowNode.querySelector('.terminal-content');
		}
		return null;
	}

	function onTextAreaUpdate(event)
	{
		var textArea = event.currentTarget;
		var eventKey = event.key;
		setTimeout(() => {
			if(eventKey == 'Backspace')
			{
				if(shellInput.length > 0)
				{
					shellInput = shellInput.substring(0, shellInput.length-1);
				}
			}
			shellInput += textArea.value;
			textArea.value = "";

			if(eventKey == 'Enter')
			{
				var command = shellInput;
				shellInput = "";
				shellProcess.stdin.write(command);
			}

			// update window state
			window.forceUpdate(() => {
				scrollToBottom();
			});
		}, 0);
	}

	



	// handle a click on the window
	function onWindowClick(event)
	{
		// focus the input area
		var textArea = getTextArea();
		if(textArea)
		{
			textArea.focus();
		}
	}

	// scroll to the bottom of the terminal
	function scrollToBottom()
	{
		var textArea = getTextArea();
		if(textArea)
		{
			textArea.scrollIntoView({behavior: 'smooth'});
		}
	}



	// window created
	window.renderContent = () => {
		return (
			<div className="terminal-content" onClick={onWindowClick}>
				{ shellOutput.map((line, index) => (
					line.break
					? (<br key={"shelloutput"+index}/>)
					: (<span key={"shelloutput"+index} className="shell-output" style={{color: line.color}}>{line.content}</span>)
				)) }
				<span className="shell-input">{shellInput}</span>
				<textarea
					className="shell-input"
					onKeyDown={onTextAreaUpdate}
					onChange={onTextAreaUpdate}
					autoComplete={false}
					autoCorrect={false}
					autoCapitalize={false}
					spellCheck={false}></textarea>
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

	getTextArea().focus();
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
