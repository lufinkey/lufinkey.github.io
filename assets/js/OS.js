
const depends = [
	'shell32.exe/Desktop'
];

defineModule(depends, (Desktop) => {
	class OS extends React.Component
	{
		render()
		{
			return (<Desktop/>)
		}
	}

	return OS;
});
