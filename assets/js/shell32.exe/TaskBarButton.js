
const depends = [];

defineModule(depends, () => {
	class TaskBarButton extends React.Component
	{
		render()
		{
			var window = this.props.window;
			
			return (
				<div className="taskbar-window">
					<span className="icon"></span>
					<span className="title">{window.state.title}</span>
				</div>
			);
		}
	}

	return TaskBarButton;
});