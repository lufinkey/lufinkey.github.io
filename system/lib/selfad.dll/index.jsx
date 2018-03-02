
requireCSS('./style.scss');
const React = require('react');

class SelfAd extends React.Component
{
	render()
	{
		return (
			<div className="selfad">
				<div className="tearing-text" data-name="LUIS FINKE">Luis Finke</div>
			</div>
		);
	}
}

module.exports = SelfAd;
