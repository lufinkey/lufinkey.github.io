
const React = require('react');
const ReactDOM = require('react-dom');


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
			<div style={{width:'100%',height:'100%',margin:0,padding:0}}>
				{screens.map((screen) => {
					const ScreenComponent = screen.component;
					return (<ScreenComponent key={screen.key}/>);
				})}
			</div>
		)
	}
};



const startUI = () => {
	if(uiStarted) {
		return;
	}
	uiStarted = true;
	ReactDOM.render(
		<UIRoot/>,
		document.getElementById('root')
	);
};

const stopUI = () => {
	if(!uiStarted) {
		return;
	}
	uiStarted = false;
	ReactDOM.unmountComponentAtNode(
		document.getElementById('root')
	);
};

const registerScreen = (key, component, pid) => {
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
		pid: pid
	} ].concat(screens);
	if(uiRoot) {
		uiRoot.forceUpdate();
	}
};

const unregisterScreen = (key, pid) => {
	for(var i=0; i<screens.length; i++) {
		var cmpScreen = screens[i];
		if(cmpScreen.key == key) {
			if(cmpScreen.pid != pid) {
				throw new Error("cannot unregister screen as different process than the registerer");
			}
			screens.splice(i, 1);
		}
	}
	if(uiRoot) {
		uiRoot.forceUpdate();
	}
};



const PrivateSystemUI = Object.defineProperties({}, {
	start: {
		value: startUI,
		writable: false
	},
	stop: {
		value: stopUI,
		writable: false
	},
	started: {
		get: () => {
			return uiStarted;
		}
	},
	registerScreen: {
		value: registerScreen,
		writable: false
	},
	unregisterScreen: {
		value: unregisterScreen,
		writable: false
	}
});



module.exports = PrivateSystemUI;
