
const wallpapers = [
	{type: 'youtube', videoId: 'WmAoE-ZkoQs', audible: true},
	{type: 'image', url: 'http://pm1.narvii.com/6687/790510e62335d76e11324dbcff09cb777623df53_00.jpg' }
];

const files = {
	"pornography.txt": {type: 'txt'}
};



class Desktop extends React.Component
{
	render()
	{
		return (
			<div id={this.props.id} className="desktop">
				<div className="tv-effects">
					<div className="tv-scanlines"></div>
					<div className="tv-static-overlay"></div>
				</div>
				<FileLayout files={files}/>
				{this.renderRandomWallpaper()}
				<TaskBar/>
			</div>
		);
	}

	renderRandomWallpaper()
	{
		var index = Math.floor(Math.random()*wallpapers.length);
		return this.renderWallpaper(wallpapers[1]);
	}

	renderWallpaper(wallpaper)
	{
		switch(wallpaper.type)
		{
			case 'youtube':
				return this.renderYoutubeWallpaper(wallpaper);
			
			case 'image':
				return this.renderImageWallpaper(wallpaper);
		}
	}

	renderYoutubeWallpaper(wallpaper)
	{
		var videoSrc = "//www.youtube.com/embed/"+wallpaper.videoId+"?rel=0&autoplay=1&loop=1&showinfo=0&controls=0&modestbranding=1";
		var ghostVideoSrc = videoSrc + "&mute=1"
		if(!wallpaper.audible)
		{
			videoSrc += "&mute=1";
		}
		return (
			<div className="wallpaper-container">
				<iframe className="wallpaper" src={videoSrc} frameBorder={0} allowFullScreen={true}></iframe>
				<iframe className="wallpaper ghost" src={ghostVideoSrc} frameBorder={0} allowFullScreen={true}></iframe>
			</div>
		);
	}

	renderImageWallpaper(wallpaper)
	{
		return (
			<div className="wallpaper-container">
				<div className="wallpaper" style={{backgroundImage:"url("+wallpaper.url+")"}}></div>
				<div className="wallpaper ghost" style={{backgroundImage:"url("+wallpaper.url+")"}}></div>
			</div>
		);
	}
}



class TaskBar extends React.Component
{
	render()
	{
		return (
			<div className="taskbar">
				<button type="button" className="start-button">
					<span className="icon"><span className="ghost"></span></span> Start
				</button>
			</div>
		);
	}
}



class FileLayout extends React.Component
{
	constructor(props)
	{
		if(!props.files)
		{
			props.files = {};
		}
		super(props);

		// set default state	
		this.state = {
			files: {},
			dragging: null,
			draggingFile: null,
			selectedFile: null
		};

		this.onDocumentMouseDown = this.onDocumentMouseDown.bind(this);
		this.onDocumentMouseMove = this.onDocumentMouseMove.bind(this);
		this.onDocumentMouseUp = this.onDocumentMouseUp.bind(this);
	}

	findFileDOMNodes()
	{
		var icons = [];
		var node = React.findDOMNode(this);
		for(const childNode of node.childNodes)
		{
			if(childNode.classList && childNode.classList.contains('file'))
			{
				icons.push(node);
			}
		}
		return icons;
	}

	componentWillMount()
	{
		const maxCols = 5;
		var col = 0;
		var row = 0;

		// set default file states
		var fileStates = Object.assign({}, this.state.files);
		for(const fileName in this.props.files)
		{
			fileStates[fileName] = {position:{x:(col*72), y:(row*72)}};
			col++;
			if(col >= maxCols)
			{
				col = 0;
				row++;
			}
		}
		this.setState({files:fileStates});
	}

	componentDidMount()
	{
		// add mouse event listeners
		document.addEventListener('mousedown', this.onDocumentMouseDown);
		document.addEventListener('mousemove', this.onDocumentMouseMove);
		document.addEventListener('mouseup', this.onDocumentMouseUp);
	}

	componentWillUnmount()
	{
		// reset state
		this.setState({dragging: null, draggingFile: null, selectedFile: null});

		// remove mouse event listeners	
		document.removeEventListener('mousedown', this.onDocumentMouseDown);
		document.removeEventListener('mousemove', this.onDocumentMouseMove);
		document.removeEventListener('mouseup', this.onDocumentMouseUp);
	}

	onMouseDown(event)
	{
		if(this.state.selectedFile)
		{
			this.setState({selectedFile: null});
		}
	}

	onFileMouseDown(filename, event)
	{
		if(event.button == 0)
		{
			if(!this.state.dragging)
			{
				event.stopPropagation();
				this.setState({dragging: 'file', draggingFile: filename, selectedFile: filename});
			}
		}
	}

	onDocumentMouseDown(event)
	{
		//
	}

	onDocumentMouseMove(event)
	{
		switch(this.state.dragging)
		{
			case 'file':
				var draggingFile = this.state.draggingFile;
				var fileStates = Object.assign({}, this.state.files);
				var fileState = fileStates[draggingFile];

				fileState.position.x += event.movementX;
				fileState.position.y += event.movementY;

				fileStates[draggingFile] = fileState;
				this.setState({files: fileStates});
				break;
		}
	}

	onDocumentMouseUp(event)
	{
		if(event.button == 0)
		{
			switch(this.state.dragging)
			{
				case 'file':
					this.setState({dragging: null, draggingFile: null});
			}
		}
	}

	render()
	{
		return (
			<div className="icon-grid" onMouseDown={(event) => {this.onMouseDown(event)}}>
				{Object.keys(this.props.files).map((fileName) => this.renderFile(fileName, this.props.files[fileName]))}
			</div>
		);
	}

	renderFile(fileName, file)
	{
		let fileState = this.state.files[fileName];
		var selected = (this.state.selectedFile === fileName);
		return (
			<FileIcon key={fileName} fileName={fileName} fileType={file.type} position={fileState.position} selected={selected} onMouseDown={(event) => {this.onFileMouseDown(fileName, event)}}/>
		);
	}
}



class FileIcon extends React.Component
{
	render()
	{
		var classNames = [ "file" ];
		if(this.props.fileType)
		{
			classNames.push("file-"+this.props.fileType);
		}
		if(this.props.selected)
		{
			classNames.push("selected");
		}
		var position = Object.assign({x:0,y:0}, this.props.position);
		var styles = {
			left: position.x,
			top: position.y
		};
		return (
			<div className={classNames.join(' ')} style={styles} onMouseDown={this.props.onMouseDown}>
				<div className="icon"><div className="ghost"></div></div>
				<div className="filename">{this.props.fileName}</div>
			</div>
		);
	}
}
