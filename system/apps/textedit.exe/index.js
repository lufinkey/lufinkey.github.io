
const windowManager = process.env['WINDOW_MANAGER'];
if(!windowManager)
{
	console.error("no window manager detected");
	process.exit(1);
}

windowManager.createWindow().then((window) => {
	
	// window created
	window.renderContent = () => {
		return (
			<textarea>
			</textarea>
		);
	};

}).catch((error) => {
	console.error("unable to create window: ", error);
	process.exit(2);
})
