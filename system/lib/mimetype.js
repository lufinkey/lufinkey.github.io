
const fs = require('fs');
const path = require('path');

module.exports = function(filename)
{
	// get file signature
	var fileContent = fs.readFileSync(filename, {encoding:'utf8'});
	var fileSig = fileContent.slice(0, 32);
	var fileHexSig = null;
	if(fileSig.length > 0)
	{
		fileHexSig = "";
		for(var i=0; i<fileSig.length; i++)
		{
			var byte = fileSig.charCodeAt(i);
			var hexByte = ('0' + (byte & 0xFF).toString(16)).slice(-2);
			fileHexSig += hexByte;
		}
	}
	// get file extension
	var fileExt = path.extname(filename);
	if(fileExt.startsWith('.'))
	{
		fileExt = fileExt.slice(1, fileExt.length);
	}

	// look for matching mime types
	let matches = [];
	var mimeTypes = JSON.parse(fs.readFileSync('/system/share/mimetypes.json', {encoding:'utf8'}));
	for(const mimeType in mimeTypes)
	{
		let mimeRules = mimeTypes[mimeType];
		var matchRank = 0;
		// check if file signature matches
		if(mimeRules.sig && fileHexSig)
		{
			var sigs = [];
			if(typeof mimeRules.sig === 'string')
			{
				sigs = [mimeRules.sig];
			}
			else if(mimeRules.sig instanceof Array)
			{
				sigs = mimeRules.sig;
			}
			for(const sig of sigs)
			{
				if(fileHexSig.startsWith(sig))
				{
					matchRank += 1;
					break;
				}
			}
		}
		// check if file extension matches
		if(mimeRules.ext && fileExt.length > 0)
		{
			var exts = [];
			if(typeof mimeRules.ext === 'string')
			{
				exts = [mimeRules.ext];
			}
			else if(mimeRules.ext instanceof Array)
			{
				exts = mimeRules.ext;
			}
			for(const ext of exts)
			{
				if(ext === fileExt)
				{
					matchRank += 2;
				}
			}
		}
		// add to list if matching
		if(matchRank > 0)
		{
			matches.push({
				type: mimeType,
				rank: matchRank
			});
		}
	}
	
	// look for highest ranked match
	if(matches.length === 0)
	{
		return null;
	}
	var topMatch = matches[0];
	for(var i=1; i<matches.length; i++)
	{
		var match = matches[i];
		if(match.rank > topMatch.rank)
		{
			topMatch = match;
		}
	}

	return topMatch.type;
}
