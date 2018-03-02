
requireCSS('./FileIconLayout.css');
const React = require('react');
const ReactDOM = require('react-dom');
const FileIcon = require('./FileIcon');

class FileIconLayout extends React.Component
{
	constructor(props)
	{
		if(!props.files)
		{
			props.files = [];
		}
		super(props);

		// set default state	
		this.state = {
			files: {},
			dragging: null,
			draggingFile: null,
			selectedFiles: []
		};

		this.onDocumentMouseMove = this.onDocumentMouseMove.bind(this);
		this.onDocumentMouseUp = this.onDocumentMouseUp.bind(this);
	}

	findFileIconDOMNodes()
	{
		var icons = {};
		var node = ReactDOM.findDOMNode(this);
		for(const childNode of node.childNodes)
		{
			if(childNode.classList && childNode.classList.contains('file'))
			{
				var filenameNode = childNode.querySelector('.filename');
				if(filenameNode != null)
				{
					var fileName = filenameNode.textContent;
					icons[fileName] = childNode;
				}
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
		for(const fileName of this.props.files)
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
		document.addEventListener('mousemove', this.onDocumentMouseMove);
		document.addEventListener('mouseup', this.onDocumentMouseUp);
	}

	componentWillUnmount()
	{
		// reset state
		this.setState({dragging: null, draggingFile: null, selectedFiles: []});

		// remove mouse event listeners	
		document.removeEventListener('mousemove', this.onDocumentMouseMove);
		document.removeEventListener('mouseup', this.onDocumentMouseUp);
	}

	onMouseDown(event)
	{
		if(this.state.selectedFiles.length > 0)
		{
			this.setState({selectedFiles: []});
		}
	}

	onFileMouseDown(filename, event)
	{
		if(event.button == 0)
		{
			if(!this.state.dragging)
			{
				event.stopPropagation();
				this.setState({dragging: 'file', draggingFile: filename, selectedFiles: [filename]});
			}
		}
	}

	onFileDoubleClick(filename, event)
	{
		if(this.props.onFileOpen)
		{
			this.props.onFileOpen(filename);
		}
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
					var draggingFile = this.state.draggingFile;
					var fileStates = Object.assign({}, this.state.files);
					
					var node = ReactDOM.findDOMNode(this);
					var fileNode = this.findFileIconDOMNodes()[draggingFile];
					if(node != null && fileNode != null)
					{
						// shift icon back into visible space
						var fileState = fileStates[draggingFile];
						var nodeRect = node.getBoundingClientRect();
						var fileNodeRect = fileNode.getBoundingClientRect();

						if(fileNodeRect.left < nodeRect.left)
						{
							fileState.position.x += (nodeRect.left - fileNodeRect.left);
						}
						else if(fileNodeRect.right > nodeRect.right)
						{
							fileState.position.x -= (fileNodeRect.right - nodeRect.right);
						}
						if(fileNodeRect.top < nodeRect.top)
						{
							fileState.position.y += (nodeRect.top - fileNodeRect.top);
						}
						else if(fileNodeRect.bottom > nodeRect.bottom)
						{
							fileState.position.y -= (fileNodeRect.bottom - nodeRect.bottom);
						}

						fileStates[draggingFile] = fileState;
					}

					this.setState({dragging: null, draggingFile: null, files: fileStates});
					break;
			}
		}
	}

	render()
	{
		return (
			<div className="icon-grid" onMouseDown={(event) => {this.onMouseDown(event)}}>
				{this.props.files.map((fileName) => this.renderFile(fileName))}
			</div>
		);
	}

	renderFile(fileName)
	{
		var fileState = this.state.files[fileName];
		var selected = (this.state.selectedFiles.includes(fileName));
		return (
			<FileIcon
				key={fileName}
				fileName={fileName}
				position={fileState.position}
				selected={selected}
				onMouseDown={(event) => {this.onFileMouseDown(fileName, event)}}
				onDoubleClick={(event) => {this.onFileDoubleClick(fileName, event)}}/>
		);
	}
}

module.exports = FileIconLayout;
