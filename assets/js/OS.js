
const depends = [
	'shell32.exe/Desktop'
];

defineModule(depends, (Desktop) => {
	class OS extends React.Component
	{
		render()
		{
			console.log("OS: rendering...");
			return (<Desktop/>)
		}
	}

	return OS;
});
