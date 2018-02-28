
let Transcend32 = null;
let Shell32 = null;
let osComponent = null;
let logs = [];

function bootlog(message, options)
{
	logs.push({message: message, options: Object.assign({}, options)});
	syscall('log', message, options);
	if(osComponent != null)
	{
		osComponent.forceUpdate();
	}
}


bootlog('boot sequence started');

bootlog('loading react...');
const React = require('react');
const ReactDOM = require('react-dom');
bootlog('react loaded');



function FilePlaceholder() {}

function downloadFiles(structure, path=null)
{
	var promises = [];
	for(let entryName in structure)
	{
		let entry = structure[entryName];

		let entryPath = null;
		if(path == null)
		{
			entryPath = entryName;
		}
		else
		{
			entryPath = path+'/'+entryName;
		}

		try
		{
			if(entry instanceof FilePlaceholder)
			{
				promises.push(syscall('filesystem.downloadFile', entryPath+'?v='+(Math.random()*9999999999), '/'+entryPath));
			}
			else
			{
				syscall('filesystem.createDir', '/'+entryPath, {ignoreIfExists: true});
				promises = promises.concat( downloadFiles(entry, entryPath) );
			}
		}
		catch(error)
		{
			promises.push(Promise.reject(error));
		}
	}
	return Promise.all(promises);
}



function downloadFilesSlowly(structure, path=null)
{
	const structKeys = Object.keys(structure);
	if(structKeys.length === 0)
	{
		return Promise.resolve();
	}

	// get current entry
	const entryName = structKeys[0];
	const entry = structure[entryName];
	let entryPath = null;
	if(path == null)
	{
		entryPath = entryName;
	}
	else
	{
		entryPath = path+'/'+entryName;
	}

	// get next structure to parse
	const nextStructure = Object.assign({}, structure);
	delete nextStructure[entryName];

	return new Promise((resolve, reject) => {
		if(entry instanceof FilePlaceholder)
		{
			// download file
			bootlog("downloading /"+entryPath);
			syscall('filesystem.downloadFile', entryPath+'?v='+(Math.random()*9999999999), '/'+entryPath).then(() => {
				bootlog("downloaded /"+entryPath);
				// wait a bit
				setTimeout(() => {
					// load next file in structure
					downloadFilesSlowly(nextStructure, path).then(resolve).catch(reject);
				}, 100);
			}).catch((error) => {
				bootlog("failed to download /"+entryPath, {color: 'red'});
				bootlog(error.toString(), {color: 'red'});
				reject(error);
			});
		}
		else
		{
			// create directory
			try
			{
				syscall('filesystem.createDir', '/'+entryPath, {ignoreIfExists: true});
			}
			catch(error)
			{
				bootlog("failed to create directory /"+entryPath, {color: 'red'});
				bootlog(error.toString(), {color: 'red'});
				reject(error);
				return;
			}
			// fetch remote files in folder
			downloadFilesSlowly(entry, entryPath).then(() => {
				// load next file in structure
				downloadFilesSlowly(nextStructure, path).then(resolve).catch(reject);
			}).catch(reject);
		}
	});
}


const transcendFiles =  {
	'system': {
		'lib': {
			'transcend32.dll': {
				'CRT.js': new FilePlaceholder(),
				'index.js': new FilePlaceholder(),
				'package.json': new FilePlaceholder()
			}
		}
	}
};

const systemFiles = {
	'apps': {
		'textedit.exe': {
			'index.js': new FilePlaceholder(),
			'package.json': new FilePlaceholder()
		}
	},
	'system': {
		'bin': {
			'open.js': new FilePlaceholder()
		},
		'lib': {
			'dwm.dll': {
				'Window.js': new FilePlaceholder(),
				'WindowManager.js': new FilePlaceholder(),
				'style.css': new FilePlaceholder(),
				'index.js': new FilePlaceholder(),
				'package.json': new FilePlaceholder()
			},
			'shell32.dll': {
				'Desktop.js': new FilePlaceholder(),
				'FileIcon.js': new FilePlaceholder(),
				'FileIconLayout.js': new FilePlaceholder(),
				'TaskBar.js': new FilePlaceholder(),
				'TaskBarWindowButton.js': new FilePlaceholder(),
				'Wallpaper.js': new FilePlaceholder(),
				'index.js': new FilePlaceholder(),
				'package.json': new FilePlaceholder()
			},
			'path.js': new FilePlaceholder()
		},
		'share': {
			'appdefaults.json': new FilePlaceholder()
		}
	}
};

const homeFiles = {
	'home': {
		'Desktop': {
			'ayylmao.txt': new FilePlaceholder()
		}
	}
}



bootlog("downloading base system...");

let bootSequence = 0;


// download transcend32.exe
bootlog("downloading transcend32.dll");
downloadFiles(transcendFiles).then(() => {
	bootlog("downloaded transcend32.dll");
	Transcend32 = require('transcend32');
	bootSequence++;
	if(osComponent)
	{
		osComponent.forceUpdate();
	}
}).catch((error) => {
	bootlog("failed to download transcend32.dll", {color: 'red'});
	bootlog(error.toString(), {color: 'red'});
});



class OS extends React.Component
{
	constructor(props)
	{
		super(props);
	}

	componentDidMount()
	{
		osComponent = this;
	}

	componentDidUpdate()
	{
		var osElement = ReactDOM.findDOMNode(this);
		if(osElement != null)
		{
			var bootlogElement = osElement.querySelector('.bootlog');
			if(bootlogElement != null)
			{
				bootlogElement.scrollTop = bootlogElement.scrollHeight;
			}
		}
	}

	componentWillUnmount()
	{
		osComponent = null;
	}

	onScreenTurnOn()
	{
		let bootWaitInterval = setInterval(() => {
			// wait for transcend32.dll to download
			if(bootSequence < 1)
			{
				return;
			}
			clearInterval(bootWaitInterval);

			// start actual boot sequence
			this.boot();

		}, 200);
	}

	boot()
	{
		return new Promise((resolve, reject) => {
			// download system files
			bootlog("downloading system files");
			downloadFilesSlowly(systemFiles).then(() => {
				bootlog("finished downloading system files");
				Shell32 = require('shell32');
				bootSequence++; //2
				this.forceUpdate();

				// build user home
				bootlog("building user home directory");
				downloadFilesSlowly(homeFiles).then(() => {
					bootlog("finished building user home directory");
					bootSequence++; //3
					this.forceUpdate();

					//wait a bit
					setTimeout(() => {
						// finish "boot" sequence
						bootSequence++; //4
						this.forceUpdate();
					}, 2000);
				}).catch((error) => {
					bootlog("failed to build user home directory", {color: 'red'});
				});
			}).catch((error) => {
				console.error(error);
				bootlog("failed to download system files", {color: 'red'});
			});
		});
	}

	render()
	{
		switch(bootSequence)
		{
			case 0:
				return null;

			case 1:
			case 2:
			case 3:
				return (
					<Transcend32 onScreenTurnOn={() => {this.onScreenTurnOn()}}>
						{this.renderLogs()}
					</Transcend32>
				);

			default:
				return (
					<Transcend32 fullscreen={true}>
						<Shell32/>
					</Transcend32>
				);
		}
	}

	renderLogs()
	{
		return (
			<div className="bootlog">
				<pre>{`
 88888888b oo          dP                 .88888.  .d88888b  
 88                    88                d8'   \`8b 88.    "' 
a88aaaa    dP 88d888b. 88  .dP  .d8888b. 88     88 \`Y88888b. 
 88        88 88'  \`88 88888"   88ooood8 88     88       \`8b 
 88        88 88    88 88  \`8b. 88.  ... Y8.   .8P d8'   .8P 
 dP        dP dP    dP dP   \`YP \`88888P'  \`8888P'   Y88888P
				`}</pre>
				{logs.map((log, index) => (
					<div key={index} className="bootlog-line" style={{color: log.options.color}}>
						{log.message}
					</div>
				))}
			</div>
		);
	}
};


// render the DOM
ReactDOM.render(
	<OS/>,
	document.getElementById('root')
);
