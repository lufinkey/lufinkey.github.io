
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

		create(initialState, callback)
		{
			var state = Object.assign({}, initialState);
			state.created = true;
			this.setState(state, callback);
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

		renderTitleBar()
		{
			return (
				<div className="window-title-bar" onMouseDown={this.props.onTitleBarMouseDown}>
					<span className="window-title">{this.state.title}</span>
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
			if(!this.state.created)
			{
				return null;
			}

			var position = Object.assign({x:0,y:0}, this.props.position);
			var size = Object.assign({x:640,y:480}, this.props.size);
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
