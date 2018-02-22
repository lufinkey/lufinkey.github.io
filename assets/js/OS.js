
const depends = [
	'screens/desktop/Desktop'
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
