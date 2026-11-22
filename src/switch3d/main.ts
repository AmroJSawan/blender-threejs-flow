import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import '../switch/switch.css'
import styles from './styles.json'

/**
 * The 3D switches. Blender (blender/make_switch.py) made each model and pictures of the light
 * falling on it. Here a model is drawn unlit: every part shows its own colour times the baked
 * light. A sliding knob's shadow is its own picture, slid along the floor with the knob, so it is
 * always under it. The moving part blends between three pictures of itself (off, halfway, on).
 * The list of styles (styles.json) is written by the Blender script.
 */
const settings = {
  /** Where the models are: one folder per style, each with switch.glb and its baked light pictures. */
  folder: 'switch3d/',
  /** The style shown first (unless the address says ?style=name), and whether it starts on. */
  start: 'knurled',
  on: true,
  /** For checking the blend: switch3d.html?hold=0.5 freezes the knob that far along (0 off … 1 on). */
  hold: new URLSearchParams(location.search).get('hold'),
  /** Knob spring: higher stiffness = snappier, lower damping = more overshoot. */
  stiffness: 260,
  damping: 21,
  /** Camera: lens angle, how much of the window's width a switch fills, and how far (degrees) the view leans. */
  lens: 18,
  fill: 0.42,
  rest: [0, 9] as [number, number], // resting lean: sideways, and toward the viewer
  look: [16, 12] as [number, number], // extra lean at the edges of the window
  ease: 5,
  /** Direction to the light (the same as in Blender), for the soft reflection on glazed parts. */
  light: [-0.26, 0.64, -0.72] as [number, number, number],
  /** Milliseconds one style takes to fade out before the next fades in (matches the CSS). */
  swap: 350,
  maxPixelRatio: 2,
}

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const note = document.querySelector<HTMLElement>('#note')!
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(settings.lens, 1, 1, 200)
const plain = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
plain.needsUpdate = true

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPlace;
  varying vec3 vNormal;
  varying vec3 vToEye;
  void main() {
    vUv = uv;
    vPlace = position;
    vec4 seen = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalMatrix * normal;
    vToEye = -seen.xyz;
    gl_Position = projectionMatrix * seen;
  }`
const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPlace;
  varying vec3 vNormal;
  varying vec3 vToEye;
  uniform sampler2D uOn;     // baked light, on
  uniform sampler2D uMid;    // … halfway (moving part only)
  uniform sampler2D uOff;    // … and off
  uniform sampler2D uShadow; // how much a sliding knob darkens the floor around it
  uniform vec2 uShadowSpan;  // size of the patch of floor that picture covers
  uniform float uShadowed;   // 1 if this style has such a picture
  uniform float uKnobX;      // where the knob is along its track
  uniform vec3 uPit;         // outline of the part of the base the knob's shadow can fall in: half size, corner radius
  uniform vec3 uRim;         // outline of the whole switch
  uniform float uSheet;      // how far the modelled sheet reaches beyond that
  uniform float uFades;      // 1 on the sheet: its baked light eases to plain toward the model's edge, where the page takes over
  uniform float uMix;        // 0 off … 1 on
  uniform float uBlend;      // the same, eased, for colours and lamps
  uniform float uOpen;       // the value open, unshaded sheet was stored at
  uniform vec3 uColour;      // this part's colour (when on)
  uniform vec3 uOffColour;   // … and when off
  uniform float uGlow;       // 1 for a lamp: lit when on
  uniform float uGloss;      // strength of the soft reflection of the light on a glazed part
  uniform vec3 uLight;

  /** Distance outside a rounded rectangle (negative inside). */
  float outside(vec2 p, vec3 shape) {
    vec2 q = abs(p) - (shape.xy - shape.z);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - shape.z;
  }

  void main() {
    float at = clamp(uMix, 0.0, 1.0);
    #ifdef BASE
      vec3 light = mix(texture2D(uOff, vUv).rgb, texture2D(uOn, vUv).rgb, at);
      vec2 around = vec2(vPlace.x - uKnobX, -vPlace.z) / uShadowSpan + 0.5;
      float inPit = uShadowed * smoothstep(-0.01, -0.08, outside(vPlace.xz, uPit));
      light *= mix(1.0, texture2D(uShadow, around).r, inPit);
      light /= uOpen;
      light = mix(light, vec3(1.0), uFades * smoothstep(0.2 * uSheet, 0.9 * uSheet, outside(vPlace.xz, uRim)));
    #else
      vec3 light = mix(mix(texture2D(uOff, vUv).rgb, texture2D(uMid, vUv).rgb, min(at * 2.0, 1.0)), texture2D(uOn, vUv).rgb, max(at * 2.0 - 1.0, 0.0));
      light /= uOpen;
    #endif
    vec3 colour = mix(uOffColour, uColour, uBlend) * light;
    colour = mix(colour, uColour, uGlow * uBlend);
    vec3 toLight = normalize((viewMatrix * vec4(uLight, 0.0)).xyz);
    float facing = max(dot(normalize(vNormal), normalize(toLight + normalize(vToEye))), 0.0);
    colour += uGloss * pow(facing, 30.0) * min(light.g, 1.0);
    gl_FragColor = vec4(colour, 1.0);
    #include <colorspace_fragment>
  }`

type Style = (typeof styles)[number]
type Shape = [number, number, number]
/** One style, loaded: its model and the numbers the Blender script attached to it. */
type Loaded = {
  model: THREE.Object3D
  knob: THREE.Object3D
  travel: number // how far a sliding knob moves each way …
  tilt: number // … or how far a rocker tips, radians
  rim: Shape
  sheet: THREE.Color
  uMix: { value: number }
  uBlend: { value: number }
  uKnobX: { value: number }
}

/** Loads a style once; resolves when its model and every baked picture have arrived. */
const loading = new Map<string, Promise<Loaded>>()
function load(style: Style): Promise<Loaded> {
  let promise = loading.get(style.name)
  if (promise) return promise
  promise = new Promise((resolve) => {
    const folder = `${settings.folder}${style.name}/`
    let loaded: Loaded
    const arriving = new THREE.LoadingManager(() => resolve(loaded))
    const loader = new THREE.TextureLoader(arriving)
    const pictures = new Map<string, THREE.Texture>()
    const picture = (name: string, modelLayout = true) => {
      let texture = pictures.get(name)
      if (!texture) {
        texture = loader.load(`${folder}${name}.webp`)
        texture.flipY = !modelLayout
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = 8
        pictures.set(name, texture)
      }
      return texture
    }
    new GLTFLoader(arriving).load(`${folder}switch.glb`, (gltf) => {
      const base = gltf.scene.getObjectByName('Base')!
      const knob = gltf.scene.getObjectByName('Knob')!
      const about = base.userData
      const slides = about.travel !== undefined
      const rim: Shape = about.rim
      const shared = {
        uShadow: { value: slides ? picture('knob-shadow', false) : plain },
        uShadowSpan: { value: new THREE.Vector2(...((about.shadowSpan as [number, number] | undefined) ?? [1, 1])) },
        uShadowed: { value: Number(slides) },
        uKnobX: { value: 0 },
        uPit: { value: new THREE.Vector3(...((about.pit as Shape | undefined) ?? rim)) },
        uRim: { value: new THREE.Vector3(...rim) },
        uSheet: { value: about.sheet as number },
        uMix: { value: 0 },
        uBlend: { value: 0 },
        uOpen: { value: about.open as number },
        uLight: { value: new THREE.Vector3(...settings.light).normalize() },
      }
      let sheet = new THREE.Color(style.sheet)
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const made = object.material as THREE.MeshStandardMaterial
        const part = object === knob || object.parent === knob ? 'knob' : 'base'
        const off = made.userData.off as Shape | undefined
        if (made.name === 'Sheet') sheet = made.color.clone() // the page continues the sheet in this colour
        object.material = new THREE.ShaderMaterial({
          defines: part === 'base' ? { BASE: '' } : {},
          uniforms: {
            ...shared,
            uOn: { value: picture(`${part}-on`) },
            uMid: { value: part === 'knob' ? picture('knob-mid') : plain },
            uOff: { value: picture(`${part}-off`) },
            uColour: { value: made.color.clone() },
            uOffColour: { value: off ? new THREE.Color().setRGB(...off) : made.color.clone() },
            uGlow: { value: made.userData.glow ?? 0 },
            uGloss: { value: made.userData.gloss ?? 0 },
            uFades: { value: Number(made.name === 'Sheet') },
          },
          vertexShader,
          fragmentShader,
        })
      })
      loaded = { model: gltf.scene, knob, travel: about.travel ?? 0, tilt: about.tilt ?? 0, rim, sheet, uMix: shared.uMix, uBlend: shared.uBlend, uKnobX: shared.uKnobX }
    })
  })
  loading.set(style.name, promise)
  return promise
}

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

// ---- Styles -----------------------------------------------------------------
// Nothing is shown until a style's model and every baked picture have arrived; then it fades in.
// Until then the page is the plain sheet in that style's colour, never a black or half-lit view.
const tabs = new Map<string, HTMLButtonElement>()
let current: Loaded | undefined
let wanted = styles[0]
async function show(name: string) {
  const style = styles.find((entry) => entry.name === name) ?? styles.find((entry) => entry.name === settings.start) ?? styles[0]
  wanted = style
  note.textContent = style.note
  document.body.classList.toggle('ink-light', style.ink === 'light')
  document.body.style.backgroundColor = style.sheet
  for (const [key, tab] of tabs) tab.setAttribute('aria-pressed', String(key === style.name))
  tabs.get(style.name)?.scrollIntoView({ block: 'nearest', inline: 'center' })
  // The address keeps the choice, so a style can be shared as a link.
  const address = new URL(location.href)
  address.searchParams.set('style', style.name)
  history.replaceState(null, '', address)

  canvas.classList.remove('ready')
  const fadedOut = new Promise((done) => setTimeout(done, current ? settings.swap : 0))
  const [loaded] = await Promise.all([load(style), fadedOut])
  if (wanted !== style) return // another style was chosen meanwhile
  if (current) scene.remove(current.model)
  current = loaded
  scene.add(loaded.model)
  scene.background = loaded.sheet
  canvas.classList.add('ready')
}
const bar = document.createElement('div')
bar.className = 'styles'
bar.setAttribute('role', 'group')
bar.setAttribute('aria-label', 'Switch style')
for (const style of styles) {
  const tab = document.createElement('button')
  tab.type = 'button'
  tab.textContent = style.title
  tab.addEventListener('click', () => show(style.name))
  tabs.set(style.name, tab)
  bar.append(tab)
}
document.body.append(bar)
addEventListener('keydown', (event) => {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (step) show(styles[(styles.indexOf(wanted) + step + styles.length) % styles.length].name)
})
show(new URLSearchParams(location.search).get('style') ?? settings.start)

// ---- Size -------------------------------------------------------------------
let distance = 20
function resize() {
  const width = innerWidth
  const height = innerHeight
  renderer.setPixelRatio(Math.min(devicePixelRatio, settings.maxPixelRatio))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  // Far enough that a switch (about 3.3 units long, 1.8 high) fills its share of the window.
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

// ---- Every frame ------------------------------------------------------------
const centre = new THREE.Vector3(0, 0, 0.12)
const corner = new THREE.Vector3()
let before = performance.now()
function frame(now: number) {
  requestAnimationFrame(frame)
  const dt = Math.min((now - before) / 1000, 0.05)
  before = now
  state.speed += ((Number(state.on) - state.at) * settings.stiffness - state.speed * settings.damping) * dt
  state.at += state.speed * dt
  if (settings.hold !== null) state.at = Number(settings.hold)
  if (current) {
    current.uMix.value = state.at
    current.uBlend.value = THREE.MathUtils.smoothstep(state.at, 0.1, 0.9)
    current.uKnobX.value = (state.at * 2 - 1) * current.travel
    current.knob.position.x = current.uKnobX.value
    current.knob.rotation.z = -(state.at * 2 - 1) * current.tilt
  }

  lean.x += (lean.toX - lean.x) * Math.min(dt * settings.ease, 1)
  lean.y += (lean.toY - lean.y) * Math.min(dt * settings.ease, 1)
  const sideways = THREE.MathUtils.degToRad(settings.rest[0] + lean.x * settings.look[0])
  const toward = THREE.MathUtils.degToRad(settings.rest[1] + lean.y * settings.look[1])
  // The sheet lies flat (its face is +Y, its top edge is -Z); the camera hovers over it.
  camera.position.set(Math.sin(sideways) * Math.cos(toward), Math.cos(sideways) * Math.cos(toward), Math.sin(toward)).multiplyScalar(distance).add(centre)
  camera.up.set(0, 0, -1)
  camera.lookAt(centre)
  renderer.render(scene, camera)

  // Keep the real button exactly over the switch as the view leans.
  const [halfX, halfY] = current?.rim ?? [1.65, 0.9]
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    corner.set(x * halfX, 0, z * halfY).project(camera)
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
requestAnimationFrame(frame)
