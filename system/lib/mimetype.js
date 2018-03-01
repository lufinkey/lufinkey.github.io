
const fs = require('fs');
const path = require('path');

function determine(filename)
{
	var fileContent = fs.readFileSync(filename, {encoding:'utf8'});
	var fileSig = fileContent.slice(0, 4);
	var fileHexSig = null;
	if(fileSig.length === 4)
	{
		fileHexSig = "";
		for(var i=0; i<fileSig.length; i++)
		{
			var byte = fileSig.charCodeAt(i);
			var hexByte = ('0' + (byte & 0xFF).toString(16)).slice(-2);
			fileHexSig += hexByte;
		}
	}

	var fileExt = path.extname(filename);
	if(fileExt.startsWith('.'))
	{
		fileExt = fileExt.slice(1, fileExt.length);
	}
	var magic = JSON.parse(fs.readFileSync('/system/share/magic.json', {encoding:'utf8'}));
	
	var mimeType = null;
	if(fileExt !== '')
	{
		mimeType = magic.extensions[fileExt];
	}
	if(mimeType == null && fileHexSig != null)
	{
		mimeType = magic.signatures[fileHexSig];
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
