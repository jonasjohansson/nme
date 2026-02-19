window.addEventListener('load', () => {
	const scene = document.querySelector('a-scene');
	const camera = document.querySelector('#camera');

	scene.addEventListener('loaded', () => {
		setTimeout(() => {
			document.body.classList.remove('loading');
		}, 500);
	});

	// Resume AudioContext and start sounds on first user interaction
	function resumeAudio() {
		const soundEls = document.querySelectorAll('[sound]');
		soundEls.forEach(el => {
			if (el.components.sound) {
				const pool = el.components.sound.pool;
				if (pool && pool.children[0]) {
					const ctx = pool.children[0].context;
					if (ctx.state === 'suspended') ctx.resume();
				}
				el.components.sound.playSound();
			}
		});
		document.removeEventListener('click', resumeAudio);
		document.removeEventListener('touchstart', resumeAudio);
	}
	document.addEventListener('click', resumeAudio);
	document.addEventListener('touchstart', resumeAudio);

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
