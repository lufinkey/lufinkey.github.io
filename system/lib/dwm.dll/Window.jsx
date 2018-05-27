
const React = require('react');

class Window extends React.Component
{
	constructor(props) {
		// check for required props
		if(props.windowId == null) {
			throw new Error("Window is missing required prop windowId")
		}
		if(!props.component) {
			throw new Error("Window is missing required prop component");
		}
		if(!props.windowManager) {
			throw new Error("Window is missing required prop windowManager");
		}

		// call super constructor
		super(props);

		// get default options
		const defaults = Object.assign({}, props.defaults);

		// set initial state
		this.state = {
			title: defaults.title,
			position: Object.assign({x:0,y:0}, defaults.position),
			size: Object.assign({x:320,y:240}, defaults.size),
			minimized: defaults.minimized,
			maximized: defaults.maximized
		};

		this.onRefWindowComponent = this.onRefWindowComponent.bind(this);
	}

	minimize() {
		this.setState({minimized: true});
	}

	maximize() {
		this.setState({maximized: true});
	}

	restoreDown() {
		this.setState({maximized: false});
	}

	close() {
		if(!this.props.windowManager) {
			throw new Error("no window manager!");
		}
		return this.props.windowManager.destroyWindow(this);
	}

	componentDidMount() {
		if(this.props.onMount) {
			this.props.onMount(this);
		}
	}

	componentWillUnmount() {
		if(this.props.onUnmount) {
			this.props.onUnmount(this);
		}
	}

	onRefWindowComponent(component) {
		this.windowComponent = component;
	}

	onMinimizeButtonClick(event) {
		let callDefault = true;
		if(this.windowComponent.onMinimizeButtonClick) {
			callDefault = this.windowComponent.onMinimizeButtonClick(event);
		}
		if(callDefault) {
			this.minimize();
		}
	}

	onMaximizeButtonClick(event) {
		let callDefault = true;
		if(this.windowComponent.onMaximizeButtonClick) {
			callDefault = this.windowComponent.onMaximizeButtonClick(event);
		}
		if(callDefault) {
			if(this.state.maximized) {
				this.restoreDown();
			}
			else {
				this.maximize();
			}
		}
	}

	onCloseButtonClick(event) {
		let callDefault = true;
		if(this.windowComponent.onCloseButtonClick) {
			callDefault = this.windowComponent.onCloseButtonClick(event);
		}
		if(callDefault) {
			this.close();
		}
	}

	onCornerMouseDown(event, corner) {
		if(this.props.onCornerMouseDown) {
			this.props.onCornerMouseDown(event, corner);
		}
	}

	renderTitleBar() {
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

	renderMenuBar() {
		var menuItems = this.props.menuItems;
		if(menuItems == null) {
			return null;
		}

		return (
			<div className="window-menu-bar">
				{/* TODO render menu bar */}
			</div>
		);
	}

	renderContent() {
		const WindowComponent = this.props.component;
		return (
			<WindowComponent window={this} ref={this.onRefWindowComponent}/>
		);
	}

	render() {
		var position = Object.assign({x:0,y:0}, this.state.position);
		var size = Object.assign({x:320,y:240}, this.state.size);
		
		var style = {
			left: position.x,
			top: position.y,
			width: size.x,
			height: size.y
		};
		var className = "window";
		if(this.state.minimized) {
			className += " minimized";
		}
		else if(this.state.maximized) {
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
