AFRAME.registerSystem('postprocessing', {
	init() {
		this.enabled = true;
		this.sceneEl = this.el;
		this.needsResize = true;

		const renderer = this.sceneEl.renderer;

		// Render targets (created at 1x1, resized on first render)
		const rtParams = {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBAFormat,
			type: THREE.HalfFloatType
		};
		this.sceneRT = new THREE.WebGLRenderTarget(1, 1, rtParams);
		this.brightRT = new THREE.WebGLRenderTarget(1, 1, rtParams);
		this.blurHRT = new THREE.WebGLRenderTarget(1, 1, rtParams);
		this.blurVRT = new THREE.WebGLRenderTarget(1, 1, rtParams);

		// Track last known size to avoid redundant resizes
		this._lastW = 0;
		this._lastH = 0;

		// Fullscreen triangle geometry
		this.triangle = new THREE.BufferGeometry();
		const verts = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
		const uvs = new Float32Array([0, 0, 2, 0, 0, 2]);
		this.triangle.setAttribute('position', new THREE.BufferAttribute(verts, 3));
		this.triangle.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

		// Camera for fullscreen passes
		this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

		// Bright pass material
		this.brightMaterial = new THREE.ShaderMaterial({
			uniforms: {
				tDiffuse: { value: null },
				threshold: { value: 0.4 }
			},
			vertexShader: `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				uniform sampler2D tDiffuse;
				uniform float threshold;
				varying vec2 vUv;
				void main() {
					vec4 color = texture2D(tDiffuse, vUv);
					float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
					if (brightness > threshold) {
						gl_FragColor = color;
					} else {
						gl_FragColor = vec4(0.0);
					}
				}
			`
		});

		// 9-tap Gaussian blur (horizontal)
		this.blurHMaterial = new THREE.ShaderMaterial({
			uniforms: {
				tDiffuse: { value: null },
				resolution: { value: new THREE.Vector2(1, 1) }
			},
			vertexShader: `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				uniform sampler2D tDiffuse;
				uniform vec2 resolution;
				varying vec2 vUv;
				void main() {
					vec2 texel = 1.0 / resolution;
					vec4 result = vec4(0.0);
					float weights[5];
					weights[0] = 0.227027;
					weights[1] = 0.1945946;
					weights[2] = 0.1216216;
					weights[3] = 0.054054;
					weights[4] = 0.016216;
					result += texture2D(tDiffuse, vUv) * weights[0];
					for (int i = 1; i < 5; i++) {
						result += texture2D(tDiffuse, vUv + vec2(texel.x * float(i), 0.0)) * weights[i];
						result += texture2D(tDiffuse, vUv - vec2(texel.x * float(i), 0.0)) * weights[i];
					}
					gl_FragColor = result;
				}
			`
		});

		// 9-tap Gaussian blur (vertical)
		this.blurVMaterial = new THREE.ShaderMaterial({
			uniforms: {
				tDiffuse: { value: null },
				resolution: { value: new THREE.Vector2(1, 1) }
			},
			vertexShader: `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				uniform sampler2D tDiffuse;
				uniform vec2 resolution;
				varying vec2 vUv;
				void main() {
					vec2 texel = 1.0 / resolution;
					vec4 result = vec4(0.0);
					float weights[5];
					weights[0] = 0.227027;
					weights[1] = 0.1945946;
					weights[2] = 0.1216216;
					weights[3] = 0.054054;
					weights[4] = 0.016216;
					result += texture2D(tDiffuse, vUv) * weights[0];
					for (int i = 1; i < 5; i++) {
						result += texture2D(tDiffuse, vUv + vec2(0.0, texel.y * float(i))) * weights[i];
						result += texture2D(tDiffuse, vUv - vec2(0.0, texel.y * float(i))) * weights[i];
					}
					gl_FragColor = result;
				}
			`
		});

		// Composite material (additive blend)
		this.compositeMaterial = new THREE.ShaderMaterial({
			uniforms: {
				tScene: { value: null },
				tBloom: { value: null },
				strength: { value: 0.5 }
			},
			vertexShader: `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				uniform sampler2D tScene;
				uniform sampler2D tBloom;
				uniform float strength;
				varying vec2 vUv;
				void main() {
					vec4 sceneColor = texture2D(tScene, vUv);
					vec4 bloomColor = texture2D(tBloom, vUv);
					gl_FragColor = sceneColor + bloomColor * strength;
				}
			`
		});

		// Fullscreen meshes for each pass
		this.brightMesh = new THREE.Mesh(this.triangle, this.brightMaterial);
		this.blurHMesh = new THREE.Mesh(this.triangle, this.blurHMaterial);
		this.blurVMesh = new THREE.Mesh(this.triangle, this.blurVMaterial);
		this.compositeMesh = new THREE.Mesh(this.triangle, this.compositeMaterial);

		this.passScene = new THREE.Scene();
		this.passScene.autoUpdate = false;

		// Intercept renderer.render
		const self = this;
		const originalRender = renderer.render.bind(renderer);
		renderer.render = function(scene, camera) {
			// Only apply bloom to the main scene render
			if (!self.enabled || camera !== self.sceneEl.camera) {
				originalRender(scene, camera);
				return;
			}

			const currentRT = renderer.getRenderTarget();

			// If already rendering to a target (internal pass), skip bloom
			if (currentRT !== null) {
				originalRender(scene, camera);
				return;
			}

			// Check if render targets need resizing (handles DPR and window resize)
			const size = renderer.getDrawingBufferSize(new THREE.Vector2());
			const w = size.x;
			const h = size.y;
			if (w !== self._lastW || h !== self._lastH) {
				const hw = Math.floor(w / 2);
				const hh = Math.floor(h / 2);
				self.sceneRT.setSize(w, h);
				self.brightRT.setSize(hw, hh);
				self.blurHRT.setSize(hw, hh);
				self.blurVRT.setSize(hw, hh);
				self.blurHMaterial.uniforms.resolution.value.set(hw, hh);
				self.blurVMaterial.uniforms.resolution.value.set(hw, hh);
				self._lastW = w;
				self._lastH = h;
			}

			// 1. Render scene to texture
			renderer.setRenderTarget(self.sceneRT);
			originalRender(scene, camera);

			// 2. Bright pass at half-res
			self.brightMaterial.uniforms.tDiffuse.value = self.sceneRT.texture;
			self.passScene.children.length = 0;
			self.passScene.add(self.brightMesh);
			renderer.setRenderTarget(self.brightRT);
			originalRender(self.passScene, self.quadCamera);

			// 3. Horizontal blur
			self.blurHMaterial.uniforms.tDiffuse.value = self.brightRT.texture;
			self.passScene.children.length = 0;
			self.passScene.add(self.blurHMesh);
			renderer.setRenderTarget(self.blurHRT);
			originalRender(self.passScene, self.quadCamera);

			// 4. Vertical blur
			self.blurVMaterial.uniforms.tDiffuse.value = self.blurHRT.texture;
			self.passScene.children.length = 0;
			self.passScene.add(self.blurVMesh);
			renderer.setRenderTarget(self.blurVRT);
			originalRender(self.passScene, self.quadCamera);

			// 5. Composite: scene + bloom → screen
			self.compositeMaterial.uniforms.tScene.value = self.sceneRT.texture;
			self.compositeMaterial.uniforms.tBloom.value = self.blurVRT.texture;
			self.passScene.children.length = 0;
			self.passScene.add(self.compositeMesh);
			renderer.setRenderTarget(null);
			originalRender(self.passScene, self.quadCamera);
		};
	}
});
