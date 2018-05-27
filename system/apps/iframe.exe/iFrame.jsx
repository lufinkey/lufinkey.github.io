
const React = require('react');
const fs = require('fs');


// parse arguments
let url = null;
var urlFile = null;
for(var i=1; i<process.argv.length; i++) {
	var arg = process.argv[i];
	if(arg == "-f") {
		if(urlFile) {
			console.error("cannot specify multiple files to open");
			process.exit(1);
		}
		i++;
		var value = process.argv[i];
		urlFile = value;
	}
	else {
		if(url) {
			console.error("cannot specify multiple URLs");
			process.exit(1);
		}
		url = arg;
	}
}
if(url && urlFile) {
	console.error("cannot specify both url and file");
	process.exit(1);
}

// read the url from the file, if specified
if(urlFile) {
	url = fs.readFileSync(urlFile, {encoding:'utf8'});
}


class iFrame extends React.Component
{
	static windowOptions = {
		title: "iframe.exe"
	}

	constructor(props) {
		super(props);

		this.state = {
			url: url
		};
	}

	async setup() {
		try {
			
		}
		catch(error) {
			console.error(error);
			this.setState({
				error: error
			});
		}
	}

	componentDidMount() {
		this.setup().then(() => {
			// done
		}).catch((error) => {
			// error
		})
	}

	onCloseButtonClick() {
		this.props.window.close();
		process.exit(0);
	}

	render() {
		if(this.state.error) {
			return <div className="error">{this.state.error.message}</div>
		}
		return (
			<iframe className="iframe-content" src={this.state.url} scrolling='yes'></iframe>
		);
	}
}

module.exports = iFrame;
