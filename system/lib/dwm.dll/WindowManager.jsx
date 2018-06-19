
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
	}

	componentDidMount() {
		//
	}

	componentWillUnmount() {
		//
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

	onWindowUpdate(window) {
		if(this.props.onWindowUpdate) {
			this.props.onWindowUpdate(window);
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
				onUpdate={() => {this.onWindowUpdate(this.windows[windowId])}}
				onUnmount={(window) => {this.onWindowUnmount(window)}}
				onTitleBarMouseDown={(event) => {this.onWindowTitleBarMouseDown(this.windows[windowId], event)}}
				onCornerMouseDown={(event, corner) => {this.onWindowCornerMouseDown(this.windows[windowId], event, corner)}}/>
		);
	}
}

module.exports = WindowManager;
