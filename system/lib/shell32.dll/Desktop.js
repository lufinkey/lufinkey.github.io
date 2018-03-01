
requireCSS('./Desktop.css');
const fs = require('fs');
const child_process = require('child_process');
const React = require('react');
const WindowManager = require('dwm');
const TaskBar = require('./TaskBar');
const FileIconLayout = require('./FileIconLayout');
const Wallpaper = require('./Wallpaper');


const startupAudio = new Audio('system/lib/shell32.dll/audio/startup.mp3');

const wallpapers = [
	{type: 'youtube', videoId: 'WmAoE-ZkoQs', audible: true},
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
	
	componentDidMount()
	{
		startupAudio.play();
	}

	onFileOpen(filename)
	{
		child_process.spawn('open', ['/home/Desktop/'+filename]);
	}

	onWindowManagerMount(windowManager)
	{
		this.windowManager = windowManager;
		process.env['GET_WINDOW_MANAGER'] = () => {
			return this.windowManager;
		};
	}

	onWindowManagerUnmount(windowManager)
	{
		this.windowManager = null;
		process.env['GET_WINDOW_MANAGER'] = null;
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
