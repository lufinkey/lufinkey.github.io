
requireCSS('./Desktop.css');
const fs = require('fs');
const child_process = require('child_process');
const React = require('react');
const WindowManager = require('dwm');
const TaskBar = require('./TaskBar');
const FileIconLayout = require('./FileIconLayout');
const Wallpaper = require('./Wallpaper');


const wallpapers = [
	{type: 'youtube', videoId: 'WmAoE-ZkoQs', audible: true}, // rainy alley
	{type: 'youtube', videoId: 'IlKsfV2mRR8', audible: false, start: 8}, // "The Grid" VHS
	{type: 'youtube', videoId: 'w8ndrYXBXT4', audible: false}, // grid
	{type: 'image', url: 'system/share/wallpapers/japan-purple-aesthetic.jpg'}
];

let files = null;


class Desktop extends React.Component
{
	constructor(props)
	{
		super(props);

		this.windowManager = null;
		this.taskbar = null;
	}

	componentWillMount()
	{
		files = fs.readdirSync('/home/Desktop');
	}

	onFileOpen(filename)
	{
		child_process.spawn('open', ['/home/Desktop/'+filename]);
	}

	onWindowManagerMount(windowManager)
	{
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

	onWindowManagerUnmount(windowManager)
	{
		this.windowManager = null;
		process.env['WINDOW_MANAGER'] = null;
	}

	onWindowCreate(window)
	{
		this.setState({windowIds: Object.keys(this.windowManager.windows)});
	}

	onWindowDestroy(window)
	{
		this.setState({windowIds: Object.keys(this.windowManager.windows)});
	}

	onWindowWillUpdate(window)
	{
		this.taskbar.forceUpdate();
	}

	onTaskBarMount(taskbar)
	{
		this.taskbar = taskbar;
	}

	onTaskBarUnmount(taskbar)
	{
		this.taskbar = null;
	}

	render()
	{
		var windows = {};
		if(this.windowManager)
		{
			windows = Object.assign({}, this.windowManager.windows)
		}

		return (
			<div id={this.props.id} className="desktop">
				<Wallpaper wallpaper={wallpapers[1]}/>
				<FileIconLayout files={files} onFileOpen={(fileName) => {this.onFileOpen(fileName)}}/>
				<WindowManager
					onMount={(windowMgr) => {this.onWindowManagerMount(windowMgr)}}
					onUnmount={(windowMgr) => {this.onWindowManagerUnmount(windowMgr)}}
					onWindowWillUpdate={(window) => {this.onWindowWillUpdate(window)}}
					onFileOpen={(filename) => {this.onFileOpen(filename)}}
					onWindowCreate={(window) => {this.onWindowCreate(window)}}
					onWindowDestroy={(window) => {this.onWindowDestroy(window)}}/>
				<TaskBar
					windows={windows}
					onMount={(taskbar) => {this.onTaskBarMount(taskbar)}}
					onUnmount={(taskbar) => {this.onTaskBarUnmount(taskbar)}}
					onWindowButtonClick={(window, event) => {this.onTaskBarWindowButtonClick(window, event)}}/>
			</div>
		);
	}
}

module.exports = Desktop;
