
// sandbox kernel data
(function(){
	const osName = 'finkeos';

	const bootOptions = {
		fetchAll: true,
		forceNoCache: true
	};

	const kernel = {};

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
			if(!validatePath(path))
			{
				throw new Error("invalid path");
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
					throw new Error("corrupted entry meta");
				}
			}
			return meta;
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
			// validate data
			if(typeof data !== 'string')
			{
				throw new Error("non-string data may not be written");
			}

			// get info about potentially already existing entry
			var entryMeta = readMeta(path);

			// validate containing directory
			var dirPath = dirname(path);
			var dirMeta = readMeta(dirPath);
			if(dirMeta == null)
			{
				throw new Error("containing directory does not exist");
			}
			else if(dirMeta.type !== 'dir')
			{
				throw new Error("invalid containing directory");
			}

			var dirData = readDir(dirPath);

			// create new meta data
			var meta = entryMeta;
			if(meta == null)
			{
				// create default meta
				meta = createMeta(meta);
			}
			else
			{
				// validate existing meta
				if(meta.type !== entryMeta.type)
				{
					throw new Error("overwriting entry type mismatch");
				}
			}

			// add updated entry meta info
			meta.dateUpdated = new Date().getTime();

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
		}

		// check if an entry exists
		function exists(path)
		{
			if(!validatePath(path))
			{
				throw new Error("invalid path");
			}
			if(storage.getItem(fsPrefix+path) == null)
			{
				return false;
			}
			return true;
		}

		// read the contents of a directory
		function readDir(path)
		{
			// read dir meta
			var meta = readMeta(path);
			if(meta == null)
			{
				throw new Error("directory does not exist");
			}
			else if(meta.type !== 'dir')
			{
				throw new Error("entry is not a directory");
			}

			// read directory data
			var data = storage.getItem(fsPrefix+path);
			if(data == null)
			{
				throw new Error("missing directory data");
			}
			try
			{
				data = JSON.parse(data);
			}
			catch(error)
			{
				throw new Error("corrupted directory data");
			}

			return data;
		}

		// create a directory
		function createDir(path, options)
		{
			options = Object.assign({}, options);

			var meta = readMeta(path);
			if(meta != null)
			{
				if(meta.type == 'dir')
				{
					if(options.ignoreIfExists)
					{
						return;
					}
					else
					{
						throw new Error("directory already exists");
					}
				}
				else
				{
					throw new Error("entry already exists at path");
				}
			}

			writeEntry(path, {type: 'dir'}, JSON.stringify([]));
		}

		// read file from a given path
		function readFile(path)
		{
			var meta = readMeta(path);
			if(meta == null)
			{
				throw new Error("file does not exist");
			}
			else if(meta.type !== 'file')
			{
				throw new Error("entry is not a file");
			}

			var data = storage.getItem(fsPrefix+path);
			if(data == null)
			{
				throw new Error("missing file data");
				return;
			}
			return data;
		}

		// write file to a given path
		function writeFile(path, data)
		{
			return writeEntry(path, {type: 'file'}, data);
		}

		// create default filesystem, if necessary
		var rootDirMeta = storage.getItem(fsMetaPrefix+'/');
		if(rootDirMeta)
		{
			// root dir has no meta. create empty filesystem
			storage.setItem(fsMetaPrefix+'/', createMeta({type: 'dir'}));
			storage.setItem(fsPrefix+'/', JSON.stringify([]));
		}

		// add properties
		this.exists = exists;
		this.readMeta = readMeta;
		this.readDir = readDir;
		this.createDir = createDir;
		this.readFile = readFile;
		this.writeFile = writeFile;
	}


	

	// class for retrieving a remote file
	class RemoteFile
	{
		constructor(remoteURL)
		{
			this.url = remoteURL;
		}

		save(filesystem, path)
		{
			return new Promise((resolve, reject) => {
				// stop if the file exists locally and we're not fetching everything
				if(filesystem.exists(path) && !bootOptions.fetchAll && !bootOptions.forceNoCache)
				{
					resolve();
					return;
				}
				
				// send request to retrieve remote file
				var xhr = new XMLHttpRequest();
				xhr.onreadystatechange = () => {
					if(xhr.readyState == 4)
					{
						// handle result
						if(xhr.status == 200)
						{
							// attempt to load the module's script
							try
							{
								filesystem.writeFile(path, xhr.responseText);
							}
							catch(error)
							{
								reject(error);
								return;
							}
							resolve();
						}
						else
						{
							reject(new Error("request failed with status "+xhr.status+": "+xhr.statusText));
						}
					}
				};

				var url = this.url;
				if(bootOptions.forceNoCache)
				{
					url += '?v='+(Math.random()*999999999);
				}

				xhr.open("GET", url);
				xhr.send();
			});
		}
	}
})();
