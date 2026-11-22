import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import '../switch/switch.css'

/**
 * The 3D switch. Blender (blender/make_switch.py) made the model and four pictures of the light
 * falling on it. Here the model is drawn unlit: every part shows its own colour times the baked
 * light. The knob's shadow is its own picture, slid along the floor with the knob, so it is always
 * under it. The knob blends between three pictures of itself (off, halfway, on) as it travels.
 */
const settings = {
  /** Where the model and its baked light pictures are. */
  folder: 'switch3d/',
  on: true,
  /** For checking the blend: switch3d.html?hold=0.5 freezes the knob that far along (0 off … 1 on). */
  hold: new URLSearchParams(location.search).get('hold'),
  /** Knob spring: higher stiffness = snappier, lower damping = more overshoot. */
  stiffness: 260,
  damping: 21,
  /** Camera: lens angle, how much of the window's width the switch fills, and how far (degrees) the view leans. */
  lens: 18,
  fill: 0.42,
  rest: [0, 9] as [number, number], // resting lean: sideways, and toward the viewer
  look: [16, 12] as [number, number], // extra lean at the edges of the window
  ease: 5,
  maxPixelRatio: 2,
}

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(settings.lens, 1, 0.1, 200)

// Nothing is shown until the model and every baked picture have arrived; then the switch fades in.
// Until then the page is the plain sheet (the same colour, set in CSS), never a black or half-lit view.
const arriving = new THREE.LoadingManager(() => canvas.classList.add('ready'))
scene.background = new THREE.Color().setRGB(0.83, 0.83, 0.84) // the sheet; replaced by the model's own value once loaded
const pictures = new THREE.TextureLoader(arriving)
const picture = (name: string) => {
  const texture = pictures.load(`${settings.folder}${name}.webp`)
  texture.flipY = false // glTF layout
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}
/** 0 = knob off … 1 = on, shared by every part. */
const uMix = { value: Number(settings.on) }
const uOpen = { value: 0.6 }
/** Where the knob is along the track (model units), and the size of floor its shadow picture covers. */
const uKnobX = { value: 0 }
const uShadowSpan = { value: new THREE.Vector2(3.4, 2.2) }
const shadow = pictures.load(`${settings.folder}knob-shadow.webp`)
shadow.colorSpace = THREE.SRGBColorSpace
function lit(part: 'base' | 'knob', colour: THREE.Color, fades = false) {
  return new THREE.ShaderMaterial({
    defines: part === 'base' ? { BASE: '' } : {},
    uniforms: {
      uOn: { value: picture(`${part}-on`) },
      uMid: { value: part === 'knob' ? picture('knob-mid') : null },
      uOff: { value: picture(`${part}-off`) },
      uShadow: { value: shadow },
      uShadowSpan,
      uKnobX,
      uMix,
      uOpen,
      uColour: { value: colour },
      uFades: { value: fades ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vPlace;
      void main() {
        vUv = uv;
        vPlace = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vPlace;
      uniform float uFades;     // 1 on the sheet: its baked light eases to plain toward the model's edge, where the page takes over
      uniform sampler2D uOn;    // baked light, on
      uniform sampler2D uMid;   // … halfway (knob only)
      uniform sampler2D uOff;   // … and off
      uniform sampler2D uShadow; // how much the knob darkens the floor around it
      uniform vec2 uShadowSpan;
      uniform float uKnobX;
      uniform float uMix;
      uniform float uOpen;      // the value open, unshaded sheet was stored at
      uniform vec3 uColour;
      void main() {
        float at = clamp(uMix, 0.0, 1.0);
        #ifdef BASE
          // Baked without the knob (only the floor's colour differs between the two); the knob's shadow is laid over it.
          vec3 light = mix(texture2D(uOff, vUv).rgb, texture2D(uOn, vUv).rgb, at);
          vec2 around = vec2(vPlace.x - uKnobX, -vPlace.z) / uShadowSpan + 0.5;
          float inPit = smoothstep(-0.02, -0.12, vPlace.y); // the shadow lies in the track, not on the sheet
          light *= mix(1.0, texture2D(uShadow, around).r, inPit);
        #else
          vec3 light = mix(mix(texture2D(uOff, vUv).rgb, texture2D(uMid, vUv).rgb, min(at * 2.0, 1.0)), texture2D(uOn, vUv).rgb, max(at * 2.0 - 1.0, 0.0));
        #endif
        light /= uOpen;
        float beyond = length(vec2(max(abs(vPlace.x) - 0.72, 0.0), vPlace.z)) - 0.89; // distance outside the track's rim
        light = mix(light, vec3(1.0), uFades * smoothstep(0.08, 0.36, beyond));
        gl_FragColor = vec4(uColour * light, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

let knob: THREE.Object3D | undefined
let travel = 0.72
const floor = { colour: new THREE.Color(), on: new THREE.Color(), off: new THREE.Color() }
new GLTFLoader(arriving).load(`${settings.folder}switch.glb`, (gltf) => {
  const base = gltf.scene.getObjectByName('Base')!
  knob = gltf.scene.getObjectByName('Knob')!
  // Numbers the Blender script attached to the model.
  travel = base.userData.travel ?? travel
  uOpen.value = base.userData.open ?? uOpen.value
  if (base.userData.shadowSpan) uShadowSpan.value.fromArray(base.userData.shadowSpan)
  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const made = object.material as THREE.MeshStandardMaterial
    const part = object === knob || object.parent === knob ? 'knob' : 'base'
    if (made.name === 'Floor') {
      floor.on.copy(made.color)
      floor.off.setRGB(...(base.userData.floorOff as [number, number, number]), THREE.SRGBColorSpace)
      object.material = lit(part, floor.colour)
    } else {
      if (made.name === 'Sheet') scene.background = made.color.clone() // the page continues the sheet
      object.material = lit(part, made.color.clone(), made.name === 'Sheet')
    }
  })
  scene.add(gltf.scene)
})

// The real control: an invisible button over the switch, so keyboards and screen readers work.
const control = document.createElement('button')
control.type = 'button'
control.className = 'control'
control.setAttribute('role', 'switch')
control.setAttribute('aria-label', 'Switch')
const state = { on: settings.on, at: Number(settings.on), speed: 0 }
control.setAttribute('aria-checked', String(state.on))
control.addEventListener('click', () => {
  state.on = !state.on
  control.setAttribute('aria-checked', String(state.on))
})
document.body.append(control)

let distance = 20
function resize() {
  const width = innerWidth
  const height = innerHeight
  renderer.setPixelRatio(Math.min(devicePixelRatio, settings.maxPixelRatio))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  // Far enough that the switch (3.3 units long, 1.8 high) fills its share of the window.
  const fill = Math.min(settings.fill, (0.3 * height) / width * (3.3 / 1.8))
  const span = 3.3 / fill // world width of the view at the switch
  distance = span / (2 * Math.tan(THREE.MathUtils.degToRad(settings.lens / 2)) * camera.aspect)
}
addEventListener('resize', resize)
resize()

// The view leans toward the pointer.
const lean = { x: 0, y: 0, toX: 0, toY: 0 }
addEventListener('pointermove', (event) => {
  lean.toX = (event.clientX / innerWidth) * 2 - 1
  lean.toY = (event.clientY / innerHeight) * 2 - 1
})
addEventListener('pointerleave', () => (lean.toX = lean.toY = 0))

let before = performance.now()
function frame(now: number) {
  requestAnimationFrame(frame)
  const dt = Math.min((now - before) / 1000, 0.05)
  before = now
  state.speed += ((Number(state.on) - state.at) * settings.stiffness - state.speed * settings.damping) * dt
  state.at += state.speed * dt
  if (settings.hold !== null) state.at = Number(settings.hold)
  uMix.value = state.at
  uKnobX.value = (state.at * 2 - 1) * travel
  if (knob) knob.position.x = uKnobX.value
  floor.colour.lerpColors(floor.off, floor.on, THREE.MathUtils.smoothstep(state.at, 0.1, 0.9))

  lean.x += (lean.toX - lean.x) * Math.min(dt * settings.ease, 1)
  lean.y += (lean.toY - lean.y) * Math.min(dt * settings.ease, 1)
  const sideways = THREE.MathUtils.degToRad(settings.rest[0] + lean.x * settings.look[0])
  const toward = THREE.MathUtils.degToRad(settings.rest[1] + lean.y * settings.look[1])
  // The sheet lies flat (its face is +Y, its top edge is -Z); the camera hovers over it.
  const centre = new THREE.Vector3(0, 0, 0.12)
  camera.position.set(Math.sin(sideways) * Math.cos(toward), Math.cos(sideways) * Math.cos(toward), Math.sin(toward)).multiplyScalar(distance).add(centre)
  camera.up.set(0, 0, -1)
  camera.lookAt(centre)
  renderer.render(scene, camera)

  // Keep the real button exactly over the switch as the view leans.
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity
  for (const [x, z] of [[-1.65, -0.9], [1.65, -0.9], [1.65, 0.9], [-1.65, 0.9]]) {
    corner.set(x, 0, z).project(camera)
    const px = (corner.x * 0.5 + 0.5) * innerWidth
    const py = (0.5 - corner.y * 0.5) * innerHeight
    left = Math.min(left, px)
    right = Math.max(right, px)
    top = Math.min(top, py)
    bottom = Math.max(bottom, py)
  }
  control.style.left = `${left}px`
  control.style.top = `${top}px`
  control.style.width = `${right - left}px`
  control.style.height = `${bottom - top}px`
}
const corner = new THREE.Vector3()
requestAnimationFrame(frame)
