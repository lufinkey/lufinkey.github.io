
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



function RemoteFile(url)
{
	this.url = url;
}

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
			if(entry instanceof RemoteFile)
			{
				var url = entry.url;
				if(!url)
				{
					url = entryPath+'?v='+(Math.random()*9999999999);
				}
				promises.push(syscall('filesystem.downloadFile', url, '/'+entryPath));
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
		if(entry instanceof RemoteFile)
		{
			// get file URL
			var url = entry.url;
			if(!url)
			{
				url = entryPath+'?v='+(Math.random()*9999999999);
			}
			
			// download file
			bootlog("downloading /"+entryPath);
			syscall('filesystem.downloadFile', url, '/'+entryPath).then(() => {
				bootlog("downloaded /"+entryPath);
				// wait a bit
				setTimeout(() => {
					// load next file in structure
					downloadFilesSlowly(nextStructure, path).then(() => {
						resolve();
					}).catch((error) => {
						reject(error);
					});
				}, 100);
			}).catch((error) => {
				// error
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
				downloadFilesSlowly(nextStructure, path).then(() => {
					resolve();
				}).catch((error) => {
					reject(error);
				});
			}).catch((error) => {
				reject(error);
			});
		}
	});
}


const baseFiles =  {
	'system': {
		'boot.css': new RemoteFile(),
		'lib': {
			'transcend32.dll': {
				'style.css': new RemoteFile(),
				'CRT.jsx': new RemoteFile(),
				'index.jsx': new RemoteFile(),
				'package.json': new RemoteFile()
			}
		}
	}
};

const systemFiles = {
	'apps': {
		'textedit.exe': {
			'style.css': new RemoteFile(),
			'index.jsx': new RemoteFile(),
			'package.json': new RemoteFile()
		}
	},
	'system': {
		'bin': {
			'open.js': new RemoteFile()
		},
		'lib': {
			'dwm.dll': {
				'Window.jsx': new RemoteFile(),
				'style.css': new RemoteFile(),
				'index.jsx': new RemoteFile(),
				'package.json': new RemoteFile()
			},
			'shell32.dll': {
				'Desktop.css': new RemoteFile(),
				'Desktop.jsx': new RemoteFile(),
				'FileIcon.jsx': new RemoteFile(),
				'FileIconLayout.css': new RemoteFile(),
				'FileIconLayout.jsx': new RemoteFile(),
				'TaskBar.css': new RemoteFile(),
				'TaskBar.jsx': new RemoteFile(),
				'TaskBarWindowButton.jsx': new RemoteFile(),
				'Wallpaper.jsx': new RemoteFile(),
				'index.jsx': new RemoteFile(),
				'package.json': new RemoteFile()
			},
			'base64uri.js': new RemoteFile(),
			'child_process.js': new RemoteFile(),
			'events.js': new RemoteFile("https://raw.githubusercontent.com/Gozala/events/master/events.js"),
			'fs.js': new RemoteFile(),
			'mimetype.js': new RemoteFile(),
			'path.js': new RemoteFile()
		},
		'share': {
			'appdefaults.json': new RemoteFile(),
			'mimetypes.json': new RemoteFile()
		}
	}
};

const homeFiles = {
	'home': {
		'Desktop': {
			'ayylmao.txt': new RemoteFile()
		}
	}
}



bootlog("downloading base system...");

let bootSequence = 0;


// download transcend32.exe
bootlog("downloading transcend32.dll");
downloadFiles(baseFiles).then(() => {
	bootlog("downloaded transcend32.dll");
	requireCSS('./boot.css');
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
