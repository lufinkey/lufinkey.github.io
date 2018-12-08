
let fullscreen = false;

const animateScreenExpand = () => {
	return new Promise((resolve, reject) => {
		if(fullscreen) {
			resolve();
			return;
		}
		fullscreen = true;
		
		const crtScreen = document.querySelector(".crt-screen");
		
		const bodyRect = document.querySelector("body").getBoundingClientRect();
		const contentRect = crtScreen.getBoundingClientRect();

		const startScaleX = contentRect.width / bodyRect.width;
		const startScaleY = contentRect.height / bodyRect.height;

		let timeMillis = 0;
		let totalTime = 2000;

		const screenExpandInterval = setInterval(() => {
			timeMillis += 33;

			let progress = (timeMillis/totalTime);
			let done = false;

			let scaleX = startScaleX + ((1.0-startScaleX) * progress);
			let scaleY = startScaleY + ((1.0-startScaleY) * progress);
			
			let radians = progress * Math.PI * 4;

			let offsetX = Math.sin(radians);
			let offsetY = Math.cos(radians);
			
			if(timeMillis < (totalTime/2)) {
				let offsetScale = (timeMillis/(totalTime/2))*100;
				offsetX *= offsetScale;
				offsetY *= offsetScale * 0.7;
			}
			else if(timeMillis > totalTime) {
				offsetX = 0;
				offsetY = 0;
				scaleX = 1;
				scaleY = 1;
				clearInterval(screenExpandInterval);
				done = true;
			}
			else {
				let offsetScale = 100-(((timeMillis-(totalTime/2))/(totalTime/2))*100);
				offsetX *= offsetScale;
				offsetY *= offsetScale * 0.7;
			}

			if(!done) {
				let width = bodyRect.width * scaleX;
				let height = bodyRect.height * scaleY;
	
				let centerX = bodyRect.left + (bodyRect.width/2);
				let centerY = bodyRect.top + (bodyRect.height/2);

				Object.assign(crtScreen.style, {
					position: 'fixed',
					left: (centerX - (width/2) + offsetX)+'px',
					top: (centerY - (height/2) + offsetY)+'px',
					right: null,
					bottom: null,
					width: width+'px',
					height: height+'px',
					transform: 'none'
				});
			}
			else {
				Object.assign(crtScreen.style, {
					position: 'fixed',
					left: 0,
					top: 0,
					right: 0,
					bottom: 0,
					width: null,
					height: null,
					transform: 'none'
				});
				resolve();
			}
		}, 33);
	});
}

const crtFullscreenButton = document.querySelector(".crt-fullscreen-button");
crtFullscreenButton.onclick = () => {
	crtFullscreenButton.style.pointerEvents = "none";
	animateScreenExpand();
}
