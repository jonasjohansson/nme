const DEMO = {
    ms_Renderer: null,
    ms_Camera: null,
    ms_Scene: null,
    ms_Controls: null,
    ms_Ocean: null,
    ms_Environment: 'night',
    ms_Raining: false
}
let lastTime = performance.now()

AFRAME.registerComponent('environment', {
    init() {
        this.ms_Scene = document.querySelector('a-scene').object3D

        this.ms_Renderer = document.querySelector('a-scene').renderer
        const gl = this.ms_Renderer.getContext()
        gl.getExtension('OES_texture_float')
        gl.getExtension('OES_texture_float_linear')
        this.ms_Renderer.setClearColor(0x000000)

        // Tone mapping
        this.ms_Renderer.toneMapping = THREE.ACESFilmicToneMapping
        this.ms_Renderer.toneMappingExposure = 1.0
        this.ms_Renderer.outputColorSpace = THREE.SRGBColorSpace

        document.body.appendChild(this.ms_Renderer.domElement)
        this.ms_GroupShip = new THREE.Object3D()
        this.ms_Scene.add(this.ms_GroupShip)

        const cam = document.querySelector('[camera]').object3D.children
        this.ms_Camera = document.querySelector('[camera]').object3D.children[0]
        this.ms_GroupShip.add(this.ms_Camera)

        // Drama-reactive state
        this.currentChoppiness = 3.6
        this.currentWindX = 4.0
        this.currentWindY = 4.0

        this.InitializeScene()
    },

    InitializeScene() {
        // Add light
        this.ms_MainDirectionalLight = new THREE.DirectionalLight(0xffffff, 1.5)
        this.ms_MainDirectionalLight.position.set(-0.2, 0.5, 1)
        this.ms_Scene.add(this.ms_MainDirectionalLight)

        // Initialize Clouds
        this.ms_CloudShader = new CloudShader(this.ms_Renderer, 512)
        this.ms_CloudShader.cloudMesh.scale.multiplyScalar(1.0)
        this.ms_Scene.add(this.ms_CloudShader.cloudMesh)

        // Initialize Ocean
        const gsize = 512
        const res = 512
        const gres = 256
        const origx = -gsize / 2
        const origz = -gsize / 2
        this.ms_Ocean = new THREE.Ocean(this.ms_Renderer, this.ms_Camera, this.ms_Scene, {
            INITIAL_SIZE: 200.0,
            INITIAL_WIND: [4.0, 4.0],
            INITIAL_CHOPPINESS: 3.6,
            CLEAR_COLOR: [0.0, 0.0, 0.0, 0.0],
            SUN_DIRECTION: this.ms_MainDirectionalLight.position.clone(),
            OCEAN_COLOR: new THREE.Vector3(0.004, 0.016, 0.047),
            SKY_COLOR: new THREE.Vector3(0.2, 0.3, 0.4),
            EXPOSURE: 0.15,
            GEOMETRY_RESOLUTION: gres,
            GEOMETRY_SIZE: gsize,
            RESOLUTION: res
        })
    },

    tick() {
        const currentTime = performance.now()
        this.ms_Ocean.deltaTime = (currentTime - lastTime) / 1000 || 0.0
        lastTime = currentTime

        // Drama-reactive ocean + fog
        const drama = this.el.sceneEl.components.drama
        if (drama) {
            const intensity = drama.intensity || 0

            // Lerp choppiness: 1.5 (calm) → 5.0 (intense)
            const targetChop = 1.5 + intensity * 3.5
            this.currentChoppiness += (targetChop - this.currentChoppiness) * 0.02
            this.ms_Ocean.materialSpectrum.uniforms.u_choppiness.value = this.currentChoppiness

            // Lerp wind: 2.0 → 8.0 both axes
            const targetWind = 2.0 + intensity * 6.0
            const oldWindX = this.currentWindX
            const oldWindY = this.currentWindY
            this.currentWindX += (targetWind - this.currentWindX) * 0.02
            this.currentWindY += (targetWind - this.currentWindY) * 0.02

            // Only trigger expensive initial spectrum re-render when wind changes significantly
            const windDelta = Math.abs(this.currentWindX - oldWindX) + Math.abs(this.currentWindY - oldWindY)
            if (windDelta > 0.001) {
                this.ms_Ocean.windX = this.currentWindX
                this.ms_Ocean.windY = this.currentWindY
                this.ms_Ocean.changed = true
            }

            // Drama-reactive fog
            const fog = this.el.sceneEl.object3D.fog
            if (fog) {
                fog.density = 0.002 + intensity * 0.004
            }
        }

        // Render ocean reflection
        this.ms_Ocean.render()
        this.ms_CloudShader.update()
        this.ms_Ocean.update()
    },

    Resize(inWidth, inHeight) {
        this.ms_Camera.aspect = inWidth / inHeight
        this.ms_Camera.updateProjectionMatrix()
        this.ms_Renderer.setSize(inWidth, inHeight)
    }
})
