window.addEventListener('load', () => {
	const scene = document.querySelector('a-scene');
	const camera = document.querySelector('#camera');

	scene.addEventListener('loaded', () => {
		setTimeout(() => {
			document.body.classList.remove('loading');
		}, 500);
	});

	scene.addEventListener('enter-vr', () => {
		if (camera) {
			camera.setAttribute('camera', 'active:false');
		}
	});
	scene.addEventListener('exit-vr', () => {
		if (camera) {
			camera.setAttribute('camera', 'active:true');
		}
	});
});
