
requireCSS('./TaskBar.css');
const React = require('react');
const StartMenu = require('./StartMenu');
const TaskBarWindowButton = require('./TaskBarWindowButton');

class TaskBar extends React.Component
{
	constructor(props)
	{
		super(props);

		this.state = {
			startMenuOpen: false,
		};
	}

	componentDidMount()
	{
		if(this.props.onMount)
		{
			this.props.onMount(this);
		}
	}

	componentWillUnmount()
	{
		if(this.props.onUnmount)
		{
			this.props.onUnmount(this);
		}
	}

	onStartButtonMouseDown(event)
	{
		this.setState({
			startMenuOpen: !this.state.startMenuOpen
		});
	}

	render()
	{
		var startButtonClassNames = ["start-button"];
		if(this.state.startMenuOpen)
		{
			startButtonClassNames.push('opened');
		}

		return (
			<div className="taskbar">
				<StartMenu opened={this.state.startMenuOpen}/>
				<button type="button" className={startButtonClassNames.join(' ')} onMouseDown={(event)=>{this.onStartButtonMouseDown(event)}}>Start</button>
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
