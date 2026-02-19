/**
 * @author jbouny / https://github.com/fft-ocean
 *
 * Based on:
 * @author Aleksandr Albert / http://www.routter.co.tt
 */

THREE.Ocean = function (renderer, camera, scene, options) {

	// flag used to trigger parameter changes
	this.changed = true;
	this.initial = true;

	// Assign required parameters as object properties
	this.oceanCamera = new THREE.OrthographicCamera(); //camera.clone();
	this.oceanCamera.position.z = 1;
	this.renderer = renderer;
	this.renderer.setClearColor( 0x000000 );

	this.scene = new THREE.Scene();

	// Enable necessary extensions
	var gl = this.renderer.getContext();
	gl.getExtension('OES_texture_float');
	gl.getExtension('OES_texture_float_linear');

	// Create mirror rendering
	this.mirror = new THREE.MirrorRenderer( renderer, camera, scene ) ;
	this.mirror.position.y = -10.0;

	// Assign optional parameters as variables and object properties
	function optionalParameter(value, defaultValue) {
		return value !== undefined ? value : defaultValue;
	}
	function optionalParameterArray(value, index, defaultValue) {
		return value !== undefined ? value[index] : defaultValue;
	}
	options = options || {};
	this.sunDirection = optionalParameter(options.SUN_DIRECTION, new THREE.Vector3(-1.0, 1.0, 1.0 ));
	this.oceanColor = optionalParameter(options.OCEAN_COLOR, new THREE.Vector3(0.004, 0.016, 0.047));
	this.skyColor = optionalParameter(options.SKY_COLOR, new THREE.Vector3(3.2, 9.6, 12.8));
	this.exposure = optionalParameter(options.EXPOSURE, 0.35);
	this.geometryResolution = optionalParameter(options.GEOMETRY_RESOLUTION, 32);
	this.geometrySize = optionalParameter(options.GEOMETRY_SIZE, 2000);
	this.resolution = optionalParameter(options.RESOLUTION, 64);
	this.floatSize = optionalParameter(options.SIZE_OF_FLOAT, 4);
	this.windX = optionalParameterArray(options.INITIAL_WIND, 0, 10.0),
	this.windY = optionalParameterArray(options.INITIAL_WIND, 1, 10.0),
	this.size = optionalParameter(options.INITIAL_SIZE, 250.0),
	this.choppiness = optionalParameter(options.INITIAL_CHOPPINESS, 1.5);

	this.matrixNeedsUpdate = false;

	// Setup framebuffer pipeline
	var BaseParams = {
		format: THREE.RGBAFormat,
		stencilBuffer: false,
		depthBuffer: false,
		type: THREE.HalfFloatType
	};
	var LinearClampParams = JSON.parse(JSON.stringify(BaseParams));
	LinearClampParams.minFilter = LinearClampParams.magFilter = THREE.LinearFilter ;
	LinearClampParams.wrapS = LinearClampParams.wrapT = THREE.ClampToEdgeWrapping ;

	var NearestClampParams = JSON.parse(JSON.stringify(BaseParams));
	NearestClampParams.minFilter = NearestClampParams.magFilter = THREE.NearestFilter ;
	NearestClampParams.wrapS = NearestClampParams.wrapT = THREE.ClampToEdgeWrapping ;

	var NearestRepeatParams = JSON.parse(JSON.stringify(BaseParams));
	NearestRepeatParams.minFilter = NearestRepeatParams.magFilter = THREE.NearestFilter ;
	NearestRepeatParams.wrapS = NearestRepeatParams.wrapT = THREE.RepeatWrapping ;

	var LinearRepeatParams = JSON.parse(JSON.stringify(BaseParams));
	LinearRepeatParams.minFilter = LinearRepeatParams.magFilter = THREE.LinearFilter ;
	LinearRepeatParams.wrapS = LinearRepeatParams.wrapT = THREE.RepeatWrapping ;

	this.initialSpectrumFramebuffer = new THREE.WebGLRenderTarget(this.resolution, this.resolution, NearestRepeatParams);
	this.spectrumFramebuffer = new THREE.WebGLRenderTarget(this.resolution, this.resolution, NearestClampParams);
	this.pingPhaseFramebuffer = new THREE.WebGLRenderTarget(this.resolution, this.resolution, NearestClampParams);
	this.pongPhaseFramebuffer = new THREE.WebGLRenderTarget(this.resolution, this.resolution, NearestClampParams);
	this.pingTransformFramebuffer = new THREE.WebGLRenderTarget(this.resolution, this.resolution, NearestClampParams);
	this.pongTransformFramebuffer = new THREE.WebGLRenderTarget(this.resolution, this.resolution, NearestClampParams);
	this.displacementMapFramebuffer = new THREE.WebGLRenderTarget(this.resolution, this.resolution, LinearRepeatParams);
	this.normalMapFramebuffer = new THREE.WebGLRenderTarget(this.resolution, this.resolution, LinearRepeatParams);

	// Define shaders and constant uniforms
	////////////////////////////////////////

	// 0 - The vertex shader used in all of the simulation steps
	var fullscreeenVertexShader = THREE.ShaderLib["ocean_sim_vertex"];

	// 1 - Horizontal wave vertices used for FFT
	var oceanHorizontalShader = THREE.ShaderLib["ocean_subtransform"];
	var oceanHorizontalUniforms = THREE.UniformsUtils.clone(oceanHorizontalShader.uniforms);
	this.materialOceanHorizontal = new THREE.ShaderMaterial({
		uniforms: oceanHorizontalUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: "#define HORIZONTAL \n" + oceanHorizontalShader.fragmentShader
	});
	this.materialOceanHorizontal.uniforms.u_transformSize = { value: this.resolution };
	this.materialOceanHorizontal.uniforms.u_subtransformSize = { value: null };
	this.materialOceanHorizontal.uniforms.u_input = { value: null };
	this.materialOceanHorizontal.depthTest = false;

	// 2 - Vertical wave vertices used for FFT
	var oceanVerticalShader = THREE.ShaderLib["ocean_subtransform"];
	var oceanVerticalUniforms = THREE.UniformsUtils.clone(oceanVerticalShader.uniforms);
	this.materialOceanVertical = new THREE.ShaderMaterial({
		uniforms: oceanVerticalUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: oceanVerticalShader.fragmentShader
	});
	this.materialOceanVertical.uniforms.u_transformSize = { value: this.resolution };
	this.materialOceanVertical.uniforms.u_subtransformSize = { value: null };
	this.materialOceanVertical.uniforms.u_input = { value: null };
	this.materialOceanVertical.depthTest = false;

	// 3 - Initial spectrum used to generate height map
	var initialSpectrumShader = THREE.ShaderLib["ocean_initial_spectrum"];
	var initialSpectrumUniforms = THREE.UniformsUtils.clone(initialSpectrumShader.uniforms);
	this.materialInitialSpectrum = new THREE.ShaderMaterial({
		uniforms: initialSpectrumUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader:initialSpectrumShader.fragmentShader
	});
	this.materialInitialSpectrum.uniforms.u_wind = { value: new THREE.Vector2() };
	this.materialInitialSpectrum.uniforms.u_resolution = { value: this.resolution };
	this.materialInitialSpectrum.depthTest = false;

	// 4 - Phases used to animate heightmap
	var phaseShader = THREE.ShaderLib["ocean_phase"];
	var phaseUniforms = THREE.UniformsUtils.clone(phaseShader.uniforms);
	this.materialPhase = new THREE.ShaderMaterial({
		uniforms: phaseUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: phaseShader.fragmentShader
	});
	this.materialPhase.uniforms.u_resolution = { value: this.resolution };
	this.materialPhase.depthTest = false;

	// 5 - Shader used to update spectrum
	var spectrumShader = THREE.ShaderLib["ocean_spectrum"];
	var spectrumUniforms = THREE.UniformsUtils.clone(spectrumShader.uniforms);
	this.materialSpectrum = new THREE.ShaderMaterial({
		uniforms: spectrumUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: spectrumShader.fragmentShader
	});
	this.materialSpectrum.uniforms.u_initialSpectrum = { value: null };
	this.materialSpectrum.uniforms.u_resolution = { value: this.resolution };
	this.materialSpectrum.uniforms.u_choppiness.value = this.choppiness ;
	this.materialSpectrum.depthTest = false;

	// 6 - Shader used to update spectrum normals
	var normalShader = THREE.ShaderLib["ocean_normals"];
	var normalUniforms = THREE.UniformsUtils.clone(normalShader.uniforms);
	this.materialNormal = new THREE.ShaderMaterial({
		uniforms: normalUniforms,
		vertexShader: fullscreeenVertexShader.vertexShader,
		fragmentShader: normalShader.fragmentShader
	});
	this.materialNormal.uniforms.u_displacementMap = { value: null };
	this.materialNormal.uniforms.u_resolution = { value: this.resolution };
	this.materialNormal.depthTest = false;

	// 7 - Shader used to update normals
	var oceanShader = THREE.ShaderLib["ocean_main"];
	var oceanUniforms = THREE.UniformsUtils.clone(oceanShader.uniforms);
	var vertexShaderOcean = oceanShader.vertexShader;
	{
		var gl = renderer.getContext();
		if ( gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) === 0 ) {
			vertexShaderOcean = oceanShader.vertexShaderNoTexLookup;
		}
	}
	this.materialOcean = new THREE.ShaderMaterial({
		uniforms: oceanUniforms,
		vertexShader: vertexShaderOcean,
		fragmentShader: oceanShader.fragmentShader,
		side: THREE.FrontSide,
		wireframe: false
	});
	this.materialOcean.uniforms.u_geometrySize = { value: this.resolution };
	this.materialOcean.uniforms.u_displacementMap = { value: this.displacementMapFramebuffer.texture };
	this.materialOcean.uniforms.u_reflection = { value: this.mirror.texture.texture };
	this.materialOcean.uniforms.u_mirrorMatrix = { value: this.mirror.textureMatrix };
	this.materialOcean.uniforms.u_normalMap = { value: this.normalMapFramebuffer.texture };
	this.materialOcean.uniforms.u_oceanColor = { value: this.oceanColor };
	this.materialOcean.uniforms.u_skyColor = { value: this.skyColor };
	this.materialOcean.uniforms.u_sunDirection = { value: this.sunDirection };
	this.materialOcean.uniforms.u_exposure = { value: this.exposure };

	// Disable blending to prevent default premultiplied alpha values
	this.materialOceanHorizontal.blending = 0;
	this.materialOceanVertical.blending = 0;
	this.materialInitialSpectrum.blending = 0;
	this.materialPhase.blending = 0;
	this.materialSpectrum.blending = 0;
	this.materialNormal.blending = 0;
	this.materialOcean.blending = 0;

	// Create the simulation plane
	this.screenQuad = new THREE.Mesh( new THREE.PlaneGeometry( 2, 2 ) );
	this.scene.add(this.screenQuad);

	// Initialise spectrum data
	this.generateSeedPhaseTexture();

	// Generate the ocean mesh
	this.generateMesh();
	this.mirror.mesh = this.oceanMesh;
	camera.add( this.oceanMesh );

};

THREE.Ocean.prototype.generateMesh = function () {

	var geometry = new THREE.PlaneGeometry( 1, 1, this.geometryResolution, this.geometryResolution );
	this.oceanMesh = new THREE.Mesh( geometry, this.materialOcean );

};

THREE.Ocean.prototype.update = function () {

	this.overrideMaterial = this.materialOcean;
	if ( this.changed ) {
		this.materialOcean.uniforms.u_size.value = this.size;
		this.materialOcean.uniforms.u_exposure.value = this.exposure;
		this.changed = false;
	}
	this.materialOcean.uniforms.u_normalMap.value = this.normalMapFramebuffer.texture ;
	this.materialOcean.uniforms.u_displacementMap.value = this.displacementMapFramebuffer.texture ;
	this.materialOcean.depthTest = true;

};

THREE.Ocean.prototype.render = function () {

	this.scene.overrideMaterial = null;

	if (this.changed)
		this.renderInitialSpectrum();

	this.mirror.render();
	this.renderWavePhase();
	this.renderSpectrum();
	this.renderSpectrumFFT();
	this.renderNormalMap();
	this.scene.overrideMaterial = null;

};

THREE.Ocean.prototype.generateSeedPhaseTexture = function() {

	// Setup the seed texture
	this.pingPhase = true;
	var phaseArray = new window.Float32Array(this.resolution * this.resolution * 4);
	for (var i = 0; i < this.resolution; i++) {
		for (var j = 0; j < this.resolution; j++) {
			phaseArray[i * this.resolution * 4 + j * 4] = Math.random() * 2.0 * Math.PI;
			phaseArray[i * this.resolution * 4 + j * 4 + 1] = 0.0;
			phaseArray[i * this.resolution * 4 + j * 4 + 2] = 0.0;
			phaseArray[i * this.resolution * 4 + j * 4 + 3] = 0.0;
		}
	}

	this.pingPhaseTexture = new THREE.DataTexture(phaseArray, this.resolution, this.resolution, THREE.RGBAFormat, THREE.FloatType);
	this.pingPhaseTexture.minFilter = THREE.NearestFilter;
	this.pingPhaseTexture.magFilter = THREE.NearestFilter;
	this.pingPhaseTexture.wrapS = THREE.ClampToEdgeWrapping;
	this.pingPhaseTexture.wrapT = THREE.ClampToEdgeWrapping;
	this.pingPhaseTexture.needsUpdate = true;

};

THREE.Ocean.prototype.renderInitialSpectrum = function () {

	this.scene.overrideMaterial = this.materialInitialSpectrum;
	this.materialInitialSpectrum.uniforms.u_wind.value.set( this.windX, this.windY );
	this.materialInitialSpectrum.uniforms.u_size.value = this.size;
	this.renderer.setRenderTarget(this.initialSpectrumFramebuffer);
	this.renderer.clear();
	this.renderer.render(this.scene, this.oceanCamera);
	this.renderer.setRenderTarget(null);

};

THREE.Ocean.prototype.renderWavePhase = function () {

	this.scene.overrideMaterial = this.materialPhase;
	this.screenQuad.material = this.materialPhase;
	if (this.initial) {
		this.materialPhase.uniforms.u_phases.value = this.pingPhaseTexture;
		this.initial = false;
	}else {
		this.materialPhase.uniforms.u_phases.value = this.pingPhase ? this.pingPhaseFramebuffer.texture : this.pongPhaseFramebuffer.texture;
	}
	this.materialPhase.uniforms.u_deltaTime.value = this.deltaTime;
	this.materialPhase.uniforms.u_size.value = this.size;
	var target = this.pingPhase ? this.pongPhaseFramebuffer : this.pingPhaseFramebuffer;
	this.renderer.setRenderTarget(target);
	this.renderer.render(this.scene, this.oceanCamera);
	this.renderer.setRenderTarget(null);
	this.pingPhase = !this.pingPhase;

};

THREE.Ocean.prototype.renderSpectrum = function () {

	this.scene.overrideMaterial = this.materialSpectrum;
	this.materialSpectrum.uniforms.u_initialSpectrum.value = this.initialSpectrumFramebuffer.texture;
	this.materialSpectrum.uniforms.u_phases.value = this.pingPhase ? this.pingPhaseFramebuffer.texture : this.pongPhaseFramebuffer.texture;
	this.materialSpectrum.uniforms.u_size.value = this.size ;
	this.renderer.setRenderTarget(this.spectrumFramebuffer);
	this.renderer.render(this.scene, this.oceanCamera);
	this.renderer.setRenderTarget(null);

};

THREE.Ocean.prototype.renderSpectrumFFT = function() {

	// GPU FFT using Stockham formulation
	var iterations = Math.log2( this.resolution ) * 2; // log2

	this.scene.overrideMaterial = this.materialOceanHorizontal;
	var subtransformProgram = this.materialOceanHorizontal;

	var frameBuffer;
	var inputBuffer;

	for (var i = 0; i < iterations; i++) {
		if (i === 0) {
			inputBuffer = this.spectrumFramebuffer;
			frameBuffer = this.pingTransformFramebuffer ;
		}
		else if (i === iterations - 1) {
			inputBuffer = ((iterations % 2 === 0)? this.pingTransformFramebuffer : this.pongTransformFramebuffer) ;
			frameBuffer = this.displacementMapFramebuffer ;
		}
		else if (i % 2 === 1) {
			inputBuffer = this.pingTransformFramebuffer;
			frameBuffer = this.pongTransformFramebuffer ;
		}
		else {
			inputBuffer = this.pongTransformFramebuffer;
			frameBuffer = this.pingTransformFramebuffer ;
		}

		if (i === iterations / 2) {
			subtransformProgram = this.materialOceanVertical;
			this.scene.overrideMaterial = this.materialOceanVertical;
		}

		subtransformProgram.uniforms.u_input.value = inputBuffer.texture;

		subtransformProgram.uniforms.u_subtransformSize.value = Math.pow(2, (i % (iterations / 2) + 1 ));
		this.renderer.setRenderTarget(frameBuffer);
		this.renderer.render(this.scene, this.oceanCamera);
		this.renderer.setRenderTarget(null);
	}

};

THREE.Ocean.prototype.renderNormalMap = function () {

	this.scene.overrideMaterial = this.materialNormal;
	if (this.changed) this.materialNormal.uniforms.u_size.value = this.size;
	this.materialNormal.uniforms.u_displacementMap.value = this.displacementMapFramebuffer.texture;
	this.renderer.setRenderTarget(this.normalMapFramebuffer);
	this.renderer.clear();
	this.renderer.render(this.scene, this.oceanCamera);
	this.renderer.setRenderTarget(null);

};
