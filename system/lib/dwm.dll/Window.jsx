
const React = require('react');

class Window extends React.Component
{
	constructor(props)
	{
		super(props);

		this.state = {
			_created: false
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
		state._created = true;
		this.setState(state, callback);
	}

	minimize()
	{
		this.setState({minimized: true});
	}

	maximize()
	{
		this.setState({maximized: true});
	}

	restoreDown()
	{
		this.setState({maximized: false});
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
		if(this.state.maximized)
		{
			this.restoreDown();
		}
		else
		{
			this.maximize();
		}
	}

	onCloseButtonClick(event)
	{
		this.close();
	}

	onCornerMouseDown(event, corner)
	{
		if(this.props.onCornerMouseDown)
		{
			this.props.onCornerMouseDown(event, corner);
		}
	}

	renderTitleBar()
	{
		return (
			<div className="window-title-bar"
					onMouseDown={this.props.onTitleBarMouseDown}
					onDoubleClick={(event) => {this.onMaximizeButtonClick(event)}}>
				<div className="title">{this.state.title}</div>
				<div className="window-buttons">
					<button type="button" className="window-button-minimize" onClick={(event) => {this.onMinimizeButtonClick(event)}}></button>
					<button type="button" className="window-button-maximize" onClick={(event) => {this.onMaximizeButtonClick(event)}}></button>
					<button type="button" className="window-button-close" onClick={(event) => {this.onCloseButtonClick(event)}}></button>
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
			<div className="window-menu-bar">
				{/* TODO render menu bar */}
			</div>
		);
	}

	renderContent()
	{
		return null;
	}

	render()
	{
		if(!this.state._created)
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
			style.left = 0;
			style.top = 0;
			style.right = 0;
			style.bottom = 0;
			delete style.width;
			delete style.height;
		}
		
		return (
			<div className={className} style={style}>
				<div className="window-resize top" onMouseDown={(event)=>{this.onCornerMouseDown(event,'top')}}></div>
				<div className="window-resize topleft" onMouseDown={(event)=>{this.onCornerMouseDown(event,'topleft')}}></div>
				<div className="window-resize topright" onMouseDown={(event)=>{this.onCornerMouseDown(event,'topright')}}></div>
				<div className="window-resize left" onMouseDown={(event)=>{this.onCornerMouseDown(event,'left')}}></div>
				<div className="window-resize right" onMouseDown={(event)=>{this.onCornerMouseDown(event,'right')}}></div>
				<div className="window-resize bottomleft" onMouseDown={(event)=>{this.onCornerMouseDown(event,'bottomleft')}}></div>
				<div className="window-resize bottomright" onMouseDown={(event)=>{this.onCornerMouseDown(event,'bottomright')}}></div>
				<div className="window-resize bottom" onMouseDown={(event)=>{this.onCornerMouseDown(event,'bottom')}}></div>
				{this.renderTitleBar()}
				{this.renderMenuBar()}
				<div className="window-content">
					{this.renderContent()}
				</div>
			</div>
		);
	}
}

module.exports = Window;
