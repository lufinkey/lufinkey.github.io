
const wallpapers = [
	{type: 'youtube', videoId: 'WmAoE-ZkoQs', audible: true},
	{type: 'image', url: 'http://pm1.narvii.com/6687/790510e62335d76e11324dbcff09cb777623df53_00.jpg' }
];

const files = [
	{type: 'txt', name: 'Pornography'}
];



class Desktop extends React.Component
{
	render()
	{
		return (
			<div id={this.props.id} className="desktop">
				<div className="tv-effects">
					<div className="tv-scanlines"></div>
					<div className="tv-static-overlay"></div>
				</div>
				<FileLayout files={files}/>
				{this.renderRandomWallpaper()}
				<div className="taskbar">
					<button type="button" className="start-button">
						<span className="icon"></span> Start
					</button>
				</div>
			</div>
		);
	}

	renderRandomWallpaper()
	{
		var index = Math.floor(Math.random()*wallpapers.length);
		return this.renderWallpaper(wallpapers[1]);
	}

	renderWallpaper(wallpaper)
	{
		switch(wallpaper.type)
		{
			case 'youtube':
				return this.renderYoutubeWallpaper(wallpaper);
			
			case 'image':
				return this.renderImageWallpaper(wallpaper);
		}
	}

	renderYoutubeWallpaper(wallpaper)
	{
		var videoSrc = "//www.youtube.com/embed/"+wallpaper.videoId+"?rel=0&autoplay=1&loop=1&showinfo=0&controls=0&modestbranding=1";
		var ghostVideoSrc = videoSrc + "&mute=1"
		if(!wallpaper.audible)
		{
			videoSrc += "&mute=1";
		}
		return (
			<div className="wallpaper-container">
				<iframe className="wallpaper" src={videoSrc} frameBorder={0} allowFullScreen={true}></iframe>
				<iframe className="wallpaper ghost" src={ghostVideoSrc} frameBorder={0} allowFullScreen={true}></iframe>
			</div>
		);
	}

	renderImageWallpaper(wallpaper)
	{
		return (
			<div className="wallpaper-container">
				<div className="wallpaper" style={{backgroundImage:"url("+wallpaper.url+")"}}></div>
				<div className="wallpaper ghost" style={{backgroundImage:"url("+wallpaper.url+")"}}></div>
			</div>
		);
	}
}



class FileLayout extends React.Component
{
	constructor(props)
	{
		if(!props.files)
		{
			props.files = [];
		}
		super(props);

		this.state = {
			selectedFile: null,
			fileStates: {}
		};
	}

	onSelectFile(fileName)
	{
		//
	}

	render()
	{
		return (
			<div className="icon-grid">
				{this.props.files.map((file) => this.renderIcon(file))}
			</div>
		);
	}

	renderIcon(file)
	{
		var fileState = this.state.fileStates[file.name];
		if(!fileState)
		{
			fileState = {position:{x:0,y:0}};
		}
		return (
			<DesktopIcon key={file.name} fileType={file.type} fileName={file.name}/>
		);
	}
}



class DesktopIcon extends React.Component
{
	constructor(props)
	{
		super(props);

		var position = Object.assign({x:0,y:0}, props.position);

		this.state = {
			position: position
		};
	}

	onMouseDown(event)
	{
		if(this.props.onSelect)
		{
			this.props.onSelect(this.props.fileName);
		}
	}

	render()
	{
		var classNames = ["file"];
		if(this.props.fileType)
		{
			classNames.push("file-"+this.props.fileType);
		}
		var styles = {
			left: this.state.position.x,
			top: this.state.position.y
		};

		return (
			<div
				className={classNames.join(' ')}
				style={styles}
				onMouseDown={(event) => {this.onMouseDown(event)}}>
				<div className="filename">{this.props.fileName}</div>
			</div>
		);
	}
}
