
const React = require('react');
const ReactDOM = require('react-dom');
const Display = require('displaymgrclient');
const SelfAd = require('selfad');
const Desktop = require('./Desktop');
const { spawn } = require('child_process');
requireCSS('./style.css');

class Shell32 extends React.Component
{
	componentDidMount() {
		const element = ReactDOM.findDOMNode(this);
		// add click handler for links
		element.addEventListener('click', (event) => {
			const clickedElement = event.target;
			if(clickedElement.nodeName === 'A' && clickedElement.target === '_blank' && typeof clickedElement.href === 'string') {
				event.preventDefault();
				spawn('iframe', [ clickedElement.href ], {detached: true});
			}
		}, {capture: true});
	}

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
