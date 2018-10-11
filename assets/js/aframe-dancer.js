AFRAME.registerComponent('dancer', {
	schema: {
		life: { default: 20000 },
		fade: { default: 2000 },
		intensity: { default: 0.5 },
		scale: { default: 20 }
	},

	init() {
		const data = this.data;
		const delay = Math.random() * 10000;

		const self = this;

		this.visibility = 0;

		this.el.addEventListener('model-loaded', () => {
			let model = this.el.components['gltf-model'].model;

			let mesh = model.children[0].children[0];
			let animation = model.animations[0];
			let duration = animation.duration;
			let material = mesh.material;

			material.opacity = material.visibility = 1;
			material.transparent = true;
			material.needsUpdate = true;

			self.el.setAttribute('animation-mixer', 'clip: *;');
			self.el.components['animation-mixer'].mixer.update(5 + Math.random() * duration);
			// self.el.components['animation-mixer'].mixer.timeScale = 2;

			self.el.object3D.scale.set(data.scale, data.scale, data.scale);
			self.el.components.sound.stopSound();
			self.el.components.sound.playSound();

			self.material = material;

			self.update();
		});

		this.el.setAttribute('sound', 'loop: true');
		this.el.setAttribute('sound', 'rolloffFactor: 0.25');
	},

	update() {
		const dist = 300;
		const deg = 360;

		const pos = {
			x: getRand(dist),
			y: getRand(10, false),
			z: getRand(dist)
		};

		const rot = {
			x: 0,
			y: getRand(deg),
			z: 0
		};

		this.el.object3D.position.set(pos.x, pos.y, pos.z);
		this.el.object3D.rotation.set(rot.x, rot.y, rot.z);
		// this.el.setAttribute('particles', `origin: ${pos.x} ${pos.y} ${pos.z};`);
	},

	tick() {
		if (!this.material) {
			return;
		}

		const sceneIntensity = this.el.sceneEl.components.drama.intensity;
		const intensityDistance = Math.abs(sceneIntensity - this.data.intensity);
		const visibility = intensityDistance < 0.3 ? (0.3 - intensityDistance) / 0.3 : 0;

		if (visibility === 0 && this.visibility > 0) {
			this.update();
		}

		this.visibility = visibility;

		this.material.visible = this.visibility !== 0;

		this.el.components.sound.pool.children[0].gain.gain.value = this.visibility;
		this.material.opacity = this.visibility;
	}
});

getRand = (val, neg = true) => {
	let r = Math.random() < 0.5 ? -1 : 1;
	if (neg == false) {
		r = -1;
	}
	return Math.random() * val * r;
};
