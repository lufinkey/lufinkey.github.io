
const React = require('react');
const ReactDOM = require('react-dom');
const Display = require('displaymgrclient');
const SelfAd = require('selfad');
const Desktop = require('./Desktop');
requireCSS('./style.css');

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

Display.addComponent('shell32', Shell32);
