
const React = require('react');
const ReactDOM = require('react-dom');
const Transcend32 = require('transcend32');

let uiRoot = null;
let uiStarted = false;
let screens = [];

class UIRoot extends React.Component
{
	constructor(props) {
		super(props);

		this.state = {
			screens: []
		};

		uiRoot = this;
		this.mounted = false;
	}

	componentDidMount() {
		this.mounted = true;
	}

	render() {
		return (
			<Transcend32>
				{screens.map((screen) => {
					return (
						<screen.component key={screen.key}/>
					);
				})}
			</Transcend32>
		)
	}
};



const SystemUI = {};

SystemUI.start = () => {
	if(uiStarted) {
		return;
	}
	uiStarted = true;

	ReactDOM.render(
		<UIRoot/>,
		document.getElementById('root')
	);
};

SystemUI.stop = () => {
	if(!uiStarted) {
		return;
	}
	uiStarted = false;
	uiRoot = null;

	ReactDOM.unmountComponentAtNode(
		document.getElementById("root")
	);
};

SystemUI.registerScreen = (key, component, uid) => {
	if(!uiStarted) {
		throw new Error("System UI has not been started");
	}
	else if(!uiRoot) {
		throw new Error("UIRoot is not ready");
	}
	for(var cmpScreen of screens) {
		if(cmpScreen.key == key) {
			throw new Error("screen with key \""+key+"\" has already been registered");
		}
	}
	screens.push({ key: key, component: component, uid: uid });
	if(uiRoot.mounted) {
		uiRoot.forceUpdate();
	}
};

SystemUI.unregisterScreen = (key, uid) => {
	if(!uiStarted) {
		throw new Error("System UI has not been started");
	}
	else if(!uiRoot) {
		throw new Error("UIRoot is not ready");
	}
	for(var i=0; i<screens.length; i++) {
		var cmpScreen = screens[i];
		if(cmpScreen.key == key) {
			if(cmpScreen.uid != uid) {
				throw new Error("cannot unregister screen as different user than the registerer");
			}
			screens.splice(i, 1);
			return;
		}
	}
	if(uiRoot.mounted) {
		uiRoot.forceUpdate();
	}
};



module.exports = SystemUI;
