var DEMO = {
	ms_Renderer: null,
	ms_Camera: null,
	ms_Scene: null,
	ms_Controls: null,
	ms_Ocean: null,
	ms_Environment: 'night',
	ms_Raining: false
};
var lastTime = new Date().getTime();

AFRAME.registerComponent('environment', {
	init() {
		this.ms_Scene = document.querySelector('a-scene').object3D;

		this.ms_Renderer = document.querySelector('a-scene').renderer;
		this.ms_Renderer.context.getExtension('OES_texture_float');
		this.ms_Renderer.context.getExtension('OES_texture_float_linear');
		this.ms_Renderer.setClearColor(0x000000);

		document.body.appendChild(this.ms_Renderer.domElement);
		this.ms_GroupShip = new THREE.Object3D();
		this.ms_Scene.add(this.ms_GroupShip);

		// this.ms_Camera = new THREE.PerspectiveCamera(55, winder.innerWidth / window.innerHe, 0.5, 1000000);
		var cam = document.querySelector('[camera]').object3D.children;
		this.ms_Camera = document.querySelector('[camera]').object3D.children[0];
		// this.ms_Camera.position.set(0, 100, 0);
		// this.ms_Camera.lookAt(new THREE.Vector3());
		this.ms_GroupShip.add(this.ms_Camera);

		this.InitializeScene();
	},

	InitializeScene() {
		// Add light
		this.ms_MainDirectionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
		this.ms_MainDirectionalLight.position.set(-0.2, 0.5, 1);
		this.ms_Scene.add(this.ms_MainDirectionalLight);

		// Initialize Clouds
		this.ms_CloudShader = new CloudShader(this.ms_Renderer, 512);
		this.ms_CloudShader.cloudMesh.scale.multiplyScalar(4.0);
		this.ms_Scene.add(this.ms_CloudShader.cloudMesh);

		// Initialize Ocean
		var gsize = 512;
		var res = 512;
		var gres = 256;
		var origx = -gsize / 2;
		var origz = -gsize / 2;
		this.ms_Ocean = new THREE.Ocean(this.ms_Renderer, this.ms_Camera, this.ms_Scene, {
			INITIAL_SIZE: 200.0,
			INITIAL_WIND: [4.0, 4.0],
			INITIAL_CHOPPINESS: 3.6,
			CLEAR_COLOR: [1.0, 1.0, 1.0, 0.0],
			SUN_DIRECTION: this.ms_MainDirectionalLight.position.clone(),
			OCEAN_COLOR: new THREE.Vector3(0.35, 0.4, 0.45),
			SKY_COLOR: new THREE.Vector3(10.0, 13.0, 15.0),
			EXPOSURE: 0.05,
			GEOMETRY_RESOLUTION: gres,
			GEOMETRY_SIZE: gsize,
			RESOLUTION: res
		});
	},

	tick() {
		var currentTime = new Date().getTime();
		this.ms_Ocean.deltaTime = (currentTime - lastTime) / 1000 || 0.0;
		lastTime = currentTime;

		// Render ocean reflection
		this.ms_Ocean.render();
		this.ms_CloudShader.update();
		this.ms_Ocean.update();
	},

	Resize(inWidth, inHeight) {
		this.ms_Camera.aspect = inWidth / inHeight;
		this.ms_Camera.updateProjectionMatrix();
		this.ms_Renderer.setSize(inWidth, inHeight);
	}
});
