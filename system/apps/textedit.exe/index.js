
const windowManager = process.env['GET_WINDOW_MANAGER']();
if(!windowManager)
{
	console.error("no window manager detected");
	process.exit(1);
}

if(process.argv.length > 2)
{
	console.error("too many arguments");
	process.exit(1);
}

let textBody = "";
try
{
	textBody = syscall('filesystem.readFile', process.argv[1]);
}
catch(error)
{
	console.error("unable to read file: ", error);
	process.exit(2);
}

windowManager.createWindow().then((window) => {
	
	// window created
	window.renderContent = () => {
		return (
			<textarea>{textBody}</textarea>
		);
	};

	window.onCloseButtonClick = () => {
		window.close();
		process.exit(0);
	};

}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
});
