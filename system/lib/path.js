
function basename(path, ext)
{
	var baseName = syscall('filesystem.basename', path);
	if(ext)
	{
		if(baseName.endsWith(ext))
		{
			baseName = baseName.slice(0, baseName.length-ext.length);
		}
	}
	return baseName;
}

function delimiter()
{
	return ':';
}

function dirname(path)
{
	return syscall('filesystem.dirname', path);
}

function extname(path)
{
	return syscall('filesystem.extname', path);
}

// TODO format

function isAbsolute(path)
{
	if(typeof path !== 'string')
	{
		throw new TypeError("path must be a string");
	}
	if(path.startsWith('/'))
	{
		return true;
	}
	return false;
}

// TODO join

// TODO normalize

// TODO parse

// TODO relative

// TODO resolve

function sep()
{
	return '/';
}


const Path = {};
Object.defineProperty(Path, 'dirname', {value: dirname, writable: false});
Object.defineProperty(Path, 'delimiter', {get: delimiter});
Object.defineProperty(Path, 'dirname', {value: dirname, writable: false});
Object.defineProperty(Path, 'extname', {value: extname, writable: false});
Object.defineProperty(Path, 'isAbsolute', {value: isAbsolute, writable: false});
Object.defineProperty(Path, 'sep', {get: sep});
module.exports = Path;
