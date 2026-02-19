AFRAME.registerComponent('particles', {

	schema: {
		origin: {default: {x: 0, y: 0, z: 0}, type: 'vec3'}
	},

	init() {
		const scene = this.el.sceneEl.object3D;

		this.t = 0;
		this.c = new THREE.Clock();

		const MAX_PARTICLES = 250000;
		this.maxParticles = MAX_PARTICLES;
		this.particleHead = 0;

		// Create buffer attributes
		const positions = new Float32Array(MAX_PARTICLES * 3);
		const velocities = new Float32Array(MAX_PARTICLES * 3);
		const spawnTimes = new Float32Array(MAX_PARTICLES);
		const lifetimes = new Float32Array(MAX_PARTICLES);
		const sizes = new Float32Array(MAX_PARTICLES);

		// Initialize all spawn times to -1 (inactive)
		for (let i = 0; i < MAX_PARTICLES; i++) {
			spawnTimes[i] = -1.0;
			lifetimes[i] = 7.0;
			sizes[i] = 1.0;
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
		geometry.setAttribute('spawnTime', new THREE.BufferAttribute(spawnTimes, 1));
		geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
		geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

		// Load particle sprite texture
		const textureLoader = new THREE.TextureLoader();
		const particleTexture = textureLoader.load('./assets/textures/particle.png');

		const vertexShader = `
			uniform float uTime;
			attribute vec3 velocity;
			attribute float spawnTime;
			attribute float lifetime;
			attribute float size;
			varying float vAlpha;

			void main() {
				float age = uTime - spawnTime;
				float normAge = age / lifetime;

				// Hide expired or unborn particles
				if (spawnTime < 0.0 || normAge > 1.0 || normAge < 0.0) {
					gl_PointSize = 0.0;
					gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
					vAlpha = 0.0;
					return;
				}

				// Animate position based on velocity and age
				vec3 pos = position + velocity * age;

				// Fade in/out
				float fadeIn = smoothstep(0.0, 0.15, normAge);
				float fadeOut = 1.0 - smoothstep(0.7, 1.0, normAge);
				vAlpha = fadeIn * fadeOut;

				vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
				gl_PointSize = size * (300.0 / -mvPosition.z);
				gl_Position = projectionMatrix * mvPosition;
			}
		`;

		const fragmentShader = `
			uniform sampler2D uTexture;
			uniform vec3 uColor;
			varying float vAlpha;

			void main() {
				vec4 texColor = texture2D(uTexture, gl_PointCoord);
				if (texColor.a < 0.01) discard;
				gl_FragColor = vec4(texColor.rgb * uColor, vAlpha * texColor.a);
			}
		`;

		const material = new THREE.ShaderMaterial({
			uniforms: {
				uTime: { value: 0 },
				uTexture: { value: particleTexture },
				uColor: { value: new THREE.Vector3(0.6, 0.8, 1.0) }
			},
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});

		this.particleSystem = new THREE.Points(geometry, material);
		this.particleSystem.frustumCulled = false;
		scene.add(this.particleSystem);

		this.geometry = geometry;
		this.material = material;

		this.options = {
			position: new THREE.Vector3(),
			positionRandomness: 3,
			velocity: new THREE.Vector3(),
			velocityRandomness: 0,
			color: 0xFFFFFF,
			colorRandomness: 0,
			turbulence: 0.85,
			lifetime: 7,
			size: 1,
			sizeRandomness: 1.5
		};

		this.spawnerOptions = {
			spawnRate: 2000,
			horizontalSpeed: 1,
			verticalSpeed: 1,
			timeScale: 1
		};

		// Current color for lerping
		this.currentColor = new THREE.Vector3(0.6, 0.8, 1.0);
	},

	spawnParticle(options) {
		const i = this.particleHead;
		const posAttr = this.geometry.attributes.position;
		const velAttr = this.geometry.attributes.velocity;
		const spawnAttr = this.geometry.attributes.spawnTime;
		const lifeAttr = this.geometry.attributes.lifetime;
		const sizeAttr = this.geometry.attributes.size;

		const pr = options.positionRandomness;
		posAttr.array[i * 3]     = options.position.x + (Math.random() * 2 - 1) * pr;
		posAttr.array[i * 3 + 1] = options.position.y + (Math.random() * 2 - 1) * pr;
		posAttr.array[i * 3 + 2] = options.position.z + (Math.random() * 2 - 1) * pr;

		const vr = options.velocityRandomness;
		velAttr.array[i * 3]     = options.velocity.x + (Math.random() * 2 - 1) * vr;
		velAttr.array[i * 3 + 1] = options.velocity.y + (Math.random() * 2 - 1) * vr;
		velAttr.array[i * 3 + 2] = options.velocity.z + (Math.random() * 2 - 1) * vr;

		spawnAttr.array[i] = this.t;
		lifeAttr.array[i] = options.lifetime;
		sizeAttr.array[i] = options.size + Math.random() * options.sizeRandomness;

		posAttr.needsUpdate = true;
		velAttr.needsUpdate = true;
		spawnAttr.needsUpdate = true;
		lifeAttr.needsUpdate = true;
		sizeAttr.needsUpdate = true;

		this.particleHead = (this.particleHead + 1) % this.maxParticles;
	},

	tick() {
		const delta = this.c.getDelta() * this.spawnerOptions.timeScale;

		this.t += delta;

		if (this.t < 0) {
			this.t = 0;
		}

		// Drama reactivity
		const drama = this.el.sceneEl.components.drama;
		const intensity = (drama && drama.intensity) || 0;

		// Modulate spawn rate: 2000 (calm) → 15000 (intense)
		this.spawnerOptions.spawnRate = 2000 + intensity * 13000;

		// Modulate velocity randomness: 0.1 → 1.5
		this.options.velocityRandomness = 0.1 + intensity * 1.4;

		// Upward drift
		this.options.velocity.y = intensity * 0.3;

		// Modulate size: 0.5 → 2.0
		this.options.size = 0.5 + intensity * 1.5;

		// Lerp color: cool blue (0.6, 0.8, 1.0) → warm amber (1.0, 0.7, 0.3)
		const coolBlue = { x: 0.6, y: 0.8, z: 1.0 };
		const warmAmber = { x: 1.0, y: 0.7, z: 0.3 };
		this.currentColor.x += (coolBlue.x + intensity * (warmAmber.x - coolBlue.x) - this.currentColor.x) * 0.02;
		this.currentColor.y += (coolBlue.y + intensity * (warmAmber.y - coolBlue.y) - this.currentColor.y) * 0.02;
		this.currentColor.z += (coolBlue.z + intensity * (warmAmber.z - coolBlue.z) - this.currentColor.z) * 0.02;
		this.material.uniforms.uColor.value.set(this.currentColor.x, this.currentColor.y, this.currentColor.z);

		if (delta > 0) {
			for (let x = 0; x < this.spawnerOptions.spawnRate * delta; x++) {
				this.spawnParticle(this.options);
			}
		}

		this.material.uniforms.uTime.value = this.t;
	}
});
