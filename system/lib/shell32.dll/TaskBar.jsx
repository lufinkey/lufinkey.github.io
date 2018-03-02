
requireCSS('./TaskBar.css');
const React = require('react');
const TaskBarWindowButton = require('./TaskBarWindowButton');

class TaskBar extends React.Component
{
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

	render()
	{
		return (
			<div className="taskbar">
				<button type="button" className="start-button">Start</button>
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
