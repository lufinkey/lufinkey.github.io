
const depends = [
	'system/shell32.exe/TaskBar',
	'system/shell32.exe/FileIconLayout',
	'system/shell32.exe/WindowManager',
	'system/shell32.exe/Wallpaper'
];

const startupAudio = new Audio('system/shell32.dll/startup.mp3');

defineModule(depends, (TaskBar, FileIconLayout, WindowManager, Wallpaper) => {
	const wallpapers = [
		{type: 'youtube', videoId: 'WmAoE-ZkoQs', audible: true},
		{type: 'image', url: '/system/wallpapers/japan-purple-aesthetic.jpg'}
	];
	
	const files = {
		"pornography.txt": {type: 'txt'}
	};

	class Desktop extends React.Component
	{
		constructor(props)
		{
			super(props);

			this.windowManager = null;
			this.taskbar = null;
		}
		
		componentDidMount()
		{
			
			startupAudio.play();
		}

		onFileOpen(filename)
		{
			if(filename == "pornography.txt")
			{
				this.windowManager.createWindow({title: filename});
			}
		}

		onWindowManagerMount(windowManager)
		{
			this.windowManager = windowManager;
		}

		onWindowManagerUnmount(windowManager)
		{
			this.windowManager = null;
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

	return Desktop;
});
