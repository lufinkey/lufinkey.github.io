
const React = require('react');
const ReactDOM = require('react-dom');
const OS = require('./OS');

// render the DOM
ReactDOM.render(
	React.createElement(OS),
	document.getElementById('root')
);
