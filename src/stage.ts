import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { config } from './config'

export interface Stage {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  /** The camera that renders. Follows the Blender camera when one was exported. */
  camera: THREE.PerspectiveCamera
  root: THREE.Object3D
  clips: THREE.AnimationClip[]
  /** Copy the (possibly animated) Blender camera into the render camera. */
  syncCamera(): void
  onResize(fn: (width: number, height: number) => void): void
  /** false = the caller sizes the canvas itself (card view). Default: follows the window. */
  followWindow(on: boolean): void
}

export async function createStage(canvas: HTMLCanvasElement): Promise<Stage> {
  const { look } = config
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = look.exposure
  renderer.shadowMap.enabled = look.shadows

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(look.background)
  if (look.environment) {
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = look.environmentIntensity
    pmrem.dispose()
  }

  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.loadAsync(config.model)
  const root = gltf.scene
  scene.add(root)

  if (look.shadows) {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true
      if (o instanceof THREE.Light && 'shadow' in o) o.castShadow = true
    })
  }

  const source = gltf.cameras.find((c): c is THREE.PerspectiveCamera => c instanceof THREE.PerspectiveCamera)
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000)
  scene.add(camera)

  if (!source) {
    // No camera exported: frame the whole scene.
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3()).length()
    const center = box.getCenter(new THREE.Vector3())
    camera.position.copy(center).add(new THREE.Vector3(0.6, 0.4, 1).multiplyScalar(size))
    camera.lookAt(center)
    camera.near = size / 100
    camera.far = size * 100
  }

  const syncCamera = () => {
    if (!source) return
    source.updateWorldMatrix(true, false)
    source.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale)
    camera.near = source.near
    camera.far = source.far
    // Keep Blender's horizontal framing on screens narrower than the Blender render (phones).
    let fov = source.fov
    if (camera.aspect < source.aspect) {
      const half = THREE.MathUtils.degToRad(fov) / 2
      fov = THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(half) * source.aspect) / camera.aspect))
    }
    if (fov !== camera.fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }

  const resizeListeners: ((w: number, h: number) => void)[] = []
  let followsWindow = true
  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, look.maxPixelRatio))
    if (followsWindow) renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    resizeListeners.forEach((fn) => fn(w, h))
  }
  window.addEventListener('resize', resize)
  resize()
  syncCamera()

  return {
    renderer,
    scene,
    camera,
    root,
    clips: gltf.animations,
    syncCamera,
    followWindow: (on) => {
      followsWindow = on
      if (on) resize()
    },
    onResize: (fn) => {
      resizeListeners.push(fn)
      fn(window.innerWidth, window.innerHeight)
    },
  }
}
