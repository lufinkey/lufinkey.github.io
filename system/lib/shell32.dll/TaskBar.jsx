
requireCSS('./TaskBar.css');
requireCSS('./StartMenu.css');
const { spawn } = require('child_process');
const React = require('react');
const TaskBarWindowButton = require('./TaskBarWindowButton');

class TaskBar extends React.Component
{
	constructor(props)
	{
		super(props);

		this.state = {
			startMenuOpen: false
		};
	}

	onStartButtonMouseDown(event)
	{
		this.setState({
			startMenuOpen: !this.state.startMenuOpen
		});
	}

	onClickAboutMe()
	{
		this.setState({
			startMenuOpen: false,
		});
		spawn('aboutme');
	}

	onClickExplorer()
	{
		this.setState({
			startMenuOpen: false
		});
		spawn('explorer');
	}

	onClickTerminal()
	{
		this.setState({
			startMenuOpen: false,
		});
		spawn('terminal');
	}

	onClickRun()
	{
		this.setState({
			startMenuOpen: false,
		});
		//spawn('run');
	}

	onClickReboot()
	{
		this.setState({
			startMenuOpen: false,
		});
		spawn('/system/boot.js');
	}

	renderStartMenu()
	{
		const style = {};
		if(this.state.startMenuOpen)
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
					<li onClick={()=>{this.onClickAboutMe()}}>About Me</li>
					<li onClick={()=>{this.onClickExplorer()}}>Explorer</li>
					<li onClick={()=>{this.onClickTerminal()}}>Terminal</li>
					<li onClick={()=>{this.onClickRun()}}>Run</li>
					<li className="divider"></li>
					<li onClick={()=>{this.onClickReboot()}}>Reboot</li>
				</ul>
			</div>
		);
	}

	render()
	{
		var startButtonClassNames = ["start-button"];
		if(this.state.startMenuOpen)
		{
			startButtonClassNames.push('opened');
		}

		return (
			<div className="taskbar">
				{this.renderStartMenu()}
				<button type="button" className={startButtonClassNames.join(' ')} onMouseDown={(event)=>{this.onStartButtonMouseDown(event)}}>Start</button>
				<div className="taskbar-windows">
					{Object.keys(this.props.windows).map((windowId) => (
						<TaskBarWindowButton
							key={"window"+windowId}
							window={this.props.windows[windowId]}/>
					))}
				</div>
			</div>
		);
	}
}

module.exports = TaskBar;
