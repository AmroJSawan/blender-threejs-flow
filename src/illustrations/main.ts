import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import '../switch/switch.css'
import './illustrations.css'
import scenes from './scenes.json'

/**
 * The control panel of the illustrations page: everything about how the scene looks.
 * Its shapes and words are set in blender/make_illustration.py; here each part is coloured by its material name.
 */
const settings = {
  /** Shown first, unless the address says ?variant=name. */
  start: 'wide',
  backdrop: '#050706',
  /**
   * The card's surface: its colour at the far left, in the middle and at the near right, and how dark its sides are.
   * `edge` is the bright line round the top face (how strong, how wide in metres); `band` is the soft diagonal streak of light across it.
   */
  card: { far: '#4ff08c', middle: '#16a558', near: '#1b9fbd', sides: 0.42, sheen: 0.13, edge: 0.32, edgeWidth: 0.022, band: 0.045 },
  /** The light the card spills on the ground: its two colours, how strong, and how far it spreads (metres). */
  spill: { left: '#1fd16a', right: '#1a9fb5', strength: 0.3, spread: 1.05 },
  /** A chip's top and sides. */
  chip: { top: '#25302b', side: '#0d1210' },
  /** Plain parts: colour, and how solid (1 = opaque). `bright` above 1 makes a part glow; `flat` marks parts with no thickness. */
  parts: {
    Ground: { colour: '#060908' },
    Dot: { colour: '#222b26', flat: true },
    Outline: { colour: '#2c3b33' },
    Panel: { colour: '#04140d', opacity: 0.42 },
    Tile: { colour: '#ffffff', opacity: 0.16 },
    Ink: { colour: '#f3fff7', flat: true },
    Dim: { colour: '#f3fff7', opacity: 0.62, flat: true },
    Accent: { colour: '#9dffbf', flat: true },
    Glow: { colour: '#46f58a', bright: 2.4 },
  } as Record<string, { colour: string; opacity?: number; bright?: number; flat?: boolean }>,
  /** The camera, in the scene's own metres (x right, y up, z toward the viewer): where it stands, what it looks at, its lens angle. */
  view: { from: [4.4, 7.1, 7.6] as [number, number, number], at: [0, 0.2, -0.8] as [number, number, number], lens: 30 },
  /** How far (degrees) the view leans toward the pointer, and how quickly it follows. */
  look: [5, 3] as [number, number],
  ease: 3,
  /** Glow round bright parts: strength, how far it spreads, and how bright a part must be to glow. */
  bloom: { strength: 0.5, radius: 0.6, threshold: 1 },
  /** Shallow focus: sharp at the card, softer with distance from it. `most` caps the blur. */
  focus: { aperture: 0.0009, most: 0.006 },
  /** Milliseconds one variant takes to fade out before the next fades in (matches the CSS). */
  swap: 300,
  maxPixelRatio: 2,
}

const illustration = scenes[0]
type Variant = (typeof illustration.variants)[number]
type Values = Record<string, number | string>
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const note = document.querySelector<HTMLElement>('#note')!
const values = document.querySelector<HTMLElement>('#values')!
// ?keep leaves the drawn picture readable afterwards, for saving a still of the page.
const keep = new URLSearchParams(location.search).has('keep')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: keep })
const scene = new THREE.Scene()
scene.background = new THREE.Color(settings.backdrop)
const camera = new THREE.PerspectiveCamera(settings.view.lens, 1, 0.5, 80)

// ---- Materials ----------------------------------------------------------------
const materials = new Map<string, THREE.Material>()
for (const [name, part] of Object.entries(settings.parts)) {
  // Flat words are seen from either side; solid parts only from outside, so a see-through part never shows its own underside.
  const material = new THREE.MeshBasicMaterial({ color: part.colour, side: part.flat ? THREE.DoubleSide : THREE.FrontSide, transparent: part.opacity !== undefined, opacity: part.opacity ?? 1 })
  if (part.bright) material.color.multiplyScalar(part.bright)
  materials.set(name, material)
}
/** The card: a gradient across its top, a soft sheen toward the far left, darker sides with a lighter upper edge. */
const cardMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uSize: { value: new THREE.Vector2(1, 1) },
    uHeights: { value: new THREE.Vector2(0, 1) }, // the card's bottom and top
    uFar: { value: new THREE.Color(settings.card.far) },
    uMiddle: { value: new THREE.Color(settings.card.middle) },
    uNear: { value: new THREE.Color(settings.card.near) },
    uSides: { value: settings.card.sides },
    uSheen: { value: settings.card.sheen },
    uRound: { value: 0.4 },
    uEdge: { value: new THREE.Vector2(settings.card.edge, settings.card.edgeWidth) },
    uBand: { value: settings.card.band },
  },
  vertexShader: /* glsl */ `
    varying vec3 vPlace;
    varying vec3 vFacing;
    void main() {
      vPlace = (modelMatrix * vec4(position, 1.0)).xyz;
      vFacing = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * vec4(vPlace, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vPlace;
    varying vec3 vFacing;
    uniform vec2 uSize, uHeights;
    uniform vec3 uFar, uMiddle, uNear;
    uniform float uSides, uSheen, uRound, uBand;
    uniform vec2 uEdge;
    void main() {
      float across = vPlace.x / uSize.x + 0.5;            // 0 at the left edge … 1 at the right
      float toward = vPlace.z / uSize.y + 0.5;            // 0 at the far edge … 1 at the near edge
      float along = clamp((across + toward) * 0.5, 0.0, 1.0); // 0 at the far left corner … 1 at the near right
      vec3 colour = mix(uFar, uMiddle, smoothstep(0.0, 0.6, along));
      colour = mix(colour, uNear, smoothstep(0.5, 1.05, along) * 0.85);
      colour += uSheen * exp(-pow(distance(vec2(across, toward), vec2(0.18, 0.1)) * 2.4, 2.0)); // light falling on the far left
      float top = smoothstep(0.5, 0.9, vFacing.y);
      vec2 q = abs(vPlace.xz) - uSize * 0.5 + uRound;
      float inside = -(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRound);                 // metres in from the card's outline
      vec3 face = colour * (0.9 + 0.1 * smoothstep(0.0, 0.6, inside));                          // the top: a little deeper toward the rim,
      face += uBand * exp(-pow((across - toward * 0.7 - 0.3) * 6.0, 2.0));                      // a streak of light lying diagonally across it,
      face += uEdge.x * smoothstep(uEdge.y, 0.0, inside) * mix(0.3, 1.0, 1.0 - toward);         // and a bright edge, strongest along the far side
      float height = clamp((vPlace.y - uHeights.x) / (uHeights.y - uHeights.x), 0.0, 1.0);
      vec3 side = colour * uSides * (0.55 + 0.75 * height * height);
      gl_FragColor = vec4(mix(side, face, top), 1.0);
      #include <colorspace_fragment>
    }`,
})
materials.set('Card', cardMaterial)
/** A chip: a dark plate with a lighter top than sides, so it reads as solid. */
materials.set(
  'Chip',
  new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(settings.chip.top) }, uSide: { value: new THREE.Color(settings.chip.side) } },
    vertexShader: /* glsl */ `
      varying float vUp;
      void main() {
        vUp = normalize(mat3(modelMatrix) * normal).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vUp;
      uniform vec3 uTop, uSide;
      void main() {
        gl_FragColor = vec4(mix(uSide, uTop, smoothstep(0.5, 0.9, vUp)), 1.0);
        #include <colorspace_fragment>
      }`,
  }),
)

/** The light the card spills on the ground: brightest under its edge, fading with distance from it. */
const spill = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  new THREE.ShaderMaterial({
    uniforms: {
      uHalf: { value: new THREE.Vector2(1, 1) },
      uRound: { value: 0.4 },
      uLeft: { value: new THREE.Color(settings.spill.left) },
      uRight: { value: new THREE.Color(settings.spill.right) },
      uStrength: { value: settings.spill.strength },
      uSpread: { value: settings.spill.spread },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPlace;
      void main() {
        vec4 placed = modelMatrix * vec4(position, 1.0);
        vPlace = placed.xz;
        gl_Position = projectionMatrix * viewMatrix * placed;
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vPlace;
      uniform vec2 uHalf;
      uniform float uRound, uStrength, uSpread;
      uniform vec3 uLeft, uRight;
      void main() {
        vec2 q = abs(vPlace) - uHalf + uRound;
        float outside = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRound; // metres outside the card's outline; negative under it
        float light = exp(-max(outside, 0.0) / uSpread * 2.2) * smoothstep(-0.9, 0.1, outside);
        vec3 colour = mix(uLeft, uRight, smoothstep(-uHalf.x, uHalf.x, vPlace.x + vPlace.y * 0.6));
        gl_FragColor = vec4(colour * light * uStrength, 1.0);
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  }),
)
spill.position.y = 0.002
spill.renderOrder = 1
scene.add(spill)

// ---- Glow and focus -------------------------------------------------------------
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }))
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), settings.bloom.strength, settings.bloom.radius, settings.bloom.threshold)
const focus = new BokehPass(scene, camera, { focus: 8, aperture: settings.focus.aperture, maxblur: settings.focus.most })
composer.addPass(new RenderPass(scene, camera))
composer.addPass(focus)
composer.addPass(bloom)
composer.addPass(new OutputPass())

// ---- Loading a variant ----------------------------------------------------------
const loader = new GLTFLoader()
const loaded = new Map<string, Promise<THREE.Group>>()
function load(variant: Variant): Promise<THREE.Group> {
  let waiting = loaded.get(variant.name)
  if (!waiting) {
    waiting = loader.loadAsync(`${import.meta.env.BASE_URL}illustrations/${illustration.name}/${variant.name}.glb?v=${variant.version}`).then((file) => {
      file.scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const part = (child.material as THREE.Material).name
        child.material = materials.get(part) ?? materials.get('Ink')!
        if (part === 'Ground') child.renderOrder = -1
      })
      return file.scene
    })
    loaded.set(variant.name, waiting)
  }
  return waiting
}

// ---- Choosing a variant ---------------------------------------------------------
const first = illustration.variants[0]
const tabs = new Map<string, HTMLButtonElement>()
let current: THREE.Group | undefined
let wanted = first
let stepBack = 1 // how much further away the camera stands for a larger card or a narrower window

function fit(variant: Variant) {
  const set = variant.values as Values
  const [wide, deep, thick, lift, round] = ['Card Width', 'Card Depth', 'Card Thick', 'Float', 'Corner'].map((key) => Number(set[key]))
  cardMaterial.uniforms.uSize.value.set(wide, deep)
  cardMaterial.uniforms.uHeights.value.set(lift, lift + thick)
  cardMaterial.uniforms.uRound.value = Math.min(round, wide / 2, deep / 2)
  const reach = settings.spill.spread * 2.5
  spill.scale.set(wide + reach * 2, 1, deep + reach * 2)
  const glow = spill.material.uniforms
  glow.uHalf.value.set(wide / 2, deep / 2)
  glow.uRound.value = Math.min(round, wide / 2, deep / 2)
  const basis = first.values as Values
  const larger = Math.hypot(wide, deep) / Math.hypot(Number(basis['Card Width']), Number(basis['Card Depth']))
  stepBack = Math.max(larger, 1) / Math.min(innerWidth / innerHeight / 1.15, 1)
}
async function show(name: string) {
  const variant = illustration.variants.find((entry) => entry.name === name) ?? first
  wanted = variant
  for (const [key, tab] of tabs) tab.setAttribute('aria-pressed', String(key === variant.name))
  // The numbers and words this variant was made from; the ones that differ from the first variant are marked.
  values.replaceChildren(
    ...illustration.parameters.flatMap(({ name: key, about }) => {
      const value = (variant.values as Values)[key]
      const term = document.createElement('dt')
      const figure = document.createElement('dd')
      term.textContent = key
      term.title = figure.title = about
      figure.textContent = String(value)
      if (value !== (first.values as Values)[key]) term.className = figure.className = 'changed'
      return [term, figure]
    }),
  )
  const address = new URL(location.href)
  address.searchParams.set('variant', variant.name)
  history.replaceState(null, '', address)

  canvas.classList.remove('ready')
  const [shown] = await Promise.all([load(variant), current ? new Promise((done) => setTimeout(done, settings.swap)) : null])
  if (wanted !== variant) return // another one was chosen meanwhile
  if (current) scene.remove(current)
  current = shown
  scene.add(shown)
  fit(variant)
  canvas.classList.add('ready')
}

const bar = document.createElement('div')
bar.className = 'styles'
bar.setAttribute('role', 'group')
bar.setAttribute('aria-label', 'Variant')
for (const variant of illustration.variants) {
  const tab = document.createElement('button')
  tab.type = 'button'
  tab.textContent = variant.title
  tab.addEventListener('click', () => show(variant.name))
  tabs.set(variant.name, tab)
  bar.append(tab)
}
document.body.append(bar)
note.textContent = illustration.note

// ---- Size, pointer, frames ------------------------------------------------------
function resize() {
  const ratio = Math.min(devicePixelRatio, settings.maxPixelRatio)
  renderer.setPixelRatio(ratio)
  renderer.setSize(innerWidth, innerHeight, false)
  composer.setPixelRatio(ratio)
  composer.setSize(innerWidth, innerHeight)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  ;(focus.uniforms as Record<string, THREE.IUniform>).aspect.value = camera.aspect
  fit(wanted)
}
addEventListener('resize', resize)
resize()
show(new URLSearchParams(location.search).get('variant') ?? settings.start)

const lean = { x: 0, y: 0, toX: 0, toY: 0 }
addEventListener('pointermove', (event) => {
  lean.toX = (event.clientX / innerWidth) * 2 - 1
  lean.toY = (event.clientY / innerHeight) * 2 - 1
})
addEventListener('pointerleave', () => (lean.toX = lean.toY = 0))

const at = new THREE.Vector3(...settings.view.at)
const arm = new THREE.Vector3(...settings.view.from).sub(at) // from what the camera looks at, to the camera
const armAngles = new THREE.Spherical().setFromVector3(arm)
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
let before = performance.now()
function draw(now: number) {
  const dt = Math.min((now - before) / 1000, 0.05)
  before = now
  if (!still) {
    lean.x += (lean.toX - lean.x) * Math.min(dt * settings.ease, 1)
    lean.y += (lean.toY - lean.y) * Math.min(dt * settings.ease, 1)
  }
  const angles = new THREE.Spherical(armAngles.radius * stepBack, armAngles.phi + THREE.MathUtils.degToRad(lean.y * settings.look[1]), armAngles.theta + THREE.MathUtils.degToRad(lean.x * settings.look[0]))
  camera.position.setFromSpherical(angles).add(at)
  camera.lookAt(at)
  ;(focus.uniforms as Record<string, THREE.IUniform>).focus.value = camera.position.distanceTo(at) * 0.97
  composer.render()
}
function frame(now: number) {
  requestAnimationFrame(frame)
  draw(now)
}
requestAnimationFrame(frame)
// With ?keep the page can also be asked to draw on the spot (a hidden tab draws no frames of its own).
if (keep) Object.assign(window, { drawNow: () => draw(performance.now()) })
