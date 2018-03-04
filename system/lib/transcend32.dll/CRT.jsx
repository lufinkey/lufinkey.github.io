
const React = require('react');
const ReactDOM = require('react-dom');

class CRT extends React.Component
{
	constructor(props)
	{
		super(props);

		this.state = {
			started: false,
			fullscreen: false,
			animating: false,
			offsetX: null,
			offsetY: null,
			scaleX: null,
			scaleY: null
		};

		this.screenExpandInterval = null;
	}

	animateScreenExpand()
	{
		var domNode = ReactDOM.findDOMNode(this);
		var screenContent = domNode.querySelector(".crt-screen-content");
		
		var rootRect = document.getElementById("root").getBoundingClientRect();
		var contentRect = screenContent.getBoundingClientRect();

		var startScaleX = contentRect.width / rootRect.width;
		var startScaleY = contentRect.height / rootRect.height;

		let timeMillis = 0;
		var totalTime = 2000;

		this.screenExpandInterval = setInterval(() => {
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
				clearInterval(this.screenExpandInterval);
				this.screenExpandInterval = null;
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
					fullscreen: true,
					animating: true,
					offsetX: offsetX,
					offsetY: offsetY,
					scaleX: scaleX,
					scaleY: scaleY
				});
			}
			else
			{
				this.setState({
					fullscreen: true,
					animating: false,
					offsetX: undefined,
					offsetY: undefined,
					scaleX: undefined,
					scaleY: undefined
				});
			}
		}, 33);
	}

	componentDidMount()
	{
		setTimeout(() => {
			if(this.props.onScreenTurnOn)
			{
				this.props.onScreenTurnOn();
			}
		}, 2000);
	}

	componentWillReceiveProps(nextProps)
	{
		if(!this.props.fullscreen && nextProps.fullscreen)
		{
			setTimeout(() => {
				if(!this.props.fullscreen)
				{
					return;
				}
				this.animateScreenExpand();
			}, 500);
		}
		else if(this.props.fullscreen && !nextProps.fullscreen)
		{
			if(this.screenExpandInterval)
			{
				clearInterval(this.screenExpandInterval);
				this.screenExpandInterval = null;
			}
			this.setState({
				fullscreen: false,
				animating: false,
				offsetX: undefined,
				offsetY: undefined,
				scaleX: undefined,
				scaleY: undefined
			});
		}
	}

	render()
	{
		const style = {};

		if(this.state.fullscreen)
		{
			var rootRect = document.getElementById("root").getBoundingClientRect();

			var width = rootRect.width * this.state.scaleX;
			var height = rootRect.height * this.state.scaleY;

			var centerX = rootRect.left + (rootRect.width/2);
			var centerY = rootRect.top + (rootRect.height/2);

			if(this.state.animating)
			{
				style.left = (centerX - (width/2) + this.state.offsetX);
				style.top = (centerY - (height/2) + this.state.offsetY);
				style.width = width;
				style.height = height;
			}
			else
			{
				style.left = 0;
				style.top = 0;
				style.right = 0;
				style.bottom = 0;
			}
			style.position = 'fixed';
			style.animation = 'none';

			return (
				<div className="crt-container">
					<div className="crt">
						<img className="crt-bg" src="system/lib/transcend32.dll/CRT.jpg"/>
						<div className="crt-screen">
						</div>
					</div>
					<div className="crt-screen-content fullscreen" style={style}>
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
						<img className="crt-bg" src="system/lib/transcend32.dll/CRT.jpg"/>
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

module.exports = CRT;
