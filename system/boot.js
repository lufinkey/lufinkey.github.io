
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

function downloadFiles(structure, path)
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

		if(entry instanceof FilePlaceholder)
		{
			promises.push(syscall('filesystem.downloadFile', entryPath, '/'+entryPath+'?v='+(Math.random()*9999999999)));
		}
		else
		{
			promises = promises.concat( downloadFiles(entry, entryPath) );
		}
	}
	return Promise.all(promises);
}


function downloadFileChunks(chunks, onChunk, onError)
{
	if(chunks.length == 0)
	{
		return;
	}
	var currentChunk = chunks[0];
	var nextChunks = chunks.slice(1);
	downloadFiles(currentChunk).then(() => {
		onChunk(currentChunk);
		setTimeout(() => {
			downloadFileChunks(nextChunks, onChunk, onError);
		}, 1000);
	}).catch((error) => {
		onError(error);
	});
}


const dataChunks = [
	{
		'system': {
			'lib': {
				'transcend32.dll': {
					'CRT.js': new FilePlaceholder(),
					'index.js': new FilePlaceholder()
				}
			}
		}
	},
	{
		'system': {
			'lib': {
				'shell32.dll': {
					'Desktop.js': new FilePlaceholder(),
					'FileIcon.js': new FilePlaceholder(),
					'FileIconLayout.js': new FilePlaceholder(),
					'index.js': new FilePlaceholder(),
					'TaskBar.js': new FilePlaceholder(),
					'TaskBarWindowButton.js': new FilePlaceholder(),
					'Wallpaper.js': new FilePlaceholder(),
					'Window.js': new FilePlaceholder(),
					'WindowManager.js': new FilePlaceholder()
				}
			}
		}
	}
];


bootlog("downloading base system...");

let chunkCount = 0;
bootlog("downloading data chunk 0...");
downloadFileChunks(dataChunks, (chunk) => {
	bootlog("chunk "+chunkCount+" downloaded");

	switch(chunkCount)
	{
		case 0:
			Transcend32 = require('./lib/transcend32.dll/index');
			break;

		case 1:
			Shell32 = require('./lib/shell32.dll/index');
			break;
	}

	chunkCount++;
	osComponent.forceUpdate();
	if(chunkCount < dataChunks.length)
	{
		bootlog("downloading data chunk "+chunkCount+"...");
	}
}, (error) => {
	bootlog("fatal error: unable to download chunk "+chunkCount);
	bootlog(error.toString());
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

	componentWillUnmount()
	{
		osComponent = null;
	}

	render()
	{
		switch(chunkCount)
		{
			case 0:
				return null;

			case 1:
				return (
					<Transcend32>
						{this.renderLogs()}
					</Transcend32>
				);

			default:
				return (
					<Transcend32>
						<Shell32/>
					</Transcend32>
				);
		}
	}

	renderLogs()
	{
		return (
			<div className="bootlog">
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
