
const {
	makeAsyncPromise,
	validateContext
} = await krequire('kernel/process/thread.js');
const {
	checkIfDir
} = await krequire('kernel/util.js');



module.exports = (context) => {
	const fs = context.kernelModules.require('fs');

	// delete a file or folder
	function deleteSync(path, options) {
		if(!fs.existsSync(path)) {
			return;
		}
		if(checkIfDir(context, path)) {
			// delete entries in folder
			const dirEntries = fs.readdirSync(path, {encoding: 'utf8'});
			for(const entry of dirEntries) {
				deleteSync(path+'/'+entry, options);
			}
		}
		else {
			// delete file
			fs.unlinkSync(path);
		}
	}


	const rimrafSync = (path, options) => {
		validateContext(context);
		deleteSync(path, options);
	}

	const rimraf = (path, options, callback) => {
		validateContext(context);
		if(typeof options === 'function') {
			callback = options;
			options = {};
		}
		if(!options) {
			options = {};
		}
		makeAsyncPromise(context, {name:'rimraf'}, () => {
			return rimrafSync(path, options);
		}).then(() => {
			if(callback) {
				callback(null);
			}
		}).catch((error) => {
			if(callback) {
				callback(error);
			}
		});
	}

	rimraf.sync = rimrafSync;
	return rimraf;
};
