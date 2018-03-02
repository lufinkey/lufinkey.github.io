
requireCSS('./style.css');
const React = require('react');
const CRT = require('./CRT');

class Transcend32 extends React.Component
{
	render()
	{
		return (
			<CRT onScreenTurnOn={this.props.onScreenTurnOn} fullscreen={this.props.fullscreen}>
				{this.props.children}
			</CRT>
		);
	}
}

module.exports = Transcend32;
