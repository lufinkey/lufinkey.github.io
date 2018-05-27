
requireCSS('./WindowManager.css');
const React = require('react');
const ReactDOM = require('react-dom');
const Window = require('./Window');


const minWindowSize = {x: 100, y: 60};


class WindowManager extends React.Component
{
	constructor(props) {
		super(props);

		this.windows = {};
		this.windowIdCounter = 1;
		this.windowCreateCallbacks = [];
		this.windowDestroyCallbacks = [];

		// set default state	
		this.state = {
			windows: [],
			dragging: null,
			draggingWindow: null,
			dragStartPosition: null,
			draggerStartPosition: null,
			draggerStartSize: null
		};

		// bind methods	
		this.onDocumentMouseMove = this.onDocumentMouseMove.bind(this);
		this.onDocumentMouseUp = this.onDocumentMouseUp.bind(this);
	}

	componentDidMount() {
		// add mouse event listeners
		document.addEventListener('mousemove', this.onDocumentMouseMove);
		document.addEventListener('mouseup', this.onDocumentMouseUp);
	}

	componentWillUnmount() {
		// remove mouse event listeners	
		document.removeEventListener('mousemove', this.onDocumentMouseMove);
		document.removeEventListener('mouseup', this.onDocumentMouseUp);
	}

	createDefaultWindowState() {
		var areaRect = ReactDOM.findDOMNode(this).getBoundingClientRect();
		var height = areaRect.height * 0.8;
		if(height > 480)
		{
			height = 480;
		}

		return {
			title: "",
			position: {
				x: 20,
				y: 20
			},
			size: {
				x: height*1.5,
				y: height
			}
		};
	}

	mergeWindowOptions(options, addOptions) {
		options = Object.assign({}, options);
		const copyProps = ['title', 'minimized', 'maximized'];
		for(const prop of copyProps) {
			if(addOptions[prop] !== undefined) {
				options[prop] = addOptions[prop];
			}
		}
		if(addOptions.size) {
			options.size = Object.assign(Object.assign({}, options.size), addOptions.size);
		}
		if(addOptions.position) {
			options.position = Object.assign(Object.assign({}, options.position), addOptions.position);
		}
		return options;
	}

	createWindow(component, options={}) {

		return new Promise((resolve, reject) => {
			if(!component) {
				reject(new Error("no component given"));
				return;
			}
			// set default window options
			const defaults =
				this.mergeWindowOptions(
					this.mergeWindowOptions(
						this.createDefaultWindowState(),
						Object.assign({}, component.windowOptions)
					),
					Object.assign({}, options)
				);
			
			var windowId = this.windowIdCounter;
			this.windowIdCounter++;

			// add window to state windows
			var windows = this.state.windows.concat([{
				id: windowId,
				component: component,
				defaults: defaults
			}]);
			// add callback
			this.windowCreateCallbacks.push({
				windowId: windowId,
				resolve: resolve,
				reject: reject
			});
			// update state
			this.setState({windows: windows});
		});
	}

	onWindowMount(window) {
		// find mounted window
		for(var i=0; i<this.windowCreateCallbacks.length; i++) {
			let windowCallback = this.windowCreateCallbacks[i];
			if(windowCallback.windowId === window.props.windowId) {
				// remove window callback
				this.windowCreateCallbacks.splice(i, 1);
				// add window to windows
				this.windows[windowCallback.windowId] = window;
				// call events/callbacks
				windowCallback.resolve(window);
				if(this.props.onWindowCreate) {
					this.props.onWindowCreate(window);
				}
				return;
			}
		}
	}

	destroyWindow(window) {
		return new Promise((resolve, reject) => {
			// delete window from windows
			delete this.windows[window.props.windowId];
			// remove window from state windows
			var windows = this.state.windows.slice(0);
			for(var i=0; i<windows.length; i++) {
				if(windows[i].id === window.props.windowId) {
					// remove window
					windows.splice(i, 1);
					this.windowDestroyCallbacks.push({windowId: window.props.windowId, resolve: resolve, reject: reject});
					this.setState({windows: windows});
					return;
				}
			}

			reject(new Error("window does not exist"));
		});
	}

	onWindowUnmount(window) {
		this.stopDragging();
		// find unmounted window
		for(var i=0; i<this.windowDestroyCallbacks.length; i++) {
			var windowCallback = this.windowDestroyCallbacks[i];
			if(windowCallback.windowId === window.props.windowId) {
				// remove window callback
				this.windowDestroyCallbacks.splice(i, 1);
				// call events/callbacks
				windowCallback.resolve();
				if(this.props.onWindowDestroy) {
					this.props.onWindowDestroy(window);
				}
				return;
			}
		}
	}

	onWindowWillUpdate(window) {
		if(this.props.onWindowWillUpdate) {
			this.props.onWindowWillUpdate(window);
		}
	}

	getMouseEventPosition(event) {
		var areaRect = ReactDOM.findDOMNode(this).getBoundingClientRect();
		return {
			x: (event.clientX-areaRect.left),
			y: (event.clientY-areaRect.top)
		};
	}

	getMouseEventDragMovement(event) {
		var mousePos = this.getMouseEventPosition(event);
		return {
			x: (mousePos.x - this.state.dragStartPosition.x),
			y: (mousePos.y - this.state.dragStartPosition.y)
		};
	}

	startDragging(window, event, what) {
		var dragStartPosition = this.getMouseEventPosition(event);
		var draggerStartPosition = Object.assign({}, window.state.position);
		var draggerStartSize = Object.assign({}, window.state.size);

		var elements = document.querySelectorAll("body, iframe");
		for(const element of elements) {
			element.style.pointerEvents = "none";
			element.style.userSelect = "none";
			element.style.msUserSelect = "none";
			element.style.webkitUserSelect = "none";
		}

		this.setState({
			dragging: what,
			draggingWindow: window,
			dragStartPosition: dragStartPosition,
			draggerStartPosition: draggerStartPosition,
			draggerStartSize: draggerStartSize
		});
	}

	stopDragging() {
		var elements = document.querySelectorAll("body, iframe");
		for(const element of elements) {
			element.style.pointerEvents = null;
			element.style.userSelect = null;
			element.style.msUserSelect = null;
			element.style.webkitUserSelect = null;
		}

		this.setState({
			dragging: null,
			draggingWindow: null,
			dragStartPosition: null,
			draggerStartPosition: null,
			draggerStartSize: null
		});
	}

	onWindowTitleBarMouseDown(window, event) {
		if(event.button == 0) {
			if(!this.state.dragging) {
				this.startDragging(window, event, 'titlebar');
			}
		}
	}

	onWindowCornerMouseDown(window, event, corner) {
		if(event.button == 0) {
			if(!this.state.dragging) {
				this.startDragging(window, event, 'corner');
				this.setState({
					dragCorner: corner
				});
			}
		}
	}

	onDocumentMouseMove(event) {
		if(this.state.dragging) {
			let window = this.state.draggingWindow;
			let position = Object.assign({}, window.state.position);
			let size = Object.assign({}, window.state.size);

			let movement = this.getMouseEventDragMovement(event);
			let areaRect = ReactDOM.findDOMNode(this).getBoundingClientRect();
			
			switch(this.state.dragging) {
				case 'titlebar':
					// set new position
					position.x = this.state.draggerStartPosition.x + movement.x;
					position.y = this.state.draggerStartPosition.y + movement.y;

					// ensure we don't go outside the window manager bounds
					if(position.x < 0) {
						position.x = 0;
					}
					else if((position.x+size.x) > areaRect.width) {
						position.x = areaRect.width - size.x;
					}
					if(position.y < 0) {
						position.y = 0;
					}
					else if((position.y+size.y) > areaRect.height) {
						position.y = areaRect.height - size.y;
					}
					break;
				
				case 'corner':
					const resizeX = (mult=1) => {
						size.x = this.state.draggerStartSize.x + (movement.x*mult);
						if(size.x < minWindowSize.x) {
							size.x = minWindowSize.x;
						}
					}
					const resizeY = (mult=1) => {
						size.y = this.state.draggerStartSize.y + (movement.y*mult);
						if(size.y < minWindowSize.y) {
							size.y = minWindowSize.y;
						}
					}
					const reAdjustPositionTop = () => {
						position.y = this.state.draggerStartPosition.y + this.state.draggerStartSize.y - size.y;
					}
					const reAdjustPositionLeft = () => {
						position.x = this.state.draggerStartPosition.x + this.state.draggerStartSize.x - size.x;
					}

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
					break;
			}

			// update window state
			window.setState({position: position, size: size});
		}
	}

	onDocumentMouseUp(event) {
		if(this.state.dragging) {
			switch(this.state.dragging) {
				case 'corner':
					this.setState({
						dragCorner: null
					});
					break;
			}
			this.stopDragging();
		}
	}

	render() {
		return (
			<div className="window-manager">
				{ this.state.windows.map((windowInfo) => (
					this.renderWindow(windowInfo.id, windowInfo.component, windowInfo.defaults)
				)) }
			</div>
		);
	}

	renderWindow(windowId, component, defaults) {
		return (
			<Window
				key={"window-"+windowId}
				windowId={windowId}
				windowManager={this}
				component={component}
				defaults={defaults}
				onMount={(window) => {this.onWindowMount(window)}}
				onWillUpdate={() => {this.onWindowWillUpdate(this.windows[windowId])}}
				onUnmount={(window) => {this.onWindowUnmount(window)}}
				onTitleBarMouseDown={(event) => {this.onWindowTitleBarMouseDown(this.windows[windowId], event)}}
				onCornerMouseDown={(event, corner) => {this.onWindowCornerMouseDown(this.windows[windowId], event, corner)}}/>
		);
	}
}

module.exports = WindowManager;
