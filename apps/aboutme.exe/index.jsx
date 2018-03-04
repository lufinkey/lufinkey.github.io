
requireCSS('./style.css');
const React = require('react');

var windowManager = process.env['WINDOW_MANAGER'];
if(!windowManager)
{
	console.error("no window manager detected");
	process.exit(1);
}

windowManager.createWindow().then((window) => {
	// window created
	
	// render the window
	window.renderContent = () => {
		return (
			<div className="aboutme">
				<h1>Luis Finke</h1>
				<img className="me-img" src="/apps/aboutme.exe/me.jpg"/>
				<div className="info">
					<span className="major">Computer Science Major</span>
					<span className="school">University of Cincinnati</span>
					<span className="class-year">Class of 2019</span>
				</div>
				<p className="introduction">
					I do things
				</p>
			</div>
		);
	};

	// handle close button
	window.onCloseButtonClick = () => {
		window.close();
		process.exit(0);
	};

	// set initial state
	window.setState({
		title: "aboutme.exe"
	});
}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
