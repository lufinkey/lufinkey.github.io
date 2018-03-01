
const FS = {};
module.exports = FS;




const constants = {
	COPYFILE_EXCL: 0b00000000000000000000000000000001
};

Object.defineProperty(FS, 'constants', {
	value: Object.assign({}, constants),
	writable: false
});




function appendFile(path, data, options, callback)
{
	if(typeof options === 'function')
	{
		callback = options;
		options = null;
	}
	if(typeof callback !== 'function')
	{
		throw new TypeError("callback function is required");
	}

	setTimeout(() => {
		try
		{
			appendFileSync(path, data, options);
		}
		catch(error)
		{
			callback(error);
			return;
		}
		callback(null);
	}, 0);
}

function appendFileSync(path, data, options)
{
	if(typeof data !== 'string')
	{
		throw new TypeError("data is required");
	}
	options = Object.assign({}, options);

	var fileData = syscall('filesystem.readFile', path);
	fileData += data;
	syscall('filesystem.writeFile', path, fileData);
}

FS.appendFile = appendFile;
FS.appendFileSync = appendFileSync;




function copyFile(src, dest, flags, callback)
{
	if(typeof flags === 'function')
	{
		callback = flags;
		flags = null;
	}
	if(typeof callback !== 'function')
	{
		throw new TypeError("callback function is required");
	}

	setTimeout(() => {
		try
		{
			copyFileSync(src, dest, flags);
		}
		catch(error)
		{
			callback(error);
			return;
		}
		callback(null);
	}, 0);
}

function copyFileSync(src, dest, flags)
{
	if(flags == null)
	{
		flags = 0;
	}
	if(typeof flags !== 'number')
	{
		throw new TypeError("flags must be a number");
	}

	var data = syscall('filesystem.readFile', src);
	if(syscall('filesystem.exists', dest))
	{
		if((flags & constants.COPYFILE_EXCL) === constants.COPYFILE_EXCL)
		{
			throw new Error("destination already exists");
		}
	}
	syscall('filesystem.writeFile', dest, data);
}

FS.copyFile = copyFile;
FS.copyFileSync = copyFileSync;




function exists(path, callback)
{
	if(typeof callback !== 'function')
	{
		throw new TypeError("callback function is required");
	}

	setTimeout(() => {
		callback(existsSync(path));
	});
}

function existsSync(path)
{
	try
	{
		return syscall('filesystem.exists', path);
	}
	catch(error)
	{
		return false;
	}
}

FS.exists = exists;
FS.existsSync = existsSync;




function mkdir(path, mode, callback)
{
	if(typeof mode === 'function')
	{
		callback = mode;
		mode = null;
	}
	if(typeof callback !== 'function')
	{
		throw new TypeError("callback function is required");
	}

	setTimeout(() => {
		try
		{
			mkdirSync(path, mode);
		}
		catch(error)
		{
			callback(error);
			return;
		}
		callback(null);
	}, 0);
}

function mkdirSync(path, mode)
{
	if(mode == null)
	{
		mode = 0o777;
	}
	syscall('filesystem.createDir', path);
}




function readdir(path, options, callback)
{
	if(typeof options === 'function')
	{
		callback = options;
		options = null;
	}
	if(typeof callback !== 'function')
	{
		throw new TypeError("callback function is required");
	}

	setTimeout(() => {
		let data = null;
		try
		{
			data = readdirSync(path, options);
		}
		catch(error)
		{
			callback(error, null);
			return;
		}
		callback(null, data);
	}, 0);
}

function readdirSync(path, options)
{
	options = Object.assign({}, options);
	return syscall('filesystem.readDir', path);
}

FS.readdir = readdir;
FS.readdirSync = readdirSync;




function readFile(path, options, callback)
{
	if(typeof options === 'function')
	{
		callback = options;
		options = null;
	}
	if(typeof callback !== 'function')
	{
		throw new TypeError("callback function is required");
	}

	setTimeout(() => {
		let data = null;
		try
		{
			data = readFileSync(path, options);
		}
		catch(error)
		{
			callback(error, null);
			return;
		}
		callback(null, data);
	}, 0);
}

function readFileSync(path, options)
{
	options = Object.assign({}, options);
	return syscall('filesystem.readFile', path);
}

FS.readFile = readFile;
FS.readFileSync = readFileSync;




function realpath(path, options, callback)
{
	if(typeof options === 'function')
	{
		callback = options;
		options = null;
	}
	if(typeof callback !== 'function')
	{
		throw new TypeError("callback function is required");
	}

	setTimeout(() => {
		let realPath = null;
		try
		{
			realPath = realpathSync(path, options);
		}
		catch(error)
		{
			callback(error, null);
			return;
		}
		callback(null, realPath);
	}, 0);
}

function realpathSync(path, options)
{
	options = Object.assign({}, options);
	return syscall('filesystem.resolvePath', path);
}

FS.realpath = realpath;
FS.realpathSync = realpathSync;




function rename(oldPath, newPath, callback)
{
	if(typeof callback !== 'function')
	{
		throw new TypeError("callback function is required");
	}

	setTimeout(() => {
		try
		{
			renameSync(oldPath, newPath);
		}
		catch(error)
		{
			callback(error);
			return;
		}
		callback(null);
	}, 0);
}

function renameSync(oldPath, newPath)
{
	return syscall('filesystem.rename', oldPath, newPath);
}

FS.rename = rename;
FS.renameSync = renameSync;




function rmdir(path, callback)
{
	if(typeof callback !== 'function')
	{
		throw new TypeError("callback function is required");
	}

	setTimeout(() => {
		try
		{
			rmdirSync(path);
		}
		catch(error)
		{
			callback(error);
			return;
		}
		callback(null);
	}, 0);
}

function rmdirSync(path)
{
	return syscall('filesystem.deleteDir', path);
}

FS.rmdir = rmdir;
FS.rmdirSync = rmdirSync;




function truncate(path, len, callback)
{
	if(typeof len === 'function')
	{
		callback = len;
		len = undefined;
	}
	if(typeof callback !== 'function')
	{
		throw new TypeError("callback function is required");
	}

	setTimeout(() => {
		try
		{
			truncateSync(path, len);
		}
		catch(error)
		{
			callback(error);
			return;
		}
		callback(null);
	}, 0);
}

function truncateSync(path, len)
{
	if(len == null)
	{
		len = 0;
	}
	if(typeof len !== 'number')
	{
		throw new TypeError("len must be a number");
	}

	var data = syscall('filesystem.readFile', path);
	if(data.length > len)
	{
		data = data.slice(0, len);
	}
	else if(data.length < len)
	{
		while(data.length < len)
		{
			data += '\0';
		}
	}
	syscall('filesystem.writeFile', path, data);
}

FS.truncate = truncate;
FS.truncateSync = truncateSync;




function unlink(path, callback)
{
	if(typeof callback !== 'function')
	{
		throw new TypeError("callback function is required");
	}

	setTimeout(() => {
		try
		{
			unlinkSync(path);
		}
		catch(error)
		{
			callback(error);
			return;
		}
		callback(null);
	}, 0);
}

function unlinkSync(path)
{
	syscall('filesystem.deleteFile', path);
}

FS.unlink = unlink;
FS.unlinkSync = unlinkSync;
