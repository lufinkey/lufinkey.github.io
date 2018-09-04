
const React = require('react');
const ReactDOM = require('react-dom');
const { DraggableCore } = require('react-draggable');

const minWindowSize = {x: 100, y: 60};

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
		const windowId = props.windowId;
		const defaults = Object.assign({}, props.defaults);

		// set initial state
		this.state = {
			title: defaults.title,
			position: Object.assign({x:0,y:0}, defaults.position),
			size: Object.assign({x:320,y:240}, defaults.size),
			minimized: defaults.minimized,
			maximized: defaults.maximized,
			dragging: null,
			dragOffset: null
		};

		this.onRefWindowComponent = this.onRefWindowComponent.bind(this);
		this.onDragStart = this.onDragStart.bind(this);
		this.onDrag = this.onDrag.bind(this);
		this.onDragStop = this.onDragStop.bind(this);

		Object.defineProperties(this, {
			id: {
				value: windowId,
				writable: false
			}
		});
	}

	minimize() {
		this.setState({
			minimized: true,
			dragging: null,
			dragOffset: null,
			dragStart: null,
			dragCorner: null,
			draggerStartPosition: null,
			draggerStartSize: null
		});
	}

	maximize() {
		this.setState({
			maximized: true,
			dragging: null,
			dragOffset: null,
			dragStart: null,
			dragCorner: null,
			draggerStartPosition: null,
			draggerStartSize: null
		});
	}

	restoreDown() {
		this.setState({
			maximized: false
		});
	}

	close() {
		if(!this.props.windowManager) {
			throw new Error("no window manager!");
		}
		return this.props.windowManager.destroyWindow(this);
	}

	componentDidMount() {
		// get drag parent
		let dragParent = undefined;
		if(this.props.windowManager) {
			dragParent = ReactDOM.findDOMNode(this.props.windowManager);
		}
		if(!dragParent) {
			const element = ReactDOM.findDOMNode(this);
			if(element) {
				dragParent = element.parentElement;
			}
		}
		// set dragParent in state
		this.setState({
			dragParent: dragParent
		}, () => {
			// call onMount event
			if(this.props.onMount) {
				this.props.onMount(this);
			}
		});
	}

	componentWillUnmount() {
		if(this.props.onUnmount) {
			this.props.onUnmount(this);
		}
	}

	componentDidUpdate() {
		if(this.props.onUpdate) {
			this.props.onUpdate();
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

	onDragStart(event, data) {
		// prevent double dragging
		if(this.state.dragging) {
			event.preventDefault();
			return false;
		}
		// start dragging
		const windowElement = ReactDOM.findDOMNode(this);
		const windowRect = windowElement.getBoundingClientRect();
		const parentRect = windowElement.parentElement.getBoundingClientRect();
		const left = windowRect.left - parentRect.left;
		const top = windowRect.top - parentRect.top;
		const offsetX = left - data.x;
		const offsetY = top - data.y;
		this.setState({
			dragging: 'window',
			dragOffset: {x: offsetX, y: offsetY}
		});
	}

	onDrag(event, data) {
		// ensure dragging window
		if(this.state.dragging !== 'window') {
			event.preventDefault();
			return false;
		}
		// don't adjust window position if not within bounds
		const areaRect = ReactDOM.findDOMNode(this).parentElement.getBoundingClientRect();
		if(data.x < 0 || data.y < 0 || data.x > areaRect.width || data.y > areaRect.height) {
			return;
		}
		// don't adjust window position if maximized
		if(this.state.maximized) {
			return;
		}
		// adjust drag
		const dragOffset = this.state.dragOffset;
		this.setState({
			position: {x: data.x + dragOffset.x, y: data.y + dragOffset.y}
		});
	}

	onDragStop(event, data) {
		// ensure dragging window
		if(this.state.dragging !== 'window') {
			event.preventDefault();
			return false;
		}
		// stop dragging
		this.setState({
			dragging: null,
			dragOffset: null
		});
	}

	onCornerDragStart(event, data, corner) {
		// prevent double dragging
		if(this.state.dragging) {
			event.preventDefault();
			return false;
		}
		// start dragging
		this.setState({
			dragging: 'corner',
			dragStart: {x: data.x, y: data.y},
			dragCorner: corner,
			draggerStartPosition: Object.assign({}, this.state.position),
			draggerStartSize: Object.assign({}, this.state.size)
		});
	}

	onCornerDrag(event, data, corner) {
		// ensure dragging corner
		if(this.state.dragging !== 'corner' || this.state.dragCorner !== corner) {
			event.preventDefault();
			return false;
		}

		// don't adjust window size if not within bounds
		const areaRect = ReactDOM.findDOMNode(this).parentElement.getBoundingClientRect();
		if(data.x < 0 || data.y < 0 || data.x > areaRect.width || data.y > areaRect.height) {
			return;
		}
		// don't adjust window size if maximized
		if(this.state.maximized) {
			return;
		}

		// get window properties
		let position = Object.assign({}, this.state.position);
		let size = Object.assign({}, this.state.size);

		// get resize offset
		const dragStart = this.state.dragStart;
		const dragOffset = {x: (data.x - dragStart.x), y: (data.y - dragStart.y)}

		// create window resize functions
		const resizeX = (mult=1) => {
			size.x = this.state.draggerStartSize.x + (dragOffset.x*mult);
			if(size.x < minWindowSize.x) {
				size.x = minWindowSize.x;
			}
		}
		const resizeY = (mult=1) => {
			size.y = this.state.draggerStartSize.y + (dragOffset.y*mult);
			if(size.y < minWindowSize.y) {
				size.y = minWindowSize.y;
			}
		}
		const reAdjustPositionLeft = () => {
			position.x = this.state.draggerStartPosition.x + this.state.draggerStartSize.x - size.x;
		}
		const reAdjustPositionTop = () => {
			position.y = this.state.draggerStartPosition.y + this.state.draggerStartSize.y - size.y;
		}

		// resize based on corner
		switch(this.state.dragCorner)
		{
			case 'top':
				resizeY(-1);
				reAdjustPositionTop();
				break;

			case 'topleft':
				resizeX(-1);
				resizeY(-1);
				reAdjustPositionLeft();
				reAdjustPositionTop();
				break;
			
			case 'topright':
				resizeX(1);
				resizeY(-1);
				reAdjustPositionTop();
				break;
			
			case 'left':
				resizeX(-1);
				reAdjustPositionLeft();
				break;

			case 'right':
				resizeX(1);
				break;

			case 'bottomleft':
				resizeX(-1);
				resizeY(1);
				reAdjustPositionLeft();
				break;

			case 'bottomright':
				resizeX(1);
				resizeY(1);
				break;

			case 'bottom':
				resizeY(1);
				break;
		}

		// update state
		this.setState({
			position: position,
			size: size
		});
	}

	onCornerDragStop(event, data, corner) {
		// ensure dragging corner
		if(this.state.dragging !== 'corner' || this.state.dragCorner !== corner) {
			event.preventDefault();
			return false;
		}
		// stop dragging
		this.setState({
			dragging: null,
			dragStart: null,
			dragCorner: null,
			draggerStartPosition: null,
			draggerStartSize: null
		});
	}

	renderTitleBar() {
		return (
			<div className="window-title-bar"
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
		
		// add style props
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
			<DraggableCore
				handle={'.window-title-bar'}
				onStart={this.onDragStart}
				onDrag={this.onDrag}
				onStop={this.onDragStop}>
				<div className={className} style={style}>
					<DraggableCore
						handle={'.window-resize.top'}
						offsetParent={this.state.dragParent}
						onStart={(event, data)=>{this.onCornerDragStart(event, data, 'top')}}
						onDrag={(event, data)=>{this.onCornerDrag(event, data, 'top')}}
						onStop={(event, data)=>{this.onCornerDragStop(event, data, 'top')}}>
						<div className="window-resize top"></div>
					</DraggableCore>
					<DraggableCore
						handle={'.window-resize.topleft'}
						offsetParent={this.state.dragParent}
						onStart={(event, data)=>{this.onCornerDragStart(event, data, 'topleft')}}
						onDrag={(event, data)=>{this.onCornerDrag(event, data, 'topleft')}}
						onStop={(event, data)=>{this.onCornerDragStop(event, data, 'topleft')}}>
						<div className="window-resize topleft"></div>
					</DraggableCore>
					<DraggableCore
						handle={'.window-resize.topright'}
						offsetParent={this.state.dragParent}
						onStart={(event, data)=>{this.onCornerDragStart(event, data, 'topright')}}
						onDrag={(event, data)=>{this.onCornerDrag(event, data, 'topright')}}
						onStop={(event, data)=>{this.onCornerDragStop(event, data, 'topright')}}>
						<div className="window-resize topright"></div>
					</DraggableCore>
					<DraggableCore
						handle={'.window-resize.left'}
						offsetParent={this.state.dragParent}
						onStart={(event, data)=>{this.onCornerDragStart(event, data, 'left')}}
						onDrag={(event, data)=>{this.onCornerDrag(event, data, 'left')}}
						onStop={(event, data)=>{this.onCornerDragStop(event, data, 'left')}}>
						<div className="window-resize left"></div>
					</DraggableCore>
					<DraggableCore
						handle={'.window-resize.right'}
						offsetParent={this.state.dragParent}
						onStart={(event, data)=>{this.onCornerDragStart(event, data, 'right')}}
						onDrag={(event, data)=>{this.onCornerDrag(event, data, 'right')}}
						onStop={(event, data)=>{this.onCornerDragStop(event, data, 'right')}}>
						<div className="window-resize right"></div>
					</DraggableCore>
					<DraggableCore
						handle={'.window-resize.bottomleft'}
						offsetParent={this.state.dragParent}
						onStart={(event, data)=>{this.onCornerDragStart(event, data, 'bottomleft')}}
						onDrag={(event, data)=>{this.onCornerDrag(event, data, 'bottomleft')}}
						onStop={(event, data)=>{this.onCornerDragStop(event, data, 'bottomleft')}}>
						<div className="window-resize bottomleft"></div>
					</DraggableCore>
					<DraggableCore
						handle={'.window-resize.bottomright'}
						offsetParent={this.state.dragParent}
						onStart={(event, data)=>{this.onCornerDragStart(event, data, 'bottomright')}}
						onDrag={(event, data)=>{this.onCornerDrag(event, data, 'bottomright')}}
						onStop={(event, data)=>{this.onCornerDragStop(event, data, 'bottomright')}}>
						<div className="window-resize bottomright"></div>
					</DraggableCore>
					<DraggableCore
						handle={'.window-resize.bottom'}
						offsetParent={this.state.dragParent}
						onStart={(event, data)=>{this.onCornerDragStart(event, data, 'bottom')}}
						onDrag={(event, data)=>{this.onCornerDrag(event, data, 'bottom')}}
						onStop={(event, data)=>{this.onCornerDragStop(event, data, 'bottom')}}>
						<div className="window-resize bottom"></div>
					</DraggableCore>
					{this.renderTitleBar()}
					{this.renderMenuBar()}
					<div className="window-content">
						{this.renderContent()}
					</div>
				</div>
			</DraggableCore>
		);
	}
}

module.exports = Window;
