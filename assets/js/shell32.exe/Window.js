
const depends = [];

defineModule(depends, () => {
	class Window extends React.Component
	{
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
			var menuItems = this.props.menuItems;
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
			var position = Object.assign({x:0,y:0}, this.props.position);
			var size = Object.assign({x:0,y:0}, this.props.size);
			var styles = {
				left: position.x,
				top: position.y,
				width: size.x,
				height: size.y
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
