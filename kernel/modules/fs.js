
const {
	makeAsyncPromise,
	validateContext
} = await krequire('kernel/process/thread.js');
const {
	validatePermission
} = await krequire('kernel/permissions.js');
const {
	resolveRelativePath
} = await krequire('kernel/util.js');


const fsPrefix = ''+(kernel.options.fsPrefix || '');
const inodePrefix = fsPrefix+'__inode:';
const entryPrefix = fsPrefix+'__entry:';


const tmpStorage = {};
let storage = await (async () => {
	const data = await kernel.download('https://raw.githubusercontent.com/jeremydurham/persist-js/master/persist-min.js');
	var scope = {
		Persist: null,
		global: {}
	};
	kernel.runScript(data, scope);
	const Persist = scope.Persist;
	Persist.remove('cookie');
	return new (function(){
		let store = new Persist.Store(kernel.osName);

		this.setItem = (key, value) => {
			store.set(key, value);
		};

		this.getItem = (key) => {
			return store.get(key);
		};

		this.removeItem = (key) => {
			store.remove(key);
		};
	});
})();

// ensure the root filesystem has been created
if(!storage.getItem(inodePrefix+'0')) {
	storage.setItem(inodePrefix+'0', JSON.stringify({type:'DIR',uid:0,gid:0,mode:0o754}));
	storage.setItem(entryPrefix+'0', JSON.stringify({}));
}



module.exports = (context) => {
	const FS = {};

	const { Buffer } = context.kernelModules.require('buffer');

	function callLambda(callback, ...args) {
		if(callback && context.valid) {
			callback(...args);
		}
	}


	// use inodes to handle creating filesystem entries
	// valid inode types: FILE, DIR, LINK, REMOTE

	//#region fs inode functions

	function createINode(type, info) {
		// validate type
		if(typeof type !== 'string') {
			throw new TypeError("inode type must be a string");
		}
		if(['FILE', 'DIR', 'LINK', 'REMOTE'].indexOf(type) === -1) {
			throw new Error("invalid inode type "+type);
		}
		// find available inode ID
		var id = 1;
		while(true) {
			var item = storage.getItem(inodePrefix+id);
			if(!item) {
				break;
			}
			id++;
		}
		// create inode
		info = Object.assign({uid: context.uid, gid: context.gid, mode: 0o777, encoding: 'utf8'}, info);
		var inode = {
			'type': type,
			'uid': info.uid,
			'gid': info.gid,
			'mode': info.mode,
			'encoding': info.encoding
		};
		if(!Number.isInteger(inode.uid) || inode.uid < 0) {
			throw new Error("invalid uid");
		}
		if(!Number.isInteger(inode.gid) || inode.gid < 0) {
			throw new Error("invalid gid");
		}
		if(!Number.isInteger(inode.mode) || inode.mode < 0 || inode.mode > 1023) {
			throw new Error("invalid mode");
		}
		// store inode
		storage.setItem(inodePrefix+id, JSON.stringify(inode));
		var data = '';
		switch(type) {
			case 'FILE':
			case 'LINK':
			case 'REMOTE':
				data = Buffer.from('', 'utf8');
				break;

			case 'DIR':
				data = {};
				break;
		}
		writeINodeContent(id, data, {noValidate: true});
		return id;
	}

	function getINode(id) {
		var inodeStr = storage.getItem(inodePrefix+id);
		if(!inodeStr) {
			throw new Error("cannot access nonexistant inode "+id);
		}
		return JSON.parse(inodeStr);
	}

	function updateINode(id, info) {
		if(info.type !== undefined) {
			throw new Error("cannot update inode type");
		}
		var inode = getINode(id);
		var type = inode.type;
		var newINode = Object.assign({}, inode);
		newINode = Object.assign(newINode, info);
		newINode = {
			'type': type,
			'uid': inode.uid,
			'gid': inode.gid,
			'mode': inode.mode,
			'encoding': inode.encoding
		};
		storage.setItem(inodePrefix+id, JSON.stringify(inode));
	}

	function destroyINode(id) {
		writeINodeContent(id, null, {noValidate: true});
		storage.removeItem(inodePrefix+id);
	}

	function doesINodeExist(id) {
		if(storage.getItem(inodePrefix+id)) {
			return true;
		}
		return false;
	}


	function readINodeContent(id, options) {
		options = Object.assign({}, options);

		var inode = getINode(id);
		if(!options.noValidate) {
			validatePermission(context, inode.uid, inode.gid, inode.mode, {r:true});
		}

		switch(inode.type) {
			case 'FILE':
				var content = storage.getItem(entryPrefix+id);
				if(content == null) {
					return null;
				}
				if(inode.encoding === options.encoding) {
					return content;
				}
				var buffer = Buffer.from(content, inode.encoding);
				if(options.encoding == null) {
					return buffer;
				}
				return buffer.toString(options.encoding);

			case 'DIR':
				var content = storage.getItem(entryPrefix+id);
				if(content == null) {
					return null;
				}
				return JSON.parse(content);

			case 'LINK':
				var content = storage.getItem(entryPrefix+id);
				if(content == null) {
					return null;
				}
				if(options.encoding == null) {
					return Buffer.from(content);
				}
				else if(options.encoding !== 'utf8') {
					return Buffer.from(content).toString(options.encoding);
				}
				return content;

			case 'REMOTE':
				return Buffer.from(tmpStorage[id]);

			default:
				throw new Error("invalid inode type");
		}
	}

	function writeINodeContent(id, content, options) {
		options = Object.assign({}, options);

		var inode = getINode(id);
		if(!options.noValidate) {
			validatePermission(context, inode.uid, inode.gid, inode.mode, {w:true});
		}

		switch(inode.type) {
			case 'FILE':
				if(content == null) {
					storage.removeItem(entryPrefix+id);
				}
				else {
					if(content instanceof Buffer) {
						if(inode.encoding !== 'base64') {
							updateINode(id, {encoding:'base64'});
						}
						storage.setItem(entryPrefix+id, content.toString('base64'));
					}
					else if(typeof content === 'string') {
						if(options.encoding) {
							if(options.encoding !== inode.encoding) {
								updateINode(id, {encoding: options.encoding});
							}
						}
						else if(inode.encoding !== 'utf8') {
							updateINode(id, {encoding:'utf8'});
						}
						storage.setItem(entryPrefix+id, content);
					}
					else {
						throw new Error("invalid content data");
					}
				}
				break;

			case 'DIR':
				if(content == null) {
					storage.removeItem(entryPrefix+id);
				}
				else {
					if(typeof content !== 'object') {
						throw new TypeError("inode dir content must be an object");
					}
					storage.setItem(entryPrefix+id, JSON.stringify(content));
				}
				break;

			case 'LINK':
				if(content == null) {
					storage.removeItem(entryPrefix+id);
				}
				else {
					var contentStr = content;
					if(content instanceof Buffer) {
						contentStr = content.toString();
					}
					else if(typeof contentStr !== 'string') {
						throw new TypeError("inode link content must be a string or a Buffer");
					}
					storage.setItem(entryPrefix+id, contentStr);
				}
				break;

			case 'REMOTE':
				if(content == null) {
					delete tmpStorage[id];
				}
				else {
					if(!(content instanceof Buffer)) {
						throw new TypeError("inode remote content must be a buffer");
					}
					tmpStorage[id] = Buffer.from(content);
				}
				break;

			default:
				throw new Error("invalid inode type");
		}
	}


	function validatePath(path) {
		if(path instanceof Buffer) {
			path = path.toString('utf8');
		}
		if(typeof path !== 'string') {
			throw new TypeError("path must be a string");
		}
		path = resolveRelativePath(context, path);
		if(!path.startsWith('/')) {
			throw new Error("internal inconsistency: resolved path is not absolute");
		}
		return path;
	}


	function findINode(path) {
		// validate path
		path = validatePath(path);
		// get all path parts
		var pathParts = path.split('/');
		// remove empty path parts
		for(var i=0; i<pathParts.length; i++) {
			if(pathParts[i] == '') {
				pathParts.splice(i, 1);
				i--;
			}
		}
		// traverse directories to find path
		var rootEntry = readINodeContent(0);
		var entry = rootEntry;
		var id = 0;
		var inode = getINode(id);
		for(var i=0; i<pathParts.length; i++) {
			var pathPart = pathParts[i];
			// make sure next part of path exists
			if(entry[pathPart] == null) {
				return null;
			}
			id = entry[pathPart];
			if(i<(pathParts.length-1)) {
				// read next directory
				validatePermission(context, inode.uid, inode.gid, inode.mode, {x:true});
				inode = getINode(id);
				// make sure the entry is a directory
				if(inode.type !== 'DIR') {
					throw new Error("part of path is not a directory");
				}
				entry = readINodeContent(id);
			}
			else {
				// don't read target inode
				inode = null;
				entry = null;
			}
		}
		return id;
	}


	const maxLinkCount = 40;
	function followINodeLink(id, linkCount=0) {
		var inode = getINode(id);
		if(inode.type != 'LINK') {
			return id;
		}
		if(linkCount == maxLinkCount) {
			throw new Error("maximum symbolic links exceeded");
		}
		var path = readINodeContent(id, {encoding:'utf8'});
		var nextId = findINode(path);
		if(nextId == null) {
			return null;
		}
		return followINodeLink(nextId, linkCount+1);
	}

	function findINodeFollowingLinks(path) {
		var id = findINode(path);
		if(id == null) {
			return null;
		}
		return followINodeLink(id, 0);
	}

	//#endregion


	//#region fs path entry functions

	function createPathEntry(path, type, info, options) {
		options = Object.assign({}, options);
		// validate path
		path = validatePath(path);

		// get info about parent directory
		var pathName = context.kernelModules.require('path').basename(path);
		var pathDir = context.kernelModules.require('path').dirname(path);
		var parentId = findINodeFollowingLinks(pathDir);
		if(parentId == null) {
			throw new Error("parent directory does not exist");
		}
		var parentINode = getINode(parentId);
		if(parentINode.type != 'DIR') {
			throw new Error("parent entry is not a directory");
		}
		var parentData = readINodeContent(parentId);

		// ensure path doesn't already exist
		if(parentData[pathName] != null) {
			if(options.onlyIfMissing) {
				return parentData[pathName];
			}
			throw new Error("entry already exists");
		}

		// validate write permissions
		validatePermission(context, parentINode.uid, parentINode.gid, parentINode.mode, {x:true, w: true});
		
		// add entry to parent dir
		var id = createINode(type, info);
		parentData[pathName] = id;
		try {
			writeINodeContent(parentId, parentData);
		}
		catch(error) {
			destroyINode(id);
			throw error;
		}

		// done
		return id;
	}


	function movePathEntry(oldPath, newPath) {
		// validate paths
		oldPath = validatePath(oldPath);
		newPath = validatePath(newPath);

		// get info about parent directory
		function getPathInfo(path) {
			var pathName = context.kernelModules.require('path').basename(path);
			var pathDir = context.kernelModules.require('path').dirname(path);
			var parentId = findINodeFollowingLinks(pathDir);
			if(parentId == null) {
				throw new Error("parent directory does not exist");
			}
			var parentINode = getINode(parentId);
			if(parentINode.type != 'DIR') {
				throw new Error("parent entry is not a directory");
			}
			validatePermission(context, parentINode.uid, parentINode.gid, parentINode.mode, {x:true,w:true});
			var parentData = readINodeContent(parentId);
			return {
				name: pathName,
				dirname: pathDir,
				parentId: parentId,
				parentINode: parentINode,
				parentData: parentData
			};
		}
		var oldInfo = getPathInfo(oldPath);
		var newInfo = getPathInfo(newPath);

		// move from old dir to new dir
		if(oldInfo.parentData[oldInfo.name] == null) {
			throw new Error("entry does not exist");
		}
		if(newInfo.parentData[newInfo.name] != null) {
			throw new Error("destination entry already exists");
		}
		var id = oldInfo.parentData[oldInfo.name];
		delete oldInfo.parentData[oldInfo.name];
		newInfo.parentData[newInfo.name] = id;
		
		// flush updated data
		writeINodeContent(oldInfo.parentId, oldInfo.parentData);
		writeINodeContent(newInfo.parentId, newInfo.parentData);
	}


	function destroyPathEntry(path) {
		// validate path
		path = validatePath(path);

		// get info about the parent directory
		var pathName = context.kernelModules.require('path').basename(path);
		var pathDir = context.kernelModules.require('path').dirname(path);
		var parentId = findINodeFollowingLinks(pathDir);
		if(parentId == null) {
			throw new Error("parent directory does not exist");
		}
		var parentINode = getINode(parentId);
		if(parentINode.type !== 'DIR') {
			throw new Error("parent entry is not a directory");
		}
		var parentData = readINodeContent(parentId);

		// validate write permissions
		validatePermission(context, parentINode.uid, parentINode.gid, parentINode.mode, {x:true,w:true});

		// ensure entry exists
		var id = parentData[pathName];
		if(id == null) {
			throw new Error("entry does not exist");
		}

		// remove entry from parent dir
		var inode = getINode(id);
		if(inode.type === 'DIR') {
			// make sure directory is empty
			var data = readINodeContent(id);
			if(Object.keys(data).length > 0) {
				throw new Error("directory is not empty");
			}
		}
		delete parentData[pathName];
		writeINodeContent(parentId, parentData);
		destroyINode(id);
	}

	//#endregion


	//#region fs public constants

	const constants = {
		COPYFILE_EXCL: 0b00000000000000000000000000000001,
		F_OK: 0,
		X_OK: 0x01,
		W_OK: 0x02,
		R_OK: 0x04
	};
	
	Object.defineProperty(FS, 'constants', {
		value: Object.assign({}, constants),
		writable: false
	});

	//#endregion

	//#region fs public types

	class Stats
	{
		constructor(id) {
			var inode = getINode(id);

			Object.defineProperties(this, {
				// attributes
				ino: {
					value: id,
					writable: false
				},
				mode: {
					value: inode.mode,
					writable: false
				},
				uid: {
					value: inode.uid,
					writable: false
				},
				gid: {
					value: inode.gid,
					writable: false
				},

				// functions
				isBlockDevice: {
					value: () => {
						return false;
					},
					writable: false
				},
				isCharacterDevice: {
					value: () => {
						return false;
					},
					writable: false
				},
				isDirectory: {
					value: () => {
						if(inode.type === 'DIR')
						{
							return true;
						}
						return false;
					},
					writable: false
				},
				isFIFO: {
					value: () => {
						return false;
					},
					writable: false
				},
				isFile: {
					value: () => {
						if(inode.type === 'FILE' || inode.type === 'REMOTE')
						{
							return true;
						}
						return false;
					},
					writable: false
				},
				isSocket: {
					value: () => {
						return false;
					},
					writable: false
				},
				isSymbolicLink: {
					value: () => {
						if(inode.type === 'LINK')
						{
							return true;
						}
						return false;
					},
					writable: false
				}
			});
		}
	}

	FS.Stats = Stats;

	//#endregion


	//#region fs public functions

	const access = (path, mode=0, callback) => {
		validateContext(context);
		if(typeof mode === 'function') {
			callback = mode;
			mode = undefined;
		}
		if(typeof callback !== 'function') {
			throw new TypeError("callback function is required");
		}

		makeAsyncPromise(context, {name:'fs.access'}, () => {
			return accessSync(path, mode);
		}).then(() => {
			callLambda(callback, null);
		}).catch((error) => {
			callLambda(callback, error);
		});
	}

	const accessSync = (path, mode=0) => {
		validateContext(context);
		if(!mode) {
			mode = 0;
		}
		var id = findINode(path);
		if(id == null) {
			throw new Error(path+" does not exist");
		}
		var inode = getINode(id);
		var neededPerms = {r:false,w:false,e:false};
		if((mode & constants.R_OK) == constants.R_OK) {
			neededPerms.r = true;
		}
		if((mode & constants.W_OK) == constants.W_OK) {
			neededPerms.w = true;
		}
		if((mode & constants.X_OK) == constants.X_OK) {
			neededPerms.x = true;
		}
		validatePermission(context, inode.uid, inode.gid, inode.mode, neededPerms);
	}

	FS.access = access;
	FS.accessSync = accessSync;


	const copyFile = (src, dest, flags, callback) => {
		validateContext(context);
		if(typeof flags === 'function') {
			callback = flags;
			flags = undefined;
		}
		if(typeof callback !== 'function') {
			throw new TypeError("callback function is required");
		}

		makeAsyncPromise(context, {name:'fs.copyFile'}, () => {
			return copyFileSync(src, dest, flags);
		}).then((content) => {
			callLambda(callback, null, content);
		}).catch((error) => {
			callLambda(callback, error, null);
		});
	}

	const copyFileSync = (src, dest, flags) => {
		validateContext(context);
		if(flags == null) {
			flags = 0;
		}
		if(typeof flags !== 'number' || !Number.isInteger(flags)) {
			throw new TypeError("flags must be an integer");
		}

		src = validatePath(src);
		dest = validatePath(dest);

		// validate input file
		var srcId = findINode(src);
		var srcRealId = findINodeFollowingLinks(src);
		if(srcId == null) {
			throw new Error("source file does not exist");
		}
		var srcINode = getINode(srcId);
		var srcRealINode = getINode(srcRealId);
		if(srcINode.type === 'DIR' || srcRealINode.type === 'DIR') {
			throw new Error("source path is a directory");
		}

		// read destination inode
		var destId = findINode(dest);
		let data = null;
		if(destId == null) {
			// read src inode content
			data = readINodeContent(srcId);
			// create destination
			destId = createPathEntry(dest, srcINode.type, {});
		}
		else {
			if((flags & constants.COPYFILE_EXCL) === constants.COPYFILE_EXCL) {
				throw new Error("destination already exists");
			}
			var destINode = getINode(destId);
			if(destINode.type === 'DIR') {
				throw new Error("destination is a directory");
			}
			else if(destINode.type === 'FILE') {
				data = readINodeContent(srcRealId);
			}
			else {
				data = readINodeContent(srcId);
			}
		}
		writeINodeContent(destId, data);
	}

	FS.copyFile = copyFile;
	FS.copyFileSync = copyFileSync;


	const exists = (path, callback) => {
		validateContext(context);
		if(typeof callback !== 'function') {
			throw new TypeError("callback function is required");
		}

		makeAsyncPromise(context, {name:'fs.exists'}, () => {
			return existsSync(path);
		}).then((doesExist) => {
			callLambda(callback, doesExist);
		}).catch((error) => {
			callLambda(callback, false);
		});
	}

	const existsSync = (path) => {
		validateContext(context);
		path = validatePath(path);
		try {
			var id = findINode(path);
			if(id == null) {
				return false;
			}
			return true;
		}
		catch(error) {
			return false;
		}
	}

	FS.exists = exists;
	FS.existsSync = existsSync;


	const mkdir = (path, mode, callback) => {
		validateContext(context);
		if(typeof mode === 'function') {
			callback = mode;
			mode = null;
		}
		if(typeof callback !== 'function') {
			throw new TypeError("callback function is required");
		}

		makeAsyncPromise(context, {name:'fs.mkdir'}, () => {
			return mkdirSync(path, mode);
		}).then(() => {
			callLambda(callback, null);
		}).catch((error) => {
			callLambda(callback, error);
		});
	}

	const mkdirSync = (path, mode) => {
		validateContext(context);
		if(mode == null) {
			mode = 0o777;
		}
		createPathEntry(path, 'DIR', {mode: mode});
	}

	FS.mkdir = mkdir;
	FS.mkdirSync = mkdirSync;


	const readdir = (path, options, callback) => {
		validateContext(context);
		if(typeof options === 'function') {
			callback = options;
			options = null;
		}
		if(typeof callback !== 'function') {
			throw new TypeError("callback function is required");
		}

		makeAsyncPromise(context, {name:'fs.readdir'}, () => {
			return readdirSync(path, options);
		}).then((data) => {
			callLambda(callback, null, data);
		}).catch((error) => {
			callLambda(callback, error, null);
		});
	}

	const readdirSync = (path, options) => {
		validateContext(context);
		options = Object.assign({}, options);
		var id = findINodeFollowingLinks(path);
		if(id == null) {
			throw new Error("directory does not exist");
		}
		var content = readINodeContent(id);
		var data = [];
		for(const fileName in content) {
			data.push(fileName);
		}
		data.sort();
		return data;
	}

	FS.readdir = readdir;
	FS.readdirSync = readdirSync;


	const readFile = (path, options, callback) => {
		validateContext(context);
		if(typeof options === 'function') {
			callback = options;
			options = null;
		}
		if(typeof callback !== 'function') {
			throw new TypeError("callback function is required");
		}

		makeAsyncPromise(context, {name:'fs.readFile'}, () => {
			return readFileSync(path, options);
		}).then((content) => {
			callLambda(callback, null, content);
		}).catch((error) => {
			callLambda(callback, error, null);
		});
	}

	const readFileSync = (path, options) => {
		validateContext(context);
		options = Object.assign({}, options);
		path = validatePath(path);
		var id = findINodeFollowingLinks(path);
		if(id == null) {
			throw new Error("file does not exist");
		}
		return readINodeContent(id, {encoding: options.encoding});
	}

	FS.readFile = readFile;
	FS.readFileSync = readFileSync;


	const rename = (oldPath, newPath, callback) => {
		validateContext(context);
		if(typeof callback !== 'function') {
			throw new TypeError("callback function is required");
		}

		makeAsyncPromise(context, {name:'fs.rename'}, () => {
			return renameSync(oldPath, newPath);
		}).then(() => {
			callLambda(callback, null);
		}).catch((error) => {
			callLambda(callback, error);
		});
	}

	const renameSync = (oldPath, newPath) => {
		validateContext(context);
		movePathEntry(oldPath, newPath);
	}

	FS.rename = rename;
	FS.renameSync = renameSync;


	const rmdir = (path, callback) => {
		validateContext(context);
		if(typeof callback !== 'function') {
			throw new TypeError("callback function is required");
		}

		makeAsyncPromise(context, {name:'fs.rmdir'}, () => {
			return rmdirSync(path);
		}).then(() => {
			callLambda(callback, null);
		}).catch((error) => {
			callLambda(callback, error);
		});
	}

	const rmdirSync = (path) => {
		validateContext(context);
		path = validatePath(path);
		var id = findINode(path);
		if(id == null) {
			throw new Error("directory does not exist");
		}
		var inode = getINode(id);
		if(inode.type !== 'DIR') {
			throw new Error("path is not a directory");
		}
		destroyPathEntry(path);
	}

	FS.rmdir = rmdir;
	FS.rmdirSync = rmdirSync;


	const stat = (path, callback) => {
		validateContext(context);
		if(typeof callback !== 'function') {
			throw new TypeError("callback function is required");
		}

		makeAsyncPromise(context, {name:'fs.stat'}, () => {
			return statSync(path);
		}).then((stats) => {
			callLambda(callback, null, stats);
		}).catch((error) => {
			callLambda(callback, error, null);
		});
	}

	const statSync = (path) => {
		validateContext(context);
		path = validatePath(path);
		var id = findINode(path);
		if(id == null) {
			throw new Error("file does not exist");
		}
		return new Stats(id);
	}

	FS.stat = stat;
	FS.statSync = statSync;


	const unlink = (path, callback) => {
		validateContext(context);
		if(typeof callback !== 'function') {
			throw new TypeError("callback function is required");
		}

		makeAsyncPromise(context, {name:'fs.unlink'}, () => {
			return unlinkSync(path);
		}).then(() => {
			callLambda(callback, null);
		}).catch((error) => {
			callLambda(callback, error);
		});
	}

	const unlinkSync = (path) => {
		validateContext(context);
		path = validatePath(path);
		var id = findINode(path);
		if(id == null) {
			throw new Error("file does not exist");
		}
		var inode = getINode(id);
		if(inode.type === 'DIR') {
			throw new Error("path cannot be a directory");
		}
		destroyPathEntry(path);
	}

	FS.unlink = unlink;
	FS.unlinkSync = unlinkSync;


	const writeFile = (path, data, options, callback) => {
		validateContext(context);
		if(typeof options === 'function') {
			callback = options;
			options = null;
		}
		if(typeof callback !== 'function') {
			throw new TypeError("callback function is required");
		}

		makeAsyncPromise(context, {name:'fs.writeFile'}, () => {
			return writeFileSync(path, data, options);
		}).then(() => {
			callLambda(callback, null);
		}).catch((error) => {
			callLambda(callback, error);
		});
	}

	const writeFileSync = (path, data, options) => {
		validateContext(context);
		options = Object.assign({}, options);
		path = validatePath(path);
		var id = createPathEntry(path, 'FILE', {mode: options.mode || 0o666}, {onlyIfMissing: true});
		var realId = followINodeLink(id);
		if(realId == null) {
			throw new Error("broken symbolic link");
		}
		writeINodeContent(realId, data, {encoding: options.encoding});
	}

	FS.writeFile = writeFile;
	FS.writeFileSync = writeFileSync;

	//#endregion

	return FS;
};
