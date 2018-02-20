
const wallpapers = [
	{type: 'youtube', videoId: 'WmAoE-ZkoQs', audible: true},
	{type: 'image', url: 'http://pm1.narvii.com/6687/790510e62335d76e11324dbcff09cb777623df53_00.jpg' }
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
				<div className="icon-grid">
					<DesktopIcon fileExtension="txt" fileName="Pornography"/>
				</div>
				
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



class DesktopIcon extends React.Component
{
	constructor(props)
	{
		super(props);

		var initialPosition = Object.assign({x:0,y:0}, props.initialPosition);

		this.state = {
			position: initialPosition
		};
	}

	render()
	{
		var classNames = ["file"];
		if(this.props.fileExtension)
		{
			classNames.push("file-"+this.props.fileExtension);
		}
		var styles = {
			left: this.state.x,
			top: this.state.y
		};

		return (
			<div className={classNames.join(' ')} style={styles}>
				<div className="filename">{this.props.fileName}</div>
			</div>
		);
	}
}
