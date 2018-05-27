
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
				<img className="me-img" src="/system/apps/aboutme.exe/me.jpg"/>
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


				<div className="personal-projects">
					<h2>Personal Projects</h2>

					<hr/>

					<ul className="projects">

						<li className="browser-command">
							<h3><a href="https://github.com/lufinkey/BrowserCommand" target="_blank">Browser Command</a></h3>

							<p>
								Browser Command is a node module / CLI to facilitate control of web browsers externally. It uses a
								web socket server as a medium to allow a browser extension to send messages to a running nodejs instance.
							</p>
						</li>

						<li className="react-native-spotify">
							<h3><a href="https://github.com/lufinkey/react-native-spotify" target="_blank">React Native Spotify</a></h3>
							
							<p>
								This is a module for React Native to allow cross platform mobile development with the Spotify SDK. It is
								essentially a javascript wrapper around the native SDKs provided by Spotify. While working on this project,
								I also found the <i>events</i> functionality in react native somewhat lacking, so I also made
								a <a href="https://github.com/lufinkey/react-native-events" target="_blank">dependency module for event handling</a>.
								This Spotify module is currently being used by multiple live apps.
							</p>
						</li>

					</ul>

				</div>


				<div className="work-experience">
					<h2>Work Experience</h2>

					<hr/>

					<ul className="companies">

						<li className="wehavebecomevikings">
							<h3><a href="https://wehavebecomevikings.com" target="_blank">We Have Become Vikings</a></h3>
							
							<ul className="projects">

								<li className="guitarwars">
									<h4>Guitar Wars</h4>
									<div className="experience-timespan" target="_blank">June 2014 - August 2014</div>
									<p>
										Guitar Wars was a video game / interactive display for the storefront of We Have Become Vikings,
										a design and print shop located in downtown Cincinnati. Using the Xbox Kinect, someone standing in
										front of the display could shred on an air guitar to fight oncoming hoards of aliens.
									</p>
								</li>
							
							</ul>
						</li>


						<li className="lamproslabs">
							<h3><a href="http://lamproslabs.com" target="_blank">Lampros Labs</a></h3>
							<p>
								Lampros Labs is a software development service bureau that makes apps, websites
								and more for businesses from the Cincinnati and Greater Cincinnati region.
							</p>

							<ul className="projects">

								<li className="rosiereds">
									<h4><a href="https://rosiereds.org" target="_blank">RosieReds.org</a></h4>
									<div className="experience-timespan">November 2015 - March 2016</div>
									<p>
										The Rosie Reds needed a website to manage membership signups, display upcoming events, and
										show general information about the organization. I worked mainly on the backend code for signing up and
										managing memberships.
									</p>
								</li>

								<li className="dpaa">
									<h4><a href="http://daytonperformingarts.org" target="_blank">Dayton Performing Arts Association</a></h4>
									<div className="experience-timespan">February 2015 - November 2016</div>
									<p>
										I worked on backend code for the existing DPAA website to manage submissions for their "Guitar Heroes"
										competition.
									</p>
								</li>

							</ul>
						</li>


						<li className="valentineresearch">
							<h3><a href="http://www.valentine1.com" target="_blank">Valentine Research Inc.</a></h3>
							<ul className="projects">

								<li className="v1connection">
									<h4>V1Connection, The App</h4>
									<div className="experience-timespan">May 2016 - May 2017</div>
									<p>
										This iOS app used a custom protocol over bluetooth to communicate with the ValentineOne radar detector.
										Using the app, you could set custom frequency sweeps, get alerted of incoming radar alerts, and view radar
										frequencies on a spectrum.
									</p>
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
