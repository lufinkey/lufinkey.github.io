
const React = require('react');

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

			case 'video':
				return this.renderVideoWallpaper(this.props.wallpaper);

			default:
				return null;
		}
	}

	renderYoutubeWallpaper(wallpaper)
	{
		var videoSrc = "//www.youtube.com/embed/"+wallpaper.videoId+"?rel=0&autoplay=1&loop=1&disablekb=1&showinfo=0&controls=0&modestbranding=1&playlist="+wallpaper.videoId;
		var ghostVideoSrc = videoSrc + "&mute=1"
		if(!wallpaper.audible)
		{
			videoSrc += "&mute=1";
		}
		if(wallpaper.start)
		{
			videoSrc += "&start="+wallpaper.start;
		}
		return (
			<div className="wallpaper-container">
				<iframe className="wallpaper" src={videoSrc} frameBorder={0} allowFullScreen={true}></iframe>
				{ wallpaper.ghost ? (
					<iframe className="wallpaper ghost" src={ghostVideoSrc} frameBorder={0} allowFullScreen={true}></iframe>
				) : null}
			</div>
		);
	}

	renderImageWallpaper(wallpaper)
	{
		return (
			<div className="wallpaper-container">
				<div className="wallpaper" style={{backgroundImage:"url("+wallpaper.src+")"}}></div>
				{ wallpaper.ghost ? (
					<div className="wallpaper ghost" style={{backgroundImage:"url("+wallpaper.src+")"}}></div>
				) : null}
			</div>
		);
	}

	renderVideoWallpaper(wallpaper)
	{
		var videoSrc = wallpaper.src;
		if(wallpaper.start)
		{
			videoSrc += '#t='+wallpaper.start;
		}

		return (
			<div className="wallpaper-container">
				<video className="wallpaper" muted={!wallpaper.audible} autoPlay={true} loop={true}>
					<source src={videoSrc} type={wallpaper.mimeType}/>
				</video>
				{ wallpaper.ghost ? (
					<video className="wallpaper ghost" muted={true} autoPlay={true} loop={true}>
						<source src={videoSrc} type={wallpaper.mimeType}/>
					</video>
				) : null}
			</div>
		);
	}
}

module.exports = Wallpaper;
