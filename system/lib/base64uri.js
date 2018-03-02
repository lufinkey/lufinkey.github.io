
const fs = require('fs');
const MimeType = require('mimetype');

module.exports = function(filename)
{
	var mimeType = MimeType.determine(filename);
	if(mimeType == null)
	{
		throw new Error("unable to determine mime type");
	}
	var content = fs.readFileSync(filename, {encoding:'utf8'});
	return 'data:'+mimeType+';base64,'+btoa(content);
};
