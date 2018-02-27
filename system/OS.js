
const React = require('react');
const Transcend32 = require('./lib/transcend32.dll/index');
const Shell32 = require('./lib/shell32.dll/index');

class OS extends React.Component
{
	render()
	{
		console.log("OS: rendering...");
		return (
			<Transcend32>
				<Shell32/>
			</Transcend32>
		);
	}
}

module.exports = OS;
