
const SystemUI = require('sysui');
const React = require('react');
const DefaultBootScreen = require('./screens/DefaultBootScreen');

const startupAudio = new Audio('system/boot/audio/startup.mp3');


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
	startupAudio.play();
	process.exit(0);
});
