
const depends = [
	'system/transcend32.exe/CRT',
	'system/shell32.exe/Desktop'
];

defineModule(depends, (CRT, Desktop) => {
	class OS extends React.Component
	{
		render()
		{
			console.log("OS: rendering...");
			return (
				<CRT>
					<Desktop/>
				</CRT>
			);
		}
	}

	return OS;
});
