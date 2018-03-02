
const path = require('path');
const React = require('react');

class FileIcon extends React.Component
{
	render()
	{
		var classNames = [ "file" ];
		if(this.props.fileName)
		{
			var fileType = path.extname(this.props.fileName);
			if(fileType.startsWith('.'))
			{
				fileType = fileType.substring(1, fileType.length);
			}
			classNames.push("file-"+fileType);
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
			<div className={classNames.join(' ')} style={styles} onMouseDown={this.props.onMouseDown} onDoubleClick={this.props.onDoubleClick}>
				<div className="icon"><div className="ghost"></div></div>
				<div className="filename">{this.props.fileName}</div>
			</div>
		);
	}
}

module.exports = FileIcon;
