AFRAME.registerComponent('clouds', {
	init() {
		const scene = this.el.sceneEl.object3D;
		const renderer = this.el.sceneEl.renderer;
		this.cloudShader = new CloudShader(renderer, 512);
		this.cloudShader.cloudMesh.scale.multiplyScalar(4.0);
		scene.add(this.cloudShader.cloudMesh);
	},
	tick() {
		this.cloudShader.update();
	}
});
