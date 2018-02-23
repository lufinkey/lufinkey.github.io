
const depends = [];

defineModule(depends, () => {
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
			
			return (
				<div className="taskbar-window" onClick={(event) => {this.onClick(event)}}>
					<span className="icon"></span>
					<span className="title">{window.state.title}</span>
				</div>
			);
		}
	}

	return TaskBarButton;
});