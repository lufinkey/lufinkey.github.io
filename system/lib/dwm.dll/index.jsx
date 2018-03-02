
requireCSS('./style.css');
const React = require('react');
const Window = require('./Window');

class WindowManager extends React.Component
{
	constructor(props)
	{
		super(props);

		this.windows = {};
		this.windowIdCounter = 1;
		this.windowCreateCallbacks = [];
		this.windowDestroyCallbacks = [];

		// set default state	
		this.state = {
			windowIds: [],
			dragging: null,
			draggingWindow: null
		};

		// bind methods	
		this.onDocumentMouseMove = this.onDocumentMouseMove.bind(this);
		this.onDocumentMouseUp = this.onDocumentMouseUp.bind(this);
	}

	componentDidMount()
	{
		// add mouse event listeners
		document.addEventListener('mousemove', this.onDocumentMouseMove);
		document.addEventListener('mouseup', this.onDocumentMouseUp);
		
		if(this.props.onMount)
		{
			this.props.onMount(this);
		}
	}

	componentWillUnmount()
	{
		// remove mouse event listeners	
		document.removeEventListener('mousemove', this.onDocumentMouseMove);
		document.removeEventListener('mouseup', this.onDocumentMouseUp);
		
		if(this.props.onUnmount)
		{
			this.props.onUnmount(this);
		}
	}

	createDefaultWindowState()
	{
		return {
			title: "",
			position: {
				x: 20,
				y: 20
			},
			size: {
				x: 320,
				y: 240
			}
		};
	}

	createWindow(windowState)
	{
		// set window defaults
		windowState = Object.assign({}, windowState);
		const defaultState = this.createDefaultWindowState();
		for(const stateKey in defaultState)
		{
			if(windowState[stateKey] === undefined)
			{
				windowState[stateKey] = defaultState[stateKey];
			}
		}

		return new Promise((resolve, reject) => {
			var windowId = this.windowIdCounter;
			this.windowIdCounter++;

			var windowIds = this.state.windowIds.slice(0);
			windowIds.push(windowId);

			this.windowCreateCallbacks.push({windowId: windowId, state: windowState, resolve: resolve, reject: reject});
			this.setState({windowIds: windowIds});
		});
	}

	onWindowMount(window)
	{
		for(var i=0; i<this.windowCreateCallbacks.length; i++)
		{
			let windowCallback = this.windowCreateCallbacks[i];
			if(windowCallback.windowId === window.props.windowId)
			{
				this.windowCreateCallbacks.splice(i, 1);
				this.windows[windowCallback.windowId] = window;
				window.create(windowCallback.state, () => {
					windowCallback.resolve(window);

					if(this.props.onWindowCreate)
					{
						this.props.onWindowCreate(window);
					}
				});
				return;
			}
		}
	}

	destroyWindow(window)
	{
		return new Promise((resolve, reject) => {
			delete this.windows[window.props.windowId];

			var windowIds = this.state.windowIds.slice(0);
			for(var i=0; i<windowIds.length; i++)
			{
				if(windowIds[i] === window.props.windowId)
				{
					windowIds.splice(i, 1);
					this.setState({windowIds: windowIds});
					this.windowDestroyCallbacks.push({windowId: window.props.windowId, resolve: resolve, reject: reject});
					return;
				}
			}

			reject(new Error("window does not exist"));
		});
	}

	onWindowUnmount(window)
	{
		for(var i=0; i<this.windowDestroyCallbacks.length; i++)
		{
			var windowCallback = this.windowDestroyCallbacks[i];
			if(windowCallback.windowId === window.props.windowId)
			{
				this.windowDestroyCallbacks.splice(i, 1);
				windowCallback.resolve();

				if(this.props.onWindowDestroy)
				{
					this.props.onWindowDestroy(window);
				}
				return;
			}
		}
	}

	onWindowWillUpdate(window)
	{
		if(this.props.onWindowWillUpdate)
		{
			this.props.onWindowWillUpdate(window);
		}
	}

	minimizeWindow(window)
	{
		window.setState({minimized: true});
	}

	restoreWindow(window)
	{
		window.setState({minimized: false});
	}

	onWindowTitleBarMouseDown(window, event)
	{
		if(event.button == 0)
		{
			if(!this.state.dragging)
			{
				this.setState({dragging: 'titlebar', draggingWindow: window});
			}
		}
	}

	onDocumentMouseMove(event)
	{
		switch(this.state.dragging)
		{
			case 'titlebar':
				var window = this.state.draggingWindow;
				var position = Object.assign({}, window.state.position);

				position.x += event.movementX;
				position.y += event.movementY;

				window.setState({position: position});
				break;
		}
	}

	onDocumentMouseUp(event)
	{
		if(event.button == 0)
		{
			switch(this.state.dragging)
			{
				case 'titlebar':
					this.setState({dragging: null, draggingWindow: null});
					break;
			}
		}
	}

	render()
	{
		return (
			<div className="window-manager">
				{ this.state.windowIds.map((windowId) => this.renderWindow(windowId)) }
			</div>
		);
	}

	renderWindow(windowId)
	{
		return (
			<Window
				key={"window"+windowId}
				windowId={windowId}
				windowManager={this}
				onMount={(window) => {this.onWindowMount(window)}}
				onUnmount={(window) => {this.onWindowUnmount(window)}}
				onWillUpdate={() => {this.onWindowWillUpdate(this.windows[windowId])}}
				onTitleBarMouseDown={(event) => {this.onWindowTitleBarMouseDown(this.windows[windowId], event)}}/>
		);
	}
}

module.exports = WindowManager;
