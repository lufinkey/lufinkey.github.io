
const React = require('react');
const ReactDOM = require('react-dom');
const { spawn } = require('child_process');

class Terminal extends React.Component
{
	static windowOptions = {
		title: "terminal.exe"
	}

	constructor(props) {
		super(props);

		this.state = {
			shellOutput: [],
			shellInput: ""
		};
	}

	componentDidMount() {
		this.startShell();
		this.getShellInputElement().focus();
	}

	startShell() {
		// start shell
		this.shellProcess = spawn('jsh');
		this.shellProcess.on('error', (error) => {
			console.error(error);
			this.props.window.close();
			process.exit(1);
		});
		this.shellProcess.on('exit', (exitCode) => {
			this.props.window.close();
			process.exit(exitCode);
		});

		// listen for data
		this.shellProcess.stdout.on('data', (chunk) => {
			this.appendShellOutput(''+chunk);
		});
		this.shellProcess.stderr.on('data', (chunk) => {
			this.appendShellOutput(''+chunk, 'red');
		});
	}

	appendShellOutput(output, color='white') {
		// determine auto scroll behavior
		var shouldAutoScroll = false;
		var termContent = this.getTerminalContent();
		if(termContent) {
			var scrollBottom = termContent.scrollHeight - termContent.getBoundingClientRect().height;
			var scrollDiff = Math.abs(scrollBottom - termContent.scrollTop);

			if(scrollDiff < 18) {
				shouldAutoScroll = true;
			}
		}

		// update shell output
		const shellOutput = this.state.shellOutput.slice(0);
		var outputLines = output.split('\n');
		for(var i=0; i<outputLines.length; i++) {
			var line = outputLines[i];
			shellOutput.push({
				content: line,
				color: color
			});
			if(i<(outputLines.length-1)) {
				shellOutput.push({
					break: true
				});
			}
		}

		// update window state
		this.setState({
			shellOutput: shellOutput
		}, () => {
			if(shouldAutoScroll) {
				setTimeout(() => {
					this.scrollToBottom();
				}, 0);
			}
		});
	}

	getShellInputElement() {
		var windowNode = ReactDOM.findDOMNode(this);
		if(windowNode) {
			return windowNode.querySelector('.terminal-content textarea.shell-input');
		}
		return null;
	}

	getTerminalContent() {
		var windowNode = ReactDOM.findDOMNode(this);
		if(windowNode) {
			return windowNode.querySelector('.terminal-content');
		}
		return null;
	}

	onShellInputUpdate(event) {
		var textArea = event.currentTarget;
		var eventKey = event.key;
		setTimeout(() => {
			let shellInput = this.state.shellInput;
			if(eventKey == 'Backspace') {
				if(shellInput.length > 0) {
					shellInput = shellInput.substring(0, shellInput.length-1);
				}
			}
			shellInput += textArea.value;
			textArea.value = "";

			if(eventKey == 'Enter') {
				var command = shellInput;
				shellInput = "";
				// TODO write newline when writing chunk
				this.shellProcess.stdin.write(command);
			}

			// update window state
			this.setState({
				shellInput: shellInput
			}, () => {
				this.scrollToBottom();
			});
		}, 0);
	}

	onWindowAreaClick(event) {
		// focus the input area
		var textArea = this.getShellInputElement();
		if(textArea) {
			textArea.focus();
		}
	}

	scrollToBottom() {
		var textArea = this.getShellInputElement();
		if(textArea) {
			textArea.scrollIntoView({behavior: 'smooth'});
		}
	}

	onCloseButtonClick() {
		this.props.window.close();
		process.exit(0);
	}

	render() {
		return (
			<div className="terminal-content" onClick={this.onWindowAreaClick.bind(this)}>
				{ this.state.shellOutput.map((line, index) => (
					line.break ? (
						<br key={"shelloutput"+index}/>
					) : (
						<span key={"shelloutput"+index} className="shell-output" style={{color: line.color}}>
							<pre>{line.content}</pre>
						</span>
					)
				)) }
				<span className="shell-input">{this.state.shellInput}</span>
				<textarea
					className="shell-input"
					onKeyDown={this.onShellInputUpdate.bind(this)}
					onChange={this.onShellInputUpdate.bind(this)}
					autoComplete="off"
					autoCorrect="off"
					autoCapitalize="none"
					spellCheck={false}></textarea>
			</div>
		);
	}
}

module.exports = Terminal;
