
const SCRIPT_TYPES = [ 'js', 'jsx' ];
const STYLE_TYPES = [ 'css', 'scss' ];



const scriptTransforms = {
	js: (context, code) => {
		return code;
	},
	jsx: (context, code) => {
		const Babel = kernel.Babel;
		return Babel.transform(code, {presets:['react', 'stage-0']}).code;
	}
};



const styleTransforms = {
	css: (context, code) => {
		// TODO parse out special CSS functions
		return code;
	},
	scss: (context, code) => {
		return new Promise((resolve, reject) => {
			const Sass = kernel.Sass;
			const sass = new Sass();
			setTimeout(() => {
				sass.compile(code, (result) => {
					// check for errors
					if(result.status !== 0) {
						reject(new Error(result.message));
						return;
					}
					resolve(result.text);
				});
			}, 0);
		});
	}
};




const getScriptType = (filename) => {
	const dotIndex = filename.lastIndexOf('.');
	if(dotIndex === -1) {
		return 'js';
	}
	else {
		const extension = filename.substring(dotIndex+1).toLowerCase();
		if(SCRIPT_TYPES.indexOf(extension) === -1) {
			return 'js';
		}
		return extension;
	}
};



const getStyleType = (filename) => {
	const dotIndex = filename.lastIndexOf('.');
	if(dotIndex === -1) {
		return 'css';
	}
	else {
		const extension = filename.substring(dotIndex+1).toLowerCase();
		if(STYLE_TYPES.indexOf(extension) === -1) {
			return 'css';
		}
		return extension;
	}
};



const transformScript = (context, type, code) => {
	if(type == null) {
		return code;
	}
	const transformer = scriptTransforms[type];
	if(transformer == null) {
		throw new Error("No script transform found for type "+type);
	}
	return transformer(context, code);
};

const transformStyle = (context, type, code) => {
	if(type == null) {
		return code;
	}
	const transformer = styleTransforms[type];
	if(transformer == null) {
		throw new Error("No style transform found for type "+type);
	}
	return transformer(context, code);
};



module.exports = {
	SCRIPT_TYPES,
	STYLE_TYPES,
	getScriptType,
	getStyleType,
	transformScript,
	transformStyle
};
