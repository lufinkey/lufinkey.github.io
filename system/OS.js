
const depends = [
	'system/transcend32.exe/main',
	'system/shell32.exe/main'
];

defineModule(depends, (Transcend32, Shell32) => {
	class OS extends React.Component
	{
		render()
		{
			console.log("OS: rendering...");
			return (
				<Transcend32>
					<Shell32/>
				</Transcend32>
			);
		}
	}

	return OS;
});
