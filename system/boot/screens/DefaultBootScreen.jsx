
const React = require('react');
requireCSS('./DefaultBootScreen.css');


class DefaultBootScreen extends React.Component
{
	constructor(props) {
		super(props);

		this.state = {
			logs: []
		};

		this.bootlogElement = null;
		this.onRefBootlogElement = this.onRefBootlogElement.bind(this);
		this.onBootLog = this.onBootLog.bind(this);
	}

	onRefBootlogElement(element) {
		this.bootlogElement = element;
	}

	onBootLog(data) {
		const log = JSON.parse(data);
		if(!log.options) {
			log.options = {};
		}
		this.setState({
			logs: this.state.logs.concat([ log ])
		});
	}

	componentDidMount() {
		process.stdin.addListener('data', this.onBootLog);
	}

	componentDidUpdate() {
		if(this.bootlogElement) {
			this.bootlogElement.scrollTop = this.bootlogElement.scrollHeight;
		}
	}

	componentWillUnmount() {
		process.stdin.removeListener('data', this.onBootLog);
	}

	renderLogs() {
		return (
			<div className="bootlog" ref={this.onRefBootlogElement}>
				<pre>{`
 88888888b oo          dP                 .88888.  .d88888b  
 88                    88                d8'   \`8b 88.    "' 
a88aaaa    dP 88d888b. 88  .dP  .d8888b. 88     88 \`Y88888b. 
 88        88 88'  \`88 88888"   88ooood8 88     88       \`8b 
 88        88 88    88 88  \`8b. 88.  ... Y8.   .8P d8'   .8P 
 dP        dP dP    dP dP   \`YP \`88888P'  \`8888P'   Y88888P
				`}</pre>
				{this.state.logs.map((log, index) => (
					<div key={index} className="bootlog-line" style={{color: log.options.color}}>
						{log.message}
					</div>
				))}
			</div>
		)
	}

	render() {
		return this.renderLogs();
	}
}


module.exports = DefaultBootScreen;
