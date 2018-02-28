
const MimeType = require('mimetype');

module.exports = (filename) => {
	var mimeType = MimeType.determine(filename);
	if(mimeType == null)
	{
		throw new Error("unable to determine mime type");
	}
	var content = syscall('filesystem.readFile', filename);
	return 'data:'+mimeType+';base64,'+btoa(content);
};
