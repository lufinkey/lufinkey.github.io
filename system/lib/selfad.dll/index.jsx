
requireCSS('./style.scss');
const React = require('react');

const nameLayers = 20;
const nameLayerOffset = 2;
const nameTop = 60;
const name = "LUIS FINKE"; // you know, in case my name changes

class SelfAd extends React.Component
{
	constructor(props)
	{
		super(props);

		this.state = {
			nameVisible: false,
			nameTearing: false,
			nameAnimation: null
		};
	}

	componentDidMount()
	{
		requireCSS.wait(() => {
			setTimeout(() => {
				this.animateNameIntro();
			}, 1200);
		});
	}

	animateNameIntro()
	{
		let timeMillis = 0;
		var stretchTime = 2000;
		var totalTime = 2400;

		const animationInterval = setInterval(() => {
			timeMillis += 33;

			var layerCount = null;
			var regressing = false;
			var tearing = false;
			var glowAmount = 0;
			if(timeMillis < stretchTime)
			{
				if(timeMillis < (stretchTime/2))
				{
					var progress = (timeMillis / (stretchTime/2));
					layerCount = Math.floor(progress / (1.0/nameLayers));
				}
				else
				{
					regressing = true;
					var progress = 1-((timeMillis-(stretchTime/2))/(stretchTime/2));
					layerCount = Math.floor(progress / (1.0/nameLayers));
				}
			}
			else if(timeMillis < totalTime)
			{
				layerCount = 1;
				regressing = true;
				tearing = true;
				var glowMillis = timeMillis - stretchTime;
				var glowTotalTime = totalTime - stretchTime;
				if(glowMillis < (glowTotalTime/2))
				{
					glowAmount = glowMillis/(glowTotalTime/2);
				}
				else
				{
					glowAmount = 1-((glowMillis-(glowTotalTime/2))/(glowTotalTime/2));
				}
			}
			else
			{
				this.setState({
					nameTearing: true,
					nameVisible: true,
					nameAnimation: null
				});
				clearInterval(animationInterval);
				return;
			}

			this.setState({
				nameTearing: tearing,
				nameVisible: true,
				nameAnimation: {
					regressing: regressing,
					layerCount: layerCount,
					progress: (timeMillis / (totalTime/2)),
					glowAmount: glowAmount
				}
			});
		}, 33);
	}

	render()
	{
		if(!requireCSS.ready() || !this.state.nameVisible)
		{
			return null;
		}

		var classNames = ["name-banner"];
		if(this.state.nameTearing)
		{
			classNames.push('tearing-text');
		}

		if(this.state.nameAnimation)
		{
			var layers = [];
			var allLayerStyle = {};
			for(var i=0; i<this.state.nameAnimation.layerCount; i++)
			{
				var offsetY = null;
				var scale = null;
				if(this.state.nameAnimation.regressing)
				{
					offsetY = nameTop+(i*nameLayerOffset);
					scale = (nameLayers-i)/nameLayers;
				}
				else
				{
					offsetY = nameTop+((nameLayers-i)*nameLayerOffset);
					scale = i/nameLayers;
				}
				layers.push({
					top: offsetY,
					transform: 'scale('+scale+')'
				});
			}
			if(this.state.nameAnimation.glowAmount > 0)
			{
				var glowAmount = this.state.nameAnimation.glowAmount;
				allLayerStyle.textShadow = "0 0 "+Math.floor(glowAmount*40)+"px white";
			}
			return (
				<div className="selfad">
					{ layers.map((layerStyle, index) => (
						<div key={"nameLayer"+index} className={classNames.join(' ')} style={Object.assign(layerStyle, allLayerStyle)} data-name={name}>{name}</div>
					)) }
				</div>
			);
		}
		else
		{
			return (
				<div className="selfad">
					<div className={classNames.join(' ')} style={{top:nameTop}} data-name={name}>{name}</div>
				</div>
			);
		}
	}
}

module.exports = SelfAd;
