
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
				<hr/>
				<img className="me-img" src="/apps/aboutme.exe/me.jpg"/>
				<div className="info">
					<span className="major">Computer Science Major</span>
					<span className="school">University of Cincinnati</span>
					<span className="class-year">Class of 2019</span>
					<div className="links-formal">
						<a className="resume" href="var/resume.pdf" target="_blank">Resume</a>
						<a className="contact" href="mailto:luisfinke@gmail.com">Contact</a>
					</div>
					<div className="links-general">
						<a className="github" href="https://github.com/lufinkey" target="_blank"></a>
						<a className="twitter" href="https://twitter.com/lufinkey" target="_blank"></a>
						<a className="patreon" href="https://www.patreon.com/lufinkey" target="_blank"></a>
					</div>
				</div>
				<p className="introduction">
					I do things
				</p>
				<div className="work-experience">
					<h2>Work Experience</h2>
					<hr/>
					<ul className="companies">

						<li className="wehavebecomevikings">
							<h3>We Have Become Vikings</h3>
							<ul className="projects">
								<li className="guitarwars">
									<h4>Guitar Wars</h4>
								</li>
							</ul>
						</li>

						<li className="lamproslabs">
							<h3>Lampros Labs</h3>
							<ul className="projects">
							</ul>
						</li>

						<li className="valentineresearch">
							<h3>Valentine Research Inc.</h3>
							<ul className="projects">
								<li className="v1connection">
									<h4>V1Connection, The App</h4>
								</li>
							</ul>
						</li>

					</ul>
				</div>
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
