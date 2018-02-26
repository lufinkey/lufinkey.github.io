
const depends = [
	'system/shell32.exe/Desktop'
];

defineModule(depends, (Desktop) => {
	class Shell32 extends React.Component
	{
		render()
		{
			return (
				<Desktop/>
			);
		}
	}

	return Shell32;
});
