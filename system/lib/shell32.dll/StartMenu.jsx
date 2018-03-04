
requireCSS('./StartMenu.css');
const React = require('react');



class StartMenu extends React.Component
{
	render()
	{
		const style = {};
		if(this.props.opened)
		{
			style.display = 'block';
		}
		else
		{
			style.display = 'none';
		}

		return (
			<div className="start-menu" style={style}>
				<div className="left-banner">
					<div className="vertical-text">
						Finke<span className="osWhite">OS</span>
					</div>
				</div>
				<ul className="items">
					<li>Terminal</li>
					<li>About Me</li>
					<li>Run</li>
					<li className="divider"></li>
					<li>Shut Down</li>
				</ul>
			</div>
		)
	}
}



module.exports = StartMenu;
