
const React = require('react');
const ReactDOM = require('react-dom');
const Transcend32 = require('transcend32');
requireCSS('./init.css');
let Shell32 = null;
let SelfAd = null;

const startupAudio = new Audio('system/lib/shell32.dll/audio/startup.mp3');

let osComponent = null;
let logs = [];
let booted = false;

process.stdin.on('data', (data) => {
	try {
		const log = JSON.parse(data);
		if(!log.options) {
			log.options = {};
		}
		logs.push(log);
		if(osComponent != null) {
			osComponent.forceUpdate();
		}
	}
	catch(error) {
		console.error(error);
	}
});

process.stdin.on('close', () => {
	booted = true;
	startupAudio.play();
	Shell32 = require('shell32');
	SelfAd = require('selfad');
	if(osComponent != null) {
		osComponent.forceUpdate();
	}
});


class OS extends React.Component
{
	constructor(props) {
		super(props);
	}

	componentDidMount() {
		osComponent = this;
	}

	componentDidUpdate() {
		var osElement = ReactDOM.findDOMNode(this);
		if(osElement != null)
		{
			var bootlogElement = osElement.querySelector('.bootlog');
			if(bootlogElement != null)
			{
				bootlogElement.scrollTop = bootlogElement.scrollHeight;
			}
		}
	}

	componentWillUnmount() {
		osComponent = null;
	}

	renderLogs() {
		return (
			<div className="bootlog">
				<pre>{`
 88888888b oo          dP                 .88888.  .d88888b  
 88                    88                d8'   \`8b 88.    "' 
a88aaaa    dP 88d888b. 88  .dP  .d8888b. 88     88 \`Y88888b. 
 88        88 88'  \`88 88888"   88ooood8 88     88       \`8b 
 88        88 88    88 88  \`8b. 88.  ... Y8.   .8P d8'   .8P 
 dP        dP dP    dP dP   \`YP \`88888P'  \`8888P'   Y88888P
				`}</pre>
				{logs.map((log, index) => (
					<div key={index} className="bootlog-line" style={{color: log.options.color}}>
						{log.message}
					</div>
				))}
			</div>
		);
	}

	render() {
		if(!booted) {
			return (
				<Transcend32>
					{this.renderLogs()}
				</Transcend32>
			);
		}
		else {
			return (
				<Transcend32>
					<Shell32/>
					<SelfAd/>
				</Transcend32>
			);
		}
	}
}


// render the DOM
ReactDOM.render(
	<OS/>,
	document.getElementById('root')
);
