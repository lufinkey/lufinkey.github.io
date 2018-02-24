
const depends = [];

defineModule(depends, () => {
	class CRT extends React.Component
	{
		render()
		{
			return (
				<div className="crt-container">
					<div className="crt">
						<img className="crt-bg" src="system/transcend32.exe/CRT.jpg"/>
						<div className="crt-screen">
							<div className="crt-screen-content">
								{this.props.children}
								<div className="tv-effects">
									<div className="tv-scanlines"></div>
									<div className="tv-static-overlay"></div>
								</div>
							</div>
						</div>
					</div>
				</div>
			);
		}
	}

	return CRT;
});
