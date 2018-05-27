
requireCSS('./style.css');
const React = require('react');
const fs = require('fs');


if(process.argv.length > 2) {
	console.error("too many arguments");
	process.exit(1);
}


var defaultText = "";
try {
	if(process.argv.length === 2) {
		defaultText = fs.readFileSync(process.argv[1], {encoding: 'utf8'});
	}
}
catch(error) {
	console.error("unable to read file: ", error);
	process.exit(2);
}


class TextEdit extends React.Component
{
	static windowOptions = {
		title: "textedit.exe"
	}

	constructor(props) {
		super(props);

		this.state = {
			defaultText: defaultText
		};
	}

	onCloseButtonClick() {
		this.props.window.close();
		process.exit(0);
	}

	render() {
		return (
			<textarea className="textedit-area" defaultValue={this.state.defaultText}></textarea>
		);
	}
}

module.exports = TextEdit;
