
const depends = [
	'screens/desktop/TaskBar',
	'components/FileIconLayout'
];

defineModule(depends, (TaskBar, FileIconLayout) => {
	const wallpapers = [
		{type: 'youtube', videoId: 'WmAoE-ZkoQs', audible: true},
		{type: 'image', url: 'http://pm1.narvii.com/6687/790510e62335d76e11324dbcff09cb777623df53_00.jpg' }
	];
	
	const files = {
		"pornography.txt": {type: 'txt'}
	};


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
					<FileIconLayout files={files}/>
					{this.renderRandomWallpaper()}
					<TaskBar/>
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

	return Desktop;
});
