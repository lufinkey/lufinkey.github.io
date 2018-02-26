
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

					var scaleX = startScaleX + ((1.0-startScaleX) * progress);
					var scaleY = startScaleX + ((1.0-startScaleX) * progress);
					
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
					}
					else
					{
						var offsetScale = 100-(((timeMillis-(totalTime/2))/(totalTime/2))*100);
						offsetX *= offsetScale;
						offsetY *= offsetScale * 0.7;
					}

					this.setState({started: true, offsetX: offsetX, offsetY: offsetY, scaleX: scaleX, scaleY: scaleY});
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

				style.position = 'fixed';
				style.zIndex = 9999;
				style.left = (centerX - (width/2) + this.state.offsetX);
				style.top = (centerY - (height/2) + this.state.offsetY);
				style.right = rootRect.width - (centerX + (width/2) + this.state.offsetX);
				style.bottom = rootRect.height - (centerY + (height/2) + this.state.offsetY);
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
