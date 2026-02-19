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

		// Smooth repositioning
		this.targetPosition = new THREE.Vector3();
		this.targetRotation = new THREE.Euler();
		this.hasTarget = false;

		this.el.addEventListener('model-loaded', () => {
			let model = this.el.components['gltf-model'].model;

			let mesh = model.children[0].children[0];
			let animation = model.animations[0];
			let duration = animation.duration;
			let material = mesh.material;

			material.opacity = material.visibility = 1;
			material.transparent = true;
			material.needsUpdate = true;

			// Emissive glow
			material.emissive = new THREE.Color(0x334455);
			material.emissiveIntensity = 0;

			self.el.setAttribute('animation-mixer', 'clip: *;');
			self.el.components['animation-mixer'].mixer.update(5 + Math.random() * duration);

			self.el.object3D.scale.set(data.scale, data.scale, data.scale);
			self.el.components.sound.stopSound();
			self.el.components.sound.playSound();

			self.material = material;

			self.setNewTarget();
			// Set initial position instantly
			self.el.object3D.position.copy(self.targetPosition);
			self.el.object3D.rotation.copy(self.targetRotation);
			self.hasTarget = false;
		});

		this.el.setAttribute('sound', 'loop: true');
		this.el.setAttribute('sound', 'rolloffFactor: 0.25');
	},

	setNewTarget() {
		const dist = 300;
		const deg = 360;

		this.targetPosition.set(
			getRand(dist),
			getRand(15, false),
			getRand(dist)
		);

		this.targetRotation.set(
			0,
			getRand(deg),
			0
		);

		this.hasTarget = true;
	},

	update() {
		// Only set targets if material is loaded (model ready)
		if (this.material) {
			this.setNewTarget();
		}
	},

	tick() {
		if (!this.material) {
			return;
		}

		const sceneIntensity = this.el.sceneEl.components.drama.intensity;
		const intensityDistance = Math.abs(sceneIntensity - this.data.intensity);
		const visibility = intensityDistance < 0.3 ? (0.3 - intensityDistance) / 0.3 : 0;

		if (visibility === 0 && this.visibility > 0) {
			this.setNewTarget();
		}

		this.visibility = visibility;

		this.material.visible = this.visibility !== 0;

		// Emissive glow reactive to visibility
		this.material.emissiveIntensity = this.visibility * 0.5;

		// Smooth repositioning
		if (this.hasTarget) {
			const pos = this.el.object3D.position;
			pos.lerp(this.targetPosition, 0.02);
			if (pos.distanceTo(this.targetPosition) < 0.5) {
				this.hasTarget = false;
			}
		}

		this.el.components.sound.pool.children[0].gain.gain.value = this.visibility;
		this.material.opacity = this.visibility;
	}
});

const getRand = (val, neg = true) => {
	let r = Math.random() < 0.5 ? -1 : 1;
	if (neg === false) {
		r = -1;
	}
	return Math.random() * val * r;
};
