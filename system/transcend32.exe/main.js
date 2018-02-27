
const React = require('react');
const CRT = require('./CRT');

class Transcend32 extends React.Component
{
	render()
	{
		return (
			<CRT>
				{this.props.children}
			</CRT>
		);
	}
}

module.exports = Transcend32;
