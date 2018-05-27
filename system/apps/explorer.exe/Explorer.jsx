
const React = require('react');
const FileIconLayout = require('shell32.dll/FileIconLayout');
const fs = require('fs');
const { spawn } = require('child_process');

class Explorer extends React.Component
{
	static windowOptions = {
		title: 'explorer.exe'
	}

	constructor(props) {
		super(props);

		this.state = {
			files: null,
			dir: process.cwd()
		};
	}

	componentDidMount() {
		this.reloadFiles();
	}

	onCloseButtonClick() {
		this.props.window.close();
		process.exit(0);
	}

	reloadFiles() {
		try {
			const files = fs.readdirSync(this.state.dir);
			this.setState({
				files: files,
				filesError: null
			});
		}
		catch(error) {
			this.setState({
				filesError: error
			});
		}
	}

	onFileOpen(filename) {
		try {
			var stats = fs.statSync('./'+filename);
			if(stats.isDirectory()) {
				process.chdir('./'+filename);
				this.setState({
					dir: process.cwd(),
					files: null
				}, () => {
					this.reloadFiles();
				});
			}
			else if(stats.isFile()) {
				child_process.spawn('open', ['./'+filename]);
			}
			else {
				throw new Error("cannot open unknown file type");
			}
		}
		catch(error) {
			console.error(error);
		}
	}

	render() {
		return (
			<div className="explorer">
				{(this.state.filesError) ? (
					<div className="error">{this.state.filesError.message}</div>
				) : (this.state.files) ? (
					<FileIconLayout files={this.state.files} onFileOpen={this.onFileOpen.bind(this)}/>
				) : (
					<div className="loading"><i>loading...</i></div>
				)}
			</div>
		);
	}
}

module.exports = Explorer;
