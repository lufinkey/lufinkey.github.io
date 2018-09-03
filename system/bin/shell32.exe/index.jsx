
const React = require('react');
const SelfAd = require('selfad');
const Desktop = require('./Desktop');
requireCSS('./style.css');

const display = process.env['display'];
if(!display) {
	console.error("no display environment variable");
	process.exit(1);
}

class Shell32 extends React.Component
{
	render() {
		return (
			<div className="shell32">
				<Desktop/>
				<SelfAd/>
			</div>
		);
	}
}

display.addComponent('shell32', Shell32);
