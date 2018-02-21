
function executeBabelScript(code)
{
	const module = {exports: {}};
	eval(result, [Babel.transform(code, {presets:['react']}).code]);
	return module.exports;
}

function resolveRequirePath(path)
{
	let baseDir = "assets/js";
	return baseDir+'/'+scriptPath+'.js';
}

const require = (function() {
	let loadedModules = {};
	let modules = {};
	return function(scriptName) {
		// ensure script isn't already loaded
		var fullScriptPath = resolveRequirePath(scriptName);
		if(loadedModules[fullScriptPath])
		{
			return modules[fullScriptPath];
		}

		// retrieve script
		var xhr = new XMLHttpRequest();
		xhr.open("GET", fullScriptPath, false);
		xhr.send();

		// handle result
		if(xhr.status == 200)
		{
			console.log("loaded script at "+fullScriptPath);
			var scriptCode = xhr.responseText;
			var newModule = executeBabelScript(scriptCode);
			modules[fullScriptPath] = newModule;
			loadedModules[fullScriptPath] = true;
			return newModule;
		}
		else
		{
			throw new Error("unable to load script at "+fullScriptPath);
		}
	};
})();
