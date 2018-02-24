
const depends = [
	'system/shell32.exe/TaskBarWindowButton'
];

defineModule(depends, (TaskBarWindowButton) => {
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
							<TaskBarWindowButton
								key={"window"+windowId}
								window={this.props.windows[windowId]}/>
						))}
					</div>
				</div>
			);
		}
	}

	return TaskBar;
});
