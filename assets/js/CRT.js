
const depends = ['OS'];

defineModule(depends, (OS) => {
	class CRT extends React.Component
	{
		render()
		{
			return (
				<div className="crt-container">
					<div className="crt">
						<img className="crt-bg" src="http://i.imgur.com/Dclfsitl.jpg"/>
						<div className="crt-screen">
							<div className="os-container">
								<OS/>
							</div>
						</div>
					</div>
				</div>
			)
		}
	}

	return CRT;
});
