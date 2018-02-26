
// sandbox kernel data
(function(){

	const osName = 'finkeos';

	// Filesystem class
	function Filesystem(storage)
	{
		const fsMetaPrefix = osName+'/fs-meta:';
		const fsPrefix = osName+'/fs:';

		// validate path
		function validatePath(path)
		{
			if(typeof path !== 'string')
			{
				return false;
			}
			var pathParts = path.split('/');
			if(pathParts.length == 0)
			{
				return false;
			}
			if(pathParts[0] !== "")
			{
				return false;
			}
			for(var i=1; i<pathParts.length; i++)
			{
				if(pathParts[i] === "")
				{
					return false;
				}
			}
			return true;
		}

		// get path of directory containing path
		function dirname(path)
		{
			var pathParts = path.split('/');
			pathParts = pathParts.slice(0, pathParts.length-1);
			return pathParts.join('/');
		}

		// get entry name of path
		function basename(path)
		{
			var pathParts = path.split('/');
			return pathParts[pathParts.length-1];
		}

		// get metadata about item at path
		function readMeta(path)
		{
			return new Promise((resolve, reject) => {
				if(!validatePath(path))
				{
					reject(new Error("invalid path"));
					return;
				}
				var meta = storage.getItem(fsMetaPrefix+path);
				if(meta != null)
				{
					try
					{
						meta = JSON.parse(meta);
					}
					catch(error)
					{
						reject("corrupted entry meta");
						return;
					}
				}
				resolve(meta);
			});
		}

		// create a default meta object
		function createMeta(meta)
		{
			var newMeta = Object.assign({}, meta);
			var defaultMeta = {
				type: 'file',
				dateCreated: new Date().getTime(),
				dateUpdated: new Date().getTime()
			};

			for(const metaKey of defaultMeta)
			{
				if(newMeta[metaKey] === undefined)
				{
					newMeta[metaKey] = defaultMeta[metaKey];
				}
			}

			return newMeta;
		}

		// write an entry
		function writeEntry(path, meta, data)
		{
			return new Promise((resolve, reject) => {
				// validate data
				if(typeof data !== 'string')
				{
					reject(new Error("non-string data may not be written"));
					return;
				}

				let entryMeta = null;
				let dirPath = null;
				let dirMeta = null;

				// get info about potentially already existing entry
				readMeta(path).then((meta) => {
					entryMeta = meta;
					// read meta info of containing directory
					dirPath = dirname(path);
					return readMeta(dirPath);
				}).catch((error) => {
					reject(error);
				}).then((meta) => {
					// validate containing directory
					dirMeta = meta;
					if(dirMeta == null)
					{
						reject(new Error("containing directory does not exist"));
						return;
					}
					else if(dirMeta.type !== 'dir')
					{
						reject(new Error("invalid containing directory"));
						return;
					}

					// read contents of containing directory
					return readDir(dirPath);
				}).catch((error) => {
					reject("unable to get meta info on containing directory: "+error.message);
				}).then((dirData) => {
					// create new meta data
					var newMeta = entryMeta;
					if(newMeta == null)
					{
						// create default meta
						newMeta = createMeta(meta);
					}
					else
					{
						// validate existing meta
						if(newMeta.type !== meta.type)
						{
							reject(new Error("overwriting entry type mismatch"));
							return;
						}
					}

					// add updated entry meta info
					newMeta.dateUpdated = new Date().getTime();

					// add updated parent dir entry meta info
					dirMeta.dateUpdated = new Date().getTime();

					// add entry to parent directory contents, if not already added
					var entryName = basename(path);
					if(!dirData.includes(entryName))
					{
						dirData.push(entryName);
					}

					// write meta + data + parent dir meta + parent dir data
					storage.setItem(fsMetaPrefix+path, JSON.stringify(newMeta));
					storage.setItem(fsPrefix+path, data);
					storage.setItem(fsMetaPrefix+dirPath, JSON.stringify(dirMeta));
					storage.setItem(fsPrefix+dirPath, JSON.stringify(dirData));

					// done
					resolve();
				}).catch((error) => {
					reject("unable to read contents of containing directory: "+error.message);
				});
			});
		}

		// read the contents of a directory
		function readDir(path)
		{
			return new Promise((resolve, reject) => {
				readMeta(path).then((meta) => {
					if(meta == null)
					{
						reject(new Error("directory does not exist"));
						return;
					}
					else if(meta.type !== 'dir')
					{
						reject(new Error("entry is not a directory"));
						return;
					}

					// read directory data
					var data = storage.getItem(fsPrefix+path);
					if(data == null)
					{
						reject(new Error("missing directory data"));
						return;
					}
					try
					{
						data = JSON.parse(data);
					}
					catch(error)
					{
						reject(new Error("corrupted directory data"));
						return;
					}

					// done
					resolve(data);
				}).catch((error) => {
					reject(error);
				});
			});
		}

		// create a directory
		function createDir(path, options)
		{
			options = Object.assign({}, options);

			return new Promise((resolve, reject) => {
				// validate an existing directory
				readMeta(path).then((meta) => {
					if(meta != null)
					{
						if(meta.type == 'dir')
						{
							if(options.ignoreIfExists)
							{
								resolve();
							}
							else
							{
								reject(new Error("directory already exists"));
							}
						}
						else
						{
							reject(new Error("entry already exists at path"));
						}
						return;
					}

					meta = { type: 'dir' };

					writeEntry(path, meta, JSON.stringify([])).then(() => {
						resolve();
					}).catch((error) => {
						reject(error);
					});
				}).catch((error) => {
					reject(error);
				});
			});
		}

		// read file from a given path
		function readFile(path)
		{
			return new Promise((resolve, reject) => {
				readMeta(path).then((meta) => {
					if(meta == null)
					{
						reject(new Error("file does not exist"));
						return;
					}
					else if(meta.type !== 'file')
					{
						reject(new Error("entry is not a file"));
						return;
					}
					var data = storage.getItem(fsPrefix+path);
					if(data == null)
					{
						reject(new Error("missing file data"));
						return;
					}
					resolve(data);
				}).catch(reject);
			});
		}

		// write file to a given path
		function writeFile(path, meta, data)
		{
			return writeEntry(path, {type: 'file'}, data);
		}
	}
})();
