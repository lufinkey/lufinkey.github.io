
const path = require('path');

function determine(filename)
{
	var fileSig = syscall('filesystem.readFileSig', filename);
	var fileExt = path.extname(filename);
	if(fileExt.startsWith('.'))
	{
		fileExt = fileExt.slice(1, fileExt.length);
	}
	var magic = JSON.parse(syscall('filesystem.readFile', '/system/share/magic.json'));
	
	var mimeType = null;
	if(fileExt !== '')
	{
		mimeType = magic.extensions[fileExt];
	}
	if(mimeType == null && fileSig != null)
	{
		mimeType = magic.signatures[fileSig];
	}
	if(mimeType == null && fileExt === '')
	{
		mimeType = magic.extensions[fileExt];
	}

	if(mimeType === undefined)
	{
		mimeType = null;
	}

	return mimeType;
}

const MimeType = {};
MimeType.determine = determine;
module.exports = MimeType;
