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
var WINDOW = {
	ms_Width: window.innerWidth,
	ms_Height: window.innerHeight
};

AFRAME.registerComponent('ocean2', {
	init() {
		this.ms_Renderer = null;
		this.ms_Camera = null;
		this.ms_Scene = null;
		this.ms_Controls = null;
		this.ms_Ocean = null;
		this.val = 0;

		this.ms_Commands = {
			states: {
				up: false,
				right: false,
				down: false,
				left: false
			},
			movements: {
				speed: 0.0,
				angle: 0.0
			}
		};

		const scene = this.el.sceneEl.object3D;
		const renderer = this.el.sceneEl.renderer;
		const camera = document.querySelector('#camera').object3D.children[0];

		console.log(camera);

		this.ms_Renderer = renderer;
		this.ms_Renderer.context.getExtension('OES_texture_float');
		this.ms_Renderer.context.getExtension('OES_texture_float_linear');
		this.ms_Renderer.setClearColor(0x000000);

		document.body.appendChild(this.ms_Renderer.domElement);

		this.ms_Scene = scene;

		this.ms_GroupShip = new THREE.Object3D();
		this.ms_BlackPearlShip = new THREE.Object3D();
		this.ms_Scene.add(this.ms_GroupShip);
		this.ms_GroupShip.add(this.ms_BlackPearlShip);

		this.ms_Camera = new THREE.PerspectiveCamera(
			55.0,
			WINDOW.ms_Width / WINDOW.ms_Height,
			0.5,
			1000000
		);
		this.ms_Camera = camera;
		this.ms_Camera.position.set(0, 350, 800);
		this.ms_Camera.lookAt(new THREE.Vector3());
		this.ms_BlackPearlShip.add(this.ms_Camera);

		this.InitializeScene();
		this.InitGui();
	},

	InitializeScene() {
		// Add light
		this.ms_MainDirectionalLight = new THREE.DirectionalLight(
			0xffffff,
			1.5
		);
		this.ms_MainDirectionalLight.position.set(-0.2, 0.5, 1);
		this.ms_Scene.add(this.ms_MainDirectionalLight);

		let c = 2;
		// Initialize Ocean
		var gsize = 512 / c;
		var res = 512 / c;
		var gres = 256 / c;
		var origx = -gsize / 2;
		var origz = -gsize / 2;
		this.ms_Ocean = new THREE.Ocean(
			this.ms_Renderer,
			this.ms_Camera,
			this.ms_Scene,
			{
				INITIAL_SIZE: 200.0,
				INITIAL_WIND: [10.0, 10.0],
				INITIAL_CHOPPINESS: 3.6,
				CLEAR_COLOR: [1.0, 1.0, 1.0, 0.0],
				SUN_DIRECTION: new THREE.Vector3(0.35, 0.4, 0.45),
				OCEAN_COLOR: new THREE.Vector3(0.35, 0.4, 0.45),
				SKY_COLOR: new THREE.Vector3(10.0, 13.0, 15.0),
				EXPOSURE: 0.15,
				GEOMETRY_RESOLUTION: gres,
				GEOMETRY_SIZE: gsize,
				RESOLUTION: res
			}
		);
		var directionalLightPosition = null;
		var directionalLightColor = null;

		// this.ms_MainDirectionalLight.position.copy(directionalLightPosition);
		// this.ms_MainDirectionalLight.color.copy(directionalLightColor);
		// this.ms_Ocean.materialOcean.uniforms.u_sunDirection.value.copy(
		// 	this.ms_MainDirectionalLight.position
		// );

		// Initialize Clouds
		this.ms_CloudShader = new CloudShader(this.ms_Renderer, 512);
		this.ms_CloudShader.cloudMesh.scale.multiplyScalar(4.0);
		// this.ms_Scene.add(this.ms_CloudShader.cloudMesh);
	},

	InitGui() {
		// Initialize UI
		var gui = new dat.GUI();
		// dat.GUI.toggleHide();

		gui.add(this.ms_Ocean, 'size', 10, 2000).onChange(function(v) {
			this.object.size = v;
			this.object.changed = true;
		});
		gui.add(
			this.ms_Ocean.materialSpectrum.uniforms.u_choppiness,
			'value',
			0.1,
			8
		).name('choppiness');
		gui.add(this.ms_Ocean, 'windX', -50, 50).onChange(function(v) {
			this.object.windX = v;
			this.object.changed = true;
		});
		gui.add(this.ms_Ocean, 'windY', -50, 50).onChange(function(v) {
			this.object.windY = v;
			this.object.changed = true;
		});
		gui.add(this.ms_Ocean, 'exposure', 0.0, 0.5).onChange(function(v) {
			this.object.exposure = v;
			this.object.changed = true;
		});
		// gui.add(DEMO.ms_Ocean.materialOcean, 'wireframe');
	},

	Display: function() {
		this.ms_Renderer.render(this.ms_Scene, this.ms_Camera);
	},

	tick: function() {
		// Update camera position
		// if (this.ms_Camera.position.y < 0.0) {
		// 	this.ms_Camera.position.y = 2.0;
		// }

		// Update black ship displacements
		this.ms_GroupShip.rotation.y += this.ms_Commands.movements.angle;
		this.ms_BlackPearlShip.rotation.z =
			-this.ms_Commands.movements.angle * 10.0;
		this.ms_BlackPearlShip.rotation.x =
			this.ms_Commands.movements.speed * 0.1;
		var shipDisplacement = new THREE.Vector3(0, 0, -1)
			.applyEuler(this.ms_GroupShip.rotation)
			.multiplyScalar(10.0 * this.ms_Commands.movements.speed);
		this.ms_GroupShip.position.add(shipDisplacement);

		var currentTime = new Date().getTime();
		this.ms_Ocean.deltaTime = (currentTime - lastTime) / 1000 || 0.0;
		lastTime = currentTime;

		// Render ocean reflection
		// this.ms_Camera.remove(this.ms_Rain);
		this.ms_Ocean.render();

		// Update ocean data
		this.ms_Ocean.update();

		this.Display();
	},

	UpdateCommands() {
		var states = this.ms_Commands.states;

		// Update speed
		var targetSpeed = 0.0;
		if (states.up) {
			targetSpeed = 1.0;
		} else if (states.down) {
			targetSpeed = -0.5;
		}
		var curSpeed = this.ms_Commands.movements.speed;
		this.ms_Commands.movements.speed =
			curSpeed + (targetSpeed - curSpeed) * 0.02;

		// Update angle
		var targetAngle = 0.0;
		if (states.left) {
			targetAngle = Math.PI * 0.005;
		} else if (states.right) {
			targetAngle = -Math.PI * 0.005;
		}
		if (states.down) {
			targetAngle *= -1.0;
		}

		var curAngle = this.ms_Commands.movements.angle;
		this.ms_Commands.movements.angle =
			curAngle + (targetAngle - curAngle) * 0.02;
	}
});
