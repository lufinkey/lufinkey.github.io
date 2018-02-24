
const depends = [];

defineModule(depends, () => {
	class Wallpaper extends React.Component
	{
		render()
		{
			if(!this.props.wallpaper)
			{
				return null;
			}

			switch(this.props.wallpaper.type)
			{
				case 'youtube':
					return this.renderYoutubeWallpaper(this.props.wallpaper);
				
				case 'image':
					return this.renderImageWallpaper(this.props.wallpaper);

				default:
					return null;
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

	return Wallpaper;
});
