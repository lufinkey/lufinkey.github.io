
const depends = ['system/transcend32.exe/CRT'];

defineModule(depends, (CRT) => {
	class Transcend32 extends React.Component
	{
		render()
		{
			return (
				<CRT>
					{this.props.children}
				</CRT>
			);
		}
	}

	return Transcend32;
});
