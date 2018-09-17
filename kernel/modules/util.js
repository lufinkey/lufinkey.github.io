
module.exports = (context) => {
	const util = context.kernelModules.requireBuiltIn('util');

	util.promisify = (func) => {
		return (...args) => {
			return new Promise((resolve, reject) => {
				func(...args, (error, ...results) => {
					if(error) {
						reject(error);
					}
					else {
						resolve(...results);
					}
				});
			});
		};
	};

	return util;
};
