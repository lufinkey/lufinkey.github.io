
const React = require('react');

class TaskBarButton extends React.Component
{
	onClick(event)
	{
		var window = this.props.window;
		
		if(window.state.minimized)
		{
			window.setState({minimized: false});
		}
		else
		{
			window.setState({minimized: true});
		}
	}

	render()
	{
		var window = this.props.window;
		var classes = ["taskbar-window"];
		if(window.state.minimized)
		{
			classes.push("minimized");
		}
		
		return (
			<button className={classes.join(' ')} onClick={(event) => {this.onClick(event)}}>
				<span className="icon"></span>
				<span className="title">{window.state.title}</span>
			</button>
		);
	}
}

module.exports = TaskBarButton;
