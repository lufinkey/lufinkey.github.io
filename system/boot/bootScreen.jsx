
const SystemUI = require('sysui');
const React = require('react');
const DefaultBootScreen = require('./screens/DefaultBootScreen');


class BootScreen extends React.Component
{
	render() {
		return (
			<DefaultBootScreen/>
		)
	}
};


SystemUI.register('boot', BootScreen);

process.stdin.on('end', () => {
	SystemUI.unregister('boot');
	process.exit(0);
});
