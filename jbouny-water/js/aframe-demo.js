var lastTime = new Date().getTime();
var types = { float: 'half-float', 'half-float': 'float' };
var hash = document.location.hash.substr(1);
if (!(hash in types)) hash = 'half-float';

var lastTime = new Date().getTime();
function change(n) {
	location.hash = n;
	location.reload();
	return false;
}

AFRAME.registerComponent('ocean2', {
	init() {
		this.ms_Renderer = null;
		this.ms_Camera = null;
		this.ms_Scene = null;
		this.ms_Controls = null;
		this.ms_Ocean = null;
		this.val = 0;
		this.Initialize();

		const scene = this.el.sceneEl.object3D;

		light = new THREE.DirectionalLight(0xffffff, 0.8);
		scene.add(light);
	},

	Initialize() {
		const scene = this.el.sceneEl.object3D;
		const renderer = this.el.sceneEl.renderer;
		const camera = document.querySelector('#camera').object3D.children[0];
		console.log(camera);

		this.ms_Scene = scene;
		this.ms_Renderer = renderer;
		this.ms_Renderer.setClearColor(0xdddddd);

		// this.ms_Renderer = new THREE.WebGLRenderer();
		this.ms_Renderer.setPixelRatio(window.devicePixelRatio);
		this.ms_Renderer.context.getExtension('OES_texture_float');
		this.ms_Renderer.context.getExtension('OES_texture_float_linear');
		// this.ms_Scene = new THREE.Scene();
		this.ms_Camera = camera;
		this.ms_Camera.lookAt(0, 0, 0);
		var gsize = 512;
		var res = 1024;
		var gres = res / 2;
		var origx = -gsize / 2;
		var origz = -gsize / 2;
		this.ms_Ocean = new THREE.Ocean(
			this.ms_Renderer,
			this.ms_Camera,
			this.ms_Scene,
			{
				USE_HALF_FLOAT: hash === 'half-float',
				INITIAL_SIZE: 256.0,
				INITIAL_WIND: [10.0, 10.0],
				INITIAL_CHOPPINESS: 1.5,
				CLEAR_COLOR: [1.0, 1.0, 1.0, 0.0],
				GEOMETRY_ORIGIN: [origx, origz],
				SUN_DIRECTION: [-1.0, 1.0, 1.0],
				OCEAN_COLOR: new THREE.Vector3(0.004, 0.016, 0.047),
				SKY_COLOR: new THREE.Vector3(3.2, 9.6, 12.8),
				EXPOSURE: 0.35,
				GEOMETRY_RESOLUTION: gres,
				GEOMETRY_SIZE: gsize,
				RESOLUTION: res
			}
		);
		this.ms_Ocean.materialOcean.uniforms.u_projectionMatrix = {
			value: this.ms_Camera.projectionMatrix
		};
		this.ms_Ocean.materialOcean.uniforms.u_viewMatrix = {
			value: this.ms_Camera.matrixWorldInverse
		};
		this.ms_Ocean.materialOcean.uniforms.u_cameraPosition = {
			value: this.ms_Camera.position
		};
		this.ms_Scene.add(this.ms_Ocean.oceanMesh);
		var gui = new dat.GUI();
		gui.add(this.ms_Ocean, 'size', 100, 5000).onChange(function(v) {
			this.object.size = v;
			this.object.changed = true;
		});
		gui.add(this.ms_Ocean, 'choppiness', 0.1, 4).onChange(function(v) {
			this.object.choppiness = v;
			this.object.changed = true;
		});
		gui.add(this.ms_Ocean, 'windX', -15, 15).onChange(function(v) {
			this.object.windX = v;
			this.object.changed = true;
		});
		gui.add(this.ms_Ocean, 'windY', -15, 15).onChange(function(v) {
			this.object.windY = v;
			this.object.changed = true;
		});
		gui.add(this.ms_Ocean, 'sunDirectionX', -1.0, 1.0).onChange(function(
			v
		) {
			this.object.sunDirectionX = v;
			this.object.changed = true;
		});
		gui.add(this.ms_Ocean, 'sunDirectionY', -1.0, 1.0).onChange(function(
			v
		) {
			this.object.sunDirectionY = v;
			this.object.changed = true;
		});
		gui.add(this.ms_Ocean, 'sunDirectionZ', -1.0, 1.0).onChange(function(
			v
		) {
			this.object.sunDirectionZ = v;
			this.object.changed = true;
		});
		gui.add(this.ms_Ocean, 'exposure', 0.0, 0.5).onChange(function(v) {
			this.object.exposure = v;
			this.object.changed = true;
		});
	},

	Display() {
		this.ms_Renderer.render(this.ms_Scene, this.ms_Camera);

		let ocean = this.ms_Ocean;
		let mesh = ocean.oceanMesh;
		let geo = mesh.geometry;

		console.log(mesh);
		console.log(mesh.geometry);

		mesh.position.y = -100;
	},

	tick() {
		var currentTime = new Date().getTime();
		this.ms_Ocean.deltaTime = (currentTime - lastTime) / 1000 || 0.0;
		lastTime = currentTime;
		this.ms_Ocean.render(this.ms_Ocean.deltaTime);
		this.ms_Ocean.overrideMaterial = this.ms_Ocean.materialOcean;
		if (this.ms_Ocean.changed) {
			this.ms_Ocean.materialOcean.uniforms.u_size.value = this.ms_Ocean.size;
			this.ms_Ocean.materialOcean.uniforms.u_sunDirection.value.set(
				this.ms_Ocean.sunDirectionX,
				this.ms_Ocean.sunDirectionY,
				this.ms_Ocean.sunDirectionZ
			);
			this.ms_Ocean.materialOcean.uniforms.u_exposure.value = this.ms_Ocean.exposure;
			this.ms_Ocean.changed = false;
		}
		this.ms_Ocean.materialOcean.uniforms.u_normalMap.value = this.ms_Ocean.normalMapFramebuffer.texture;
		this.ms_Ocean.materialOcean.uniforms.u_displacementMap.value = this.ms_Ocean.displacementMapFramebuffer.texture;
		this.ms_Ocean.materialOcean.uniforms.u_projectionMatrix.value = this.ms_Camera.projectionMatrix;
		this.ms_Ocean.materialOcean.uniforms.u_viewMatrix.value = this.ms_Camera.matrixWorldInverse;
		this.ms_Ocean.materialOcean.uniforms.u_cameraPosition.value = this.ms_Camera.position;
		this.ms_Ocean.materialOcean.depthTest = true;
		//this.ms_Scene.__lights[1].position.x = this.ms_Scene.__lights[1].position.x + 0.01;
		this.Display();
	},

	update: function() {
		const p = this.el.getAttribute('position');

		console.log(p);
		this.ms_Ocean.oceanMesh.position.set(p.x, p.y, p.z);
	},
	Resize(inWidth, inHeight) {
		this.ms_Camera.aspect = inWidth / inHeight;
		this.ms_Camera.updateProjectionMatrix();
		this.ms_Renderer.setSize(inWidth, inHeight);
		this.Display();
	}
});
