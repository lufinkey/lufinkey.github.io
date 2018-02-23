
const depends = [];

defineModule(depends, () => {
	class Window extends React.Component
	{
		constructor(props)
		{
			super(props);

			this.state = {
				created: false
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

		create(initialState, callback)
		{
			var state = Object.assign({}, initialState);
			state.created = true;
			this.setState(state, callback);
		}

		renderTitleBar()
		{
			return (
				<div className="window-title-bar" onMouseDown={this.props.onTitleBarMouseDown}>
					<div className="title">{this.state.title}</div>
					<div className="window-buttons">
						<button type="button" className="window-button-minimize" onClick={this.props.onMinimizeButtonClick}></button>
						<button type="button" className="window-button-maximize" onClick={this.props.onMaximizeButtonClick}></button>
						<button type="button" className="window-button-close" onClick={this.props.onCloseButtonClick}></button>
					</div>
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
			if(!this.state.created)
			{
				return null;
			}

			var position = Object.assign({x:0,y:0}, this.state.position);
			var size = Object.assign({x:640,y:480}, this.state.size);
			var style = {
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

	return Window;
});
