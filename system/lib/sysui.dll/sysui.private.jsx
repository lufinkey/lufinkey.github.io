
const React = require('react');
const ReactDOM = require('react-dom');
const Transcend32 = require('transcend32');


let uiRoot = null;
let uiStarted = false;
let screens = [];

class UIRoot extends React.Component
{
	componentDidMount() {
		uiRoot = this;
	}

	componentWillUnmount() {
		uiRoot = null;
	}

	render() {
		return (
			<Transcend32>
				{screens.map((screen) => {
					const ScreenComponent = screen.component;
					return (<ScreenComponent key={screen.key}/>);
				})}
			</Transcend32>
		)
	}
};




const PrivateSystemUI = {};

let sysUIThread = null;

PrivateSystemUI.start = () => {
	if(uiStarted) {
		return;
	}
	uiStarted = true;
	ReactDOM.render(
		<UIRoot/>,
		document.getElementById('root')
	);
	syscall('thread', () => {
		return new Promise((resolve, reject) => {
			sysUIThread = {
				resolve: resolve,
				reject: reject
			};
		})
	}, () => {
		console.error(new Error("wtf"));
		PrivateSystemUI.stop();
	});
};

PrivateSystemUI.stop = () => {
	if(!uiStarted) {
		return;
	}
	uiStarted = false;
	ReactDOM.unmountComponentAtNode(
		document.getElementById('root')
	);
	const thread = sysUIThread;
	sysUIThread = null;
	thread.resolve();
};

Object.defineProperty(PrivateSystemUI, 'started', {
	get: () => {
		return uiStarted
	}
});

PrivateSystemUI.registerScreen = (key, component, pid) => {
	if(!uiStarted) {
		throw new Error("System UI has not been started");
	}
	for(var cmpScreen of screens) {
		if(cmpScreen.key == key) {
			throw new Error("screen with key \""+key+"\" has already been registered");
		}
	}
	screens = [{
		key: key,
		component: component,
		pid: pid,
		listeners: {
			unregister: []
		}
	} ].concat(screens);
	if(uiRoot) {
		uiRoot.forceUpdate();
	}
};

PrivateSystemUI.addScreenListener = (key, event, listener) => {
	if(typeof listener !== 'function') {
		throw new TypeError("listener must be a function");
	}
	for(var cmpScreen of screens) {
		if(cmpScreen.key == key) {
			if(cmpScreen.listeners[event] == null) {
				throw new Error("invalid event name \""+event+"\"");
			}
			cmpScreen.listeners[event].push(listener);
			return;
		}
	}
	throw new Error("screen not found");
};

PrivateSystemUI.removeScreenListener = (key, event, listener) => {
	for(var cmpScreen of screens) {
		if(cmpScreen.key == key) {
			if(cmpScreen.listeners[event]) {
				var index = cmpScreen.listeners[event].indexOf(listener);
				if(index != -1) {
					cmpScreen.listeners[event].splice(index, 1);
				}
			}
			return;
		}
	}
};

PrivateSystemUI.unregisterScreen = (key, pid) => {
	for(var i=0; i<screens.length; i++) {
		var cmpScreen = screens[i];
		if(cmpScreen.key == key) {
			if(cmpScreen.pid != pid) {
				throw new Error("cannot unregister screen as different process than the registerer");
			}
			screens.splice(i, 1);
			const listeners = cmpScreen.listeners['unregister'].slice(0);
			for(var listener of listeners) {
				listener();
			}
		}
	}
	if(uiRoot) {
		uiRoot.forceUpdate();
	}
};




module.exports = Object.assign({}, PrivateSystemUI);
