
const React = require('react');
const SystemUI = require('sysui');
requireCSS('./style.css');


let displays = {};
let displayManager = null;


class DisplayManager extends React.Component
{
	constructor(props) {
		super(props);

		this.displays = [];
	}


	static create(key) {
		return new Promise((resolve, reject) => {
			try {
				SystemUI.register(key, (props) => {
					return (
						<DisplayManager onMount={resolve} {...props}/>
					);
				});
			}
			catch(error) {
				reject(error);
			}
		});
	}

	static destroy(key) {
		SystemUI.unregister(key);
	}


	componentDidMount() {
		if(this.props.onMount) {
			this.props.onMount(this);
		}
	}

	addDisplay(displayId, options={}) {
		options = Object.assign({}, options);
		if(this.displays[displayId]) {
			throw new Error("display "+displayId+" already exists");
		}
		this.displays[displayId] = {
			active: false,
			components: []
		};
		if(options.active) {
			this.setActiveDisplayId(displayId);
		}
	}

	removeDisplay(displayId) {
		if(!this.displays[displayId]) {
			return;
		}
		var display = this.displays[displayId];
		delete this.displays[displayId];
		if(display.active) {
			this.forceUpdate();
		}
	}

	addDisplayComponent(displayId, key, component) {
		var display = this.displays[displayId];
		if(!display) {
			throw new Error("display "+displayId+" does not exist");
		}
		display.components.push({key: key, component: component});
		if(display.active) {
			this.forceUpdate();
		}
	}

	removeDisplayComponent(displayId, key) {
		var display = this.displays[displayId];
		if(!display) {
			throw new Error("display "+displayId+" does not exist");
		}
		for(var i=0; i<display.components.length; i++) {
			if(display.components[i].key === key) {
				display.components.splice(i, 1);
				break;
			}
		}
		if(display.active) {
			this.forceUpdate();
		}
	}

	setActiveDisplayId(displayId) {
		if(!this.displays[displayId]) {
			throw new Error("display "+displayId+" does not exist");
		}
		for(var cmpId in this.displays) {
			var display = this.displays[displayId];
			if(cmpId === displayId) {
				display.active = true;
			}
			else {
				display.active = false;
			}
		}
		this.forceUpdate();
	}

	getActiveDisplayId() {
		for(var displayId in this.displays) {
			var display = this.displays[displayId];
			if(display.active) {
				return displayId;
			}
		}
		return null;
	}


	render() {
		const displayId = this.getActiveDisplayId();
		const display = (displayId != null) ? this.displays[displayId] : null;
		return (
			<div className="displaymgr">
				{(display != null) ? (
					<div className={'displaymgr-display display_'+displayId} key={'display_'+displayId}>
						{display.components.map((obj) => {
							const Component = obj.component;
							return (
								<Component key={'display_'+displayId+'::'+obj.key}/>
							);
						})}
					</div>
				) : null}
			</div>
		);
	}
};


module.exports = DisplayManager;
