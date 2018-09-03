
requireCSS('./TaskBar.css');

const React = require('react');
const StartMenu = require('./StartMenu');
const TaskBarWindowButton = require('./TaskBarWindowButton');

class TaskBar extends React.Component
{
	constructor(props) {
		super(props);

		this.state = {
			startMenuOpen: false
		};
	}

	onStartButtonMouseDown(event) {
		this.setState({
			startMenuOpen: !this.state.startMenuOpen
		});
	}

	onStartButtonTaskSelected() {
		this.setState({
			startMenuOpen: false
		});
	}

	render() {
		var startButtonClassNames = ["start-button"];
		if(this.state.startMenuOpen)
		{
			startButtonClassNames.push('opened');
		}

		return (
			<div className="taskbar">
				<StartMenu opened={this.state.startMenuOpen} onTaskSelected={this.onStartButtonTaskSelected.bind(this)}/>
				<button type="button" className={startButtonClassNames.join(' ')} onMouseDown={this.onStartButtonMouseDown.bind(this)}>Start</button>
				<div className="taskbar-windows">
					{Object.keys(this.props.windows).map((windowId) => (
						<TaskBarWindowButton
							key={"window"+windowId}
							window={this.props.windows[windowId]}/>
					))}
				</div>
			</div>
		);
	}
}

module.exports = TaskBar;
