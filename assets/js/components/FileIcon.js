
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
