
const depends = [
	'shell32.exe/Window'
];

defineModule(depends, (Window) => {
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
				draggingFile: null,
				selectedFile: null
			};

			// bind methods	
			/*this.onDocumentMouseDown = this.onDocumentMouseDown.bind(this);
			this.onDocumentMouseMove = this.onDocumentMouseMove.bind(this);
			this.onDocumentMouseUp = this.onDocumentMouseUp.bind(this);*/
		}

		createDefaultWindowState()
		{
			return {
				x: 20,
				y: 20,
				width: 640,
				height: 480,
				title: ""
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
					return;
				}
			}
		}

		onWindowTitleBarMouseDown(window, event)
		{
			//
		}

		onWindowMinimizeButtonClick(window, event)
		{
			//
		}

		onWindowMaximizeButtonClick(window, event)
		{
			//
		}

		onWindowCloseButtonClick(window, event)
		{
			this.destroyWindow(window);
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

		render()
		{
			return (
				<div className="dwm_exe">
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
					onMount={(window) => {this.onWindowMount(window)}}
					onUnmount={(window) => {this.onWindowUnmount(window)}}
					onMinimizeButtonClick={(event) => {this.onWindowMinimizeButtonClick(this.windows[windowId], event)}}
					onMaximizeButtonClick={(event) => {this.onWindowMaximizeButtonClick(this.windows[windowId], event)}}
					onCloseButtonClick={(event) => {this.onWindowCloseButtonClick(this.windows[windowId], event)}}/>
			);
		}
	}

	return WindowManager;
});
