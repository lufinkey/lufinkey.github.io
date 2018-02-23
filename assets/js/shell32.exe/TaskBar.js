
const depends = [
	'shell32.exe/TaskBarButton'
];

defineModule(depends, (TaskBarButton) => {
	class TaskBar extends React.Component
	{
		render()
		{
			return (
				<div className="taskbar">
					<button type="button" className="start-button">
						<span className="icon"><span className="ghost"></span></span> Start
					</button>
					<div className="taskbar-windows">
						{Object.keys(this.props.windows).map((windowId) => (
							<TaskBarButton key={"window"+windowId} window={this.props.windows[windowId]}/>
						))}
					</div>
				</div>
			);
		}
	}

	return TaskBar;
});
