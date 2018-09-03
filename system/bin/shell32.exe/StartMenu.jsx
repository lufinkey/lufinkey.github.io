
requireCSS('./StartMenu.css');

const React = require('react');
const { spawn } = require('child_process');

class StartMenu extends React.Component
{
	constructor(props) {
		super(props);
	}

	onClickAboutMe() {
		this.setState({
			startMenuOpen: false,
		});
		spawn('aboutme');
		if(this.props.onTaskSelected) {
			this.props.onTaskSelected();
		}
	}

	onClickExplorer() {
		this.setState({
			startMenuOpen: false
		});
		spawn('explorer');
		if(this.props.onTaskSelected) {
			this.props.onTaskSelected();
		}
	}

	onClickTerminal() {
		this.setState({
			startMenuOpen: false,
		});
		spawn('terminal');
		if(this.props.onTaskSelected) {
			this.props.onTaskSelected();
		}
	}

	onClickRun() {
		this.setState({
			startMenuOpen: false,
		});
		//spawn('run');
		if(this.props.onTaskSelected) {
			this.props.onTaskSelected();
		}
	}

	onClickReboot() {
		this.setState({
			startMenuOpen: false,
		});
		spawn('/system/init.js');
		if(this.props.onTaskSelected) {
			this.props.onTaskSelected();
		}
	}

	render() {
		const style = {};
		if(this.props.opened)
		{
			style.display = 'block';
		}
		else
		{
			style.display = 'none';
		}

		return (
			<div className="start-menu" style={style}>
				<div className="left-banner">
					<div className="vertical-text">
						Finke<span className="osWhite">OS</span>
					</div>
				</div>
				<ul className="items">
					<li onClick={this.onClickAboutMe.bind(this)}>About Me</li>
					<li onClick={this.onClickTerminal.bind(this)}>Terminal</li>
					<li className="divider"></li>
					<li onClick={this.onClickReboot.bind(this)}>Reboot</li>
				</ul>
			</div>
		);
	}
}

module.exports = StartMenu;
