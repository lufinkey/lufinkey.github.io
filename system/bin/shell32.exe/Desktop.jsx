
requireCSS('./Desktop.css');
const fs = require('fs');
const child_process = require('child_process');
const React = require('react');
const { WindowManager } = require('dwm');
const TaskBar = require('./TaskBar');
const FileIconLayout = require('./FileIconLayout');
const Wallpaper = require('./Wallpaper');


const wallpapers = [
	{type: 'video', src: 'system/share/wallpapers/the-grid.mp4', mimeType: 'video/mp4', start: 7, ghost: false}, // "The Grid"
	{type: 'youtube', videoId: 'w8ndrYXBXT4', audible: false, ghost: true}, // grid
	{type: 'youtube', videoId: 'WmAoE-ZkoQs', audible: true, ghost: true}, // rainy alley
	{type: 'image', src: 'system/share/wallpapers/japan-purple-aesthetic.jpg', ghost: true}
];

let files = null;


class Desktop extends React.Component
{
	constructor(props)
	{
		super(props);

		this.windowManager = null;
		this.taskbar = null;

		this.onWindowManagerRef = this.onWindowManagerRef.bind(this);
		this.onTaskBarRef = this.onTaskBarRef.bind(this);
	}

	componentWillMount()
	{
		try {
			files = fs.readdirSync('/home/Desktop');
		}
		catch(error) {
			files = [];
		}
	}

	onDesktopMouseDown(event)
	{
		if(this.taskbar && this.taskbar.state.startMenuOpen)
		{
			this.taskbar.setState({startMenuOpen: false});
		}
	}

	onFileOpen(filename)
	{
		child_process.spawn('open', ['/home/Desktop/'+filename]);
	}

	onWindowManagerRef(windowManager)
	{
		if(windowManager) {
			this.windowManager = windowManager;
			process.env['WINDOW_MANAGER'] = {
				createWindow: (...args) => {
					return windowManager.createWindow(...args);
				},
				destroyWindow: (...args) => {
					return windowManager.destroyWindow(...args);
				}
			};
		}
		else {
			this.windowManager = null;
			process.env['WINDOW_MANAGER'] = null;
		}
	}

	onWindowCreate(window)
	{
		this.forceUpdate();
	}

	onWindowUpdate(window)
	{
		if(this.taskbar) {
			this.taskbar.forceUpdate();
		}
	}

	onWindowDestroy(window)
	{
		this.forceUpdate();
	}

	onTaskBarRef(taskbar)
	{
		this.taskbar = taskbar;
	}

	render()
	{
		var windows = {};
		if(this.windowManager) {
			windows = Object.assign({}, this.windowManager.windows)
		}

		return (
			<div id={this.props.id} className="desktop">
				<Wallpaper wallpaper={wallpapers[0]}/>
				<div className="desktop-area" onMouseDown={(event)=>{this.onDesktopMouseDown(event)}}>
					<FileIconLayout
						files={files}
						onFileOpen={(fileName)=>{this.onFileOpen(fileName)}}/>
					<WindowManager
						ref={this.onWindowManagerRef}
						onFileOpen={(filename) => {this.onFileOpen(filename)}}
						onWindowCreate={(window) => {this.onWindowCreate(window)}}
						onWindowUpdate={(window) => {this.onWindowUpdate(window)}}
						onWindowDestroy={(window) => {this.onWindowDestroy(window)}}/>
				</div>
				<TaskBar
					windows={windows}
					ref={this.onTaskBarRef}
					onWindowButtonClick={(window, event) => {this.onTaskBarWindowButtonClick(window, event)}}/>
			</div>
		);
	}
}

module.exports = Desktop;
