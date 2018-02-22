
const depends = [];

defineModule(depends, () => {
	class TaskBar extends React.Component
	{
		render()
		{
			return (
				<div className="taskbar">
					<button type="button" className="start-button">
						<span className="icon"><span className="ghost"></span></span> Start
					</button>
				</div>
			);
		}
	}

	return TaskBar;
});
