
const React = require('react');

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

	componentWillUpdate()
	{
		if(this.props.onWillUpdate)
		{
			this.props.onWillUpdate();
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

	minimize()
	{
		this.setState({minimized: true});
	}

	close()
	{
		if(this.props.windowManager)
		{
			this.props.windowManager.destroyWindow(this);
		}
	}

	onMinimizeButtonClick(event)
	{
		this.minimize();
	}

	onMaximizeButtonClick(event)
	{
		//
	}

	onCloseButtonClick(event)
	{
		this.close();
	}

	renderTitleBar()
	{
		return [
			(<div className="title">{this.state.title}</div>),
			(<div className="window-buttons">
				<button type="button" className="window-button-minimize" onClick={(event) => {this.onMinimizeButtonClick(event)}}></button>
				<button type="button" className="window-button-maximize" onClick={(event) => {this.onMaximizeButtonClick(event)}}></button>
				<button type="button" className="window-button-close" onClick={(event) => {this.onCloseButtonClick(event)}}></button>
			</div>)
		];
	}

	renderMenuBar()
	{
		var menuItems = this.props.menuItems;
		if(menuItems == null)
		{
			return null;
		}

		// TODO render menu bar
		return null;
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
		var size = Object.assign({x:320,y:240}, this.state.size);
		var style = {
			left: position.x,
			top: position.y,
			width: size.x,
			height: size.y
		};
		var className = "window";
		if(this.state.minimized)
		{
			className += " minimized";
		}
		else if(this.state.maximized)
		{
			className += " maximized";
		}
		
		return (
			<div className={className} style={style}>
				<div className="window-title-bar" onMouseDown={this.props.onTitleBarMouseDown}>
					{this.renderTitleBar()}
				</div>
				<div className="window-menu-bar">
					{this.renderMenuBar()}
				</div>
				<div className="window-content">
					{this.renderContent()}
				</div>
			</div>
		);
	}
}

module.exports = Window;
