
const depends = [];

defineModule(depends, () => {
	class Window extends React.Component
	{
		getMenuItems()
		{
			return null;
		}

		renderTitleBar()
		{
			return (
				<div className="window-title-bar">
					<span className="window-title">{this.state.windowTitle}</span>
					<button type="button" className="window-button-minimize"></button>
					<button type="button" className="window-button-maximize"></button>
					<button type="button" className="window-button-close"></button>
				</div>
			);
		}

		renderMenuBar()
		{
			var menuItems = this.getMenuItems();
			if(menuItems == null)
			{
				return null;
			}

			return (
				<div class="app-menu-bar">
					{ /* TODO render menu bar */ }
				</div>
			);
		}

		renderContent()
		{
			return null;
		}

		render()
		{
			var style = {
				left: this.state.windowX,
				top: this.state.windowY,
				width: this.state.windowWidth,
				height: this.state.windowHeight
			};
			
			return (
				<div className="window" style={style}>
					{this.renderTitleBar()}
					{this.renderMenuBar()}
					{this.renderContent()}
				</div>
			);
		}
	}
});
