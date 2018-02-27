
const React = require('react');
const Transcend32 = require('./transcend32.exe/main');
const Shell32 = require('./shell32.exe/main');

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
		return null;
	}
}

module.exports = OS;
