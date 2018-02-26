
const depends = [];

defineModule(depends, () => {
	class CRT extends React.Component
	{
		constructor(props)
		{
			super(props);

			this.state = {
				started: false
			};
		}

		componentDidMount()
		{
			setTimeout(() => {
				var domNode = ReactDOM.findDOMNode(this);
				var screenContent = domNode.querySelector(".crt-screen-content");
				
				var rootRect = document.getElementById("root").getBoundingClientRect();
				var contentRect = screenContent.getBoundingClientRect();

				var startScaleX = contentRect.width / rootRect.width;
				var startScaleY = contentRect.height / rootRect.height;

				let timeMillis = 0;
				var totalTime = 2000;

				const animInterval = setInterval(() => {
					timeMillis += 33;

					var progress = (timeMillis/totalTime);
					var done = false;

					var scaleX = startScaleX + ((1.0-startScaleX) * progress);
					var scaleY = startScaleY + ((1.0-startScaleY) * progress);
					
					var radians = progress * Math.PI * 4;

					var offsetX = Math.sin(radians);
					var offsetY = Math.cos(radians);
					
					if(timeMillis < (totalTime/2))
					{
						var offsetScale = (timeMillis/(totalTime/2))*100;
						offsetX *= offsetScale;
						offsetY *= offsetScale * 0.7;
					}
					else if(timeMillis > totalTime)
					{
						offsetX = 0;
						offsetY = 0;
						scaleX = 1;
						scaleY = 1;
						clearInterval(animInterval);
						done = true;
					}
					else
					{
						var offsetScale = 100-(((timeMillis-(totalTime/2))/(totalTime/2))*100);
						offsetX *= offsetScale;
						offsetY *= offsetScale * 0.7;
					}

					if(!done)
					{
						this.setState({
							started: true,
							offsetX: offsetX,
							offsetY: offsetY,
							scaleX: scaleX,
							scaleY: scaleY
						});
					}
					else
					{
						this.setState({
							started: true,
							fullscreen: true,
							offsetX: undefined,
							offsetY: undefined,
							scaleX: undefined,
							scaleY: undefined
						});
					}
				}, 33);
			}, 2000);
		}

		render()
		{
			const style = {};

			if(this.state.started)
			{
				var rootRect = document.getElementById("root").getBoundingClientRect();

				var width = rootRect.width * this.state.scaleX;
				var height = rootRect.height * this.state.scaleY;

				var centerX = rootRect.left + (rootRect.width/2);
				var centerY = rootRect.top + (rootRect.height/2);

				if(this.state.fullscreen)
				{
					style.left = 0;
					style.top = 0;
					style.right = 0;
					style.bottom = 0;
				}
				else
				{
					style.left = (centerX - (width/2) + this.state.offsetX);
					style.top = (centerY - (height/2) + this.state.offsetY);
					style.width = width;
					style.height = height;
				}
				style.position = 'fixed';
				style.animation = 'none';

				return (
					<div className="crt-container">
						<div className="crt">
							<img className="crt-bg" src="system/transcend32.exe/CRT.jpg"/>
							<div className="crt-screen">
							</div>
						</div>
						<div className="crt-screen-content" style={style}>
							{this.props.children}
							<div className="crt-effects">
								<div className="crt-scanlines"></div>
								<div className="crt-static-overlay"></div>
							</div>
						</div>
					</div>
				);
			}
			else
			{
				return (
					<div className="crt-container">
						<div className="crt">
							<img className="crt-bg" src="system/transcend32.exe/CRT.jpg"/>
							<div className="crt-screen">
								<div className="crt-screen-content" style={style}>
									{this.props.children}
									<div className="crt-effects">
										<div className="crt-scanlines"></div>
										<div className="crt-static-overlay"></div>
									</div>
								</div>
							</div>
						</div>
					</div>
				);
			}
		}
	}

	return CRT;
});
