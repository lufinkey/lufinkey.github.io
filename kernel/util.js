
const deepCopyObject = (object) => {
	switch(typeof object) {
		case 'object':
			if(object === null) {
				return null;
			}
			else if(object instanceof Array) {
				var newObject = object.slice(0);
				for(var i=0; i<newObject.length; i++) {
					newObject[i] = deepCopyObject(newObject[i]);
				}
				return newObject;
			}
			else {
				var newObject = {};
				for(const key of Object.keys(object))
				{
					newObject[key] = deepCopyObject(object[key]);
				}
				return newObject;
			}

		case 'number':
			return 0+object;

		case 'string':
			return ''+object;
		
		default:
			return object;
	}
};



// check if a given path is a folder
const checkIfDir = (context, path) => {
	try {
		var stats = context.kernelModules.require('fs').statSync(path);
		if(stats.isDirectory()) {
			return true;
		}
	}
	catch(error) {}
	return false;
};


// check if a given path is a file
const checkIfFile = (context, path) => {
	try {
		var stats = context.kernelModules.require('fs').statSync(path);
		if(stats.isFile()) {
			return true;
		}
	}
	catch(error) {}
	return false;
}



const resolveRelativePath = (context, path, cwd) => {
	if(typeof path !== 'string') {
		throw new TypeError("path must be a string");
	}
	
	if(!cwd) {
		cwd = context.cwd;
		if(!cwd) {
			cwd = '/';
		}
	}
	else if(typeof cwd !== 'string') {
		throw new TypeError("cwd must be a string");
	}

	// return normalized path if it's absolute
	if(path.startsWith('/')) {
		return context.kernelModules.require('path').normalize(path);
	}

	// concatenate path with cwd
	return context.kernelModules.require('path').join(cwd, path);
};



// make the path leading up to the given file
const makeLeadingDirs = (context, path) => {
	const fs = context.kernelModules.require('fs');
	// resolve path
	path = resolveRelativePath(context, path);
	// split and remove empty path parts
	var pathParts = path.split('/');
	for(var i=0; i<pathParts.length; i++) {
		if(pathParts[i]=='') {
			pathParts.splice(i, 1);
			i--;
		}
	}
	
	// make sure each leading path part exists and is a directory
	for(var i=0; i<(pathParts.length-1); i++) {
		var leadingPath = '/'+pathParts.slice(0, i+1).join('/');
		// ensure path is a directory or doesn't exist
		try {
			var stats = fs.statSync(leadingPath);
			if(stats.isDirectory()) {
				continue;
			}
			else {
				fs.unlinkSync(leadingPath);
			}
		}
		catch(error) {}
		// create the directory
		fs.mkdirSync(leadingPath);
	}
}



module.exports = {
	deepCopyObject,
	checkIfFile,
	checkIfDir,
	resolveRelativePath,
	makeLeadingDirs
};
