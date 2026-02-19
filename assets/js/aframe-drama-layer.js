AFRAME.registerComponent('drama-layer', {
	schema: {
		intensityLevel: {default: 0}
	},

	init() {
		this.enabled = false;
	},

	tick() {
		const intensity = this.el.sceneEl.components.drama.intensity;

		// Const level = Math.floor(this.el.sceneEl.components.drama.intensity / 0.33333)
		let level = 0;
		if (intensity > 0.9) {
			level = 2;
		} else if (intensity > 0.22) {
			level = 1;
		}

		const enabled = this.data.intensityLevel <= level;

		if (enabled !== this.enabled) {
			const context = this.el.components.sound.listener.context;
			const gain = this.el.components.sound.pool.children[0].gain.gain;
			gain.linearRampToValueAtTime(enabled ? 1 : 0.000001, context.currentTime + 2);
			// Gain.value = enabled ? 1 : 0

			this.enabled = enabled;
		}
	}
});
