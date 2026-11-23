import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import '../switch/switch.css'
import './illustrations.css'
import scenes from './scenes.json'

type Triple = [number, number, number]
/** How one scene is framed. */
type Staging = {
  /** The variant shown first. */
  start: string
  /** The camera, in the scene's own metres (x right, y up, z toward the viewer): where it stands, what it looks at, its lens angle. */
  view: { from: Triple; at: Triple; lens: number }
  /** The window shape (width ÷ height) the view was composed for; in a narrower window the camera steps back, up to `back` times as far. Past that the sides are cropped. */
  shape: number
  back: number
  /** A soft shaft of light standing over the middle: how strong (0 = none), how wide and how tall, metres. */
  beam: { strength: number; wide: number; tall: number }
}

/**
 * The control panel of the illustrations page: everything about how the scenes look.
 * Their shapes and words are set in blender/make_illustration.py; here each part is coloured by its material name.
 */
const settings = {
  /** Shown first, unless the address says ?scene=name. */
  start: 'signal',
  backdrop: '#050706',
  scenes: {
    signal: { start: 'wide', view: { from: [4.4, 7.1, 7.6], at: [0, 0.2, -0.8], lens: 30 }, shape: 1.15, back: 4, beam: { strength: 0, wide: 3, tall: 9 } },
    gateway: { start: 'flow', view: { from: [-2.6, 11.4, 12.8], at: [0, 0, -0.2], lens: 30 }, shape: 1.6, back: 2.2, beam: { strength: 0.014, wide: 3.4, tall: 9 } },
  } as Record<string, Staging>,
  /**
   * A card's surface: its colour at the far left, in the middle and at the near right, and how dark its sides are.
   * `edge` is the bright line round the top face (how strong, how wide in metres); `band` is the soft diagonal streak of light across it.
   */
  card: { far: '#3bcf7b', middle: '#159a54', near: '#1b8fa9', sides: 0.42, sheen: 0.06, edge: 0.2, edgeWidth: 0.022, band: 0.03 },
  /** A chip's top and sides. */
  chip: { top: '#25302b', side: '#0d1210' },
  /**
   * The ground: its colour and its dots' colour in full light. How much light reaches each part of it (the soft pool round the
   * middle, the shadows, the glow beside a card) was worked out in Blender and comes with each variant as a picture; `light` scales it all. `reach` is how many times further than the scene's own ground the sheet is drawn, so its edge is never seen.
   */
  ground: { colour: '#232b27', dot: '#59695f', light: 1, reach: 8 },
  /** The hub's plate: its colour, the faint grid on it (colour, spacing in metres), and how far in from the rim the grid has faded out (0–1). */
  plate: { colour: '#0a110e', grid: '#22332a', pitch: 0.4, fade: 0.25 },
  /**
   * The thin lines, drawn as glass tubes with light moving inside them toward the hub.
   * `glass` is the unlit tube and `rest` how bright it is; `rim` is how much brighter its outline is than its middle.
   * `light` is the moving light and `lead` the colour it shifts toward at its front; `bright` above 1 makes it glow.
   * `seconds` is how long a light takes to run a line, `apart` how many line-lengths separate one light from the next,
   * `length` how much of that gap the light's bright core fills (0–1), and `haze` how strong the wide soft light round the core is.
   */
  wire: { glass: '#9fb3a8', rest: 0.13, rim: 1.4, light: '#63f5a2', lead: '#8fe9ff', bright: 1.25, seconds: 7, apart: 1.5, length: 0.16, haze: 0.34 },
  /** Plain parts: colour, and how solid (1 = opaque). `bright` above 1 makes a part glow; `flat` marks parts with no thickness. */
  parts: {
    Outline: { colour: '#2c3b33' },
    Panel: { colour: '#04140d', opacity: 0.42 },
    Tile: { colour: '#ffffff', opacity: 0.16 },
    Ink: { colour: '#f3fff7', flat: true },
    Dim: { colour: '#f3fff7', opacity: 0.62, flat: true },
    Accent: { colour: '#9dffbf', flat: true },
    Glow: { colour: '#46f58a', bright: 1.5 },
    Ring: { colour: '#dff3e8', bright: 1.02 },
  } as Record<string, { colour: string; opacity?: number; bright?: number; flat?: boolean }>,
  /** How far (degrees) the view leans toward the pointer, and how quickly it follows. */
  look: [5, 3] as [number, number],
  ease: 3,
  /** Glow round bright parts: strength, how far it spreads, and how bright a part must be to glow. */
  bloom: { strength: 0.14, radius: 0.8, threshold: 1 },
  /** Edge smoothing, samples per pixel: 8 is the cleanest, 4 is lighter work for a phone. */
  samples: 8,
  /** The list of numbers beside the picture: a scene with more inputs than this lists its words only where a variant changes them. */
  longList: 26,
  /** Milliseconds one picture takes to fade out before the next fades in (matches the CSS). */
  swap: 300,
  maxPixelRatio: 2,
}

type Illustration = (typeof scenes)[number]
type Variant = Illustration['variants'][number]
type GroundLight = { span: number; stored: number; edge: number[] }
type Values = Record<string, number | string>
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const note = document.querySelector<HTMLElement>('#note')!
const values = document.querySelector<HTMLElement>('#values')!
const asked = new URLSearchParams(location.search)
// ?keep leaves the drawn picture readable afterwards, for saving a still of the page.
const keep = asked.has('keep')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: keep })
const scene = new THREE.Scene()
scene.background = new THREE.Color(settings.backdrop)
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 90)
const clock = { value: 0 } // seconds, shared by everything that moves

// ---- Materials ----------------------------------------------------------------
const materials = new Map<string, THREE.Material>()
for (const [name, part] of Object.entries(settings.parts)) {
  // Flat words are seen from either side; solid parts only from outside, so a see-through part never shows its own underside.
  const material = new THREE.MeshBasicMaterial({ color: part.colour, side: part.flat ? THREE.DoubleSide : THREE.FrontSide, transparent: part.opacity !== undefined, opacity: part.opacity ?? 1 })
  if (part.bright) material.color.multiplyScalar(part.bright)
  materials.set(name, material)
}
/**
 * A card: a gradient across its top, a soft sheen toward the far left, darker sides with a lighter upper edge.
 * Each point of a card says where on its card it is (_card: across, away, and 0–1 up its side) and how big that card is
 * (_shape: half its width, half its depth, its corner radius), so any number of cards of any size share this one surface.
 */
materials.set(
  'Card',
  new THREE.ShaderMaterial({
    uniforms: {
      uFar: { value: new THREE.Color(settings.card.far) },
      uMiddle: { value: new THREE.Color(settings.card.middle) },
      uNear: { value: new THREE.Color(settings.card.near) },
      uSides: { value: settings.card.sides },
      uSheen: { value: settings.card.sheen },
      uEdge: { value: new THREE.Vector2(settings.card.edge, settings.card.edgeWidth) },
      uBand: { value: settings.card.band },
    },
    vertexShader: /* glsl */ `
      attribute vec3 _card;
      attribute vec3 _shape;
      varying vec3 vCard;
      varying vec3 vShape;
      varying vec3 vFacing;
      void main() {
        vCard = _card;
        vShape = _shape;
        vFacing = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCard;
      varying vec3 vShape;
      varying vec3 vFacing;
      uniform vec3 uFar, uMiddle, uNear;
      uniform float uSides, uSheen, uBand;
      uniform vec2 uEdge;
      void main() {
        float across = vCard.x / (vShape.x * 2.0) + 0.5;    // 0 at the left edge … 1 at the right
        float toward = 0.5 - vCard.y / (vShape.y * 2.0);    // 0 at the far edge … 1 at the near edge
        float along = clamp((across + toward) * 0.5, 0.0, 1.0); // 0 at the far left corner … 1 at the near right
        vec3 colour = mix(uFar, uMiddle, smoothstep(0.0, 0.6, along));
        colour = mix(colour, uNear, smoothstep(0.5, 1.05, along) * 0.85);
        colour += uSheen * exp(-pow(distance(vec2(across, toward), vec2(0.18, 0.1)) * 2.4, 2.0)); // light falling on the far left
        float top = smoothstep(0.5, 0.9, vFacing.y);
        float round = min(vShape.z, min(vShape.x, vShape.y));
        vec2 q = abs(vCard.xy) - vShape.xy + round;
        float inside = -(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - round);                  // metres in from the card's outline
        vec3 face = colour * (0.9 + 0.1 * smoothstep(0.0, 0.6, inside));                          // the top: a little deeper toward the rim,
        face += uBand * exp(-pow((across - toward * 0.7 - 0.3) * 6.0, 2.0));                      // a streak of light lying diagonally across it,
        face += uEdge.x * smoothstep(uEdge.y, 0.0, inside) * mix(0.3, 1.0, 1.0 - toward);         // and a bright edge, strongest along the far side
        float height = clamp(vCard.z, 0.0, 1.0);
        vec3 side = colour * uSides * (0.55 + 0.75 * height * height);
        gl_FragColor = vec4(mix(side, face, top), 1.0);
        #include <colorspace_fragment>
      }`,
  }),
)
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
const onGround = /* glsl */ `
  varying vec3 vPlace;
  void main() {
    vec4 placed = modelMatrix * vec4(position, 1.0);
    vPlace = placed.xyz;
    gl_Position = projectionMatrix * viewMatrix * placed;
  }`
/**
 * The ground: its field of dots (the same rows and columns the Blender network makes), under the light Blender worked out for it.
 * That light comes as a picture of a square of ground round the middle; beyond the square the ground carries on at the light of its edge.
 */
const noLight = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
noLight.needsUpdate = true
const groundMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uColour: { value: new THREE.Color(settings.ground.colour) },
    uDot: { value: new THREE.Color(settings.ground.dot) },
    uField: { value: new THREE.Vector3(20, 0.26, 0.014) }, // across the ground, between dots, a dot's radius
    uLight: { value: noLight as THREE.Texture },
    uLit: { value: new THREE.Vector2(18, 1) },             // how much ground the picture covers, metres, and the light its brightest value stands for
    uEdge: { value: new THREE.Vector3(1, 1, 1) },          // the light at the picture's edge
  },
  vertexShader: onGround,
  fragmentShader: /* glsl */ `
    varying vec3 vPlace;
    uniform vec3 uColour, uDot, uField, uEdge;
    uniform vec2 uLit;
    uniform sampler2D uLight;
    void main() {
      float pitch = uField.x / floor(uField.x / uField.y);
      vec2 cell = (vPlace.xz + uField.x * 0.5) / pitch;
      float away = length(fract(cell + 0.5) - 0.5) * pitch;      // metres from the nearest dot's centre
      float soft = max(fwidth(away), 0.0005);
      float onDot = 1.0 - smoothstep(uField.z - soft, uField.z + soft, away);
      vec2 at = vec2(vPlace.x, -vPlace.z) / uLit.x + 0.5;        // where this point is in the picture of the light
      vec2 border = min(at, 1.0 - at);
      float within = smoothstep(0.0, 0.08, min(border.x, border.y));
      float further = length(max(abs(vPlace.xz) - uLit.x * 0.46, 0.0));   // metres beyond the picture
      vec3 beyond = uEdge / (1.0 + further * further * 0.02);             // past the picture the light goes on falling away, slowly
      vec3 light = mix(beyond, texture2D(uLight, clamp(at, 0.0, 1.0)).rgb * uLit.y, within);
      vec3 colour = mix(uColour, uDot, onDot) * light;
      // The ground is one long, dark, gentle gradient, which a screen would show as steps. A speck of unseen noise, under half of one screen level, hides them.
      float speck = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
      colour = pow(max(pow(colour, vec3(1.0 / 2.2)) + speck / 255.0, 0.0), vec3(2.2));
      gl_FragColor = vec4(colour, 1.0);
      #include <colorspace_fragment>
    }`,
})
materials.set('Ground', groundMaterial)
/** The hub's plate: dark, with a faint grid that fades out toward the rim. */
const plateMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uColour: { value: new THREE.Color(settings.plate.colour) },
    uGrid: { value: new THREE.Color(settings.plate.grid) },
    uPitch: { value: settings.plate.pitch },
    uFade: { value: settings.plate.fade },
    uRadius: { value: 1.6 },
  },
  vertexShader: onGround,
  fragmentShader: /* glsl */ `
    varying vec3 vPlace;
    uniform vec3 uColour, uGrid;
    uniform float uPitch, uFade, uRadius;
    void main() {
      vec2 cell = abs(fract(vPlace.xz / uPitch) - 0.5) * uPitch;  // metres from the nearest grid line, each way
      vec2 soft = max(fwidth(vPlace.xz), vec2(0.0005));
      vec2 lines = 1.0 - smoothstep(soft * 0.6, soft * 1.6, cell);
      float grid = max(lines.x, lines.y) * smoothstep(1.0 - uFade, 0.35, length(vPlace.xz) / uRadius);
      gl_FragColor = vec4(mix(uColour, uGrid, grid), 1.0);
      #include <colorspace_fragment>
    }`,
})
materials.set('Plate', plateMaterial)
/**
 * The thin lines: glass tubes with light moving inside. Each point says how far along its line it is (_flow.x, 0 at the hub … 1 at
 * the far end) and which line of its bundle it is on (_flow.y), so each line's light is out of step with its neighbours'.
 * The light has no hard front or back: a bright core inside a much wider, fainter haze, both fading smoothly to nothing.
 * Seen through the middle of the tube the light is at its strongest; toward the tube's outline it thins, while the glass itself brightens.
 */
materials.set(
  'Wire',
  new THREE.ShaderMaterial({
    uniforms: {
      uGlass: { value: new THREE.Color(settings.wire.glass).multiplyScalar(settings.wire.rest) },
      uRim: { value: settings.wire.rim },
      uLight: { value: new THREE.Color(settings.wire.light).multiplyScalar(settings.wire.bright) },
      uLead: { value: new THREE.Color(settings.wire.lead).multiplyScalar(settings.wire.bright) },
      uRun: { value: new THREE.Vector4(1 / settings.wire.apart, 1 / settings.wire.seconds, settings.wire.length, settings.wire.haze) },
      uTime: clock,
    },
    vertexShader: /* glsl */ `
      attribute vec3 _flow;
      varying vec3 vFlow;
      varying vec3 vNormal;
      varying vec3 vToEye;
      void main() {
        vFlow = _flow;
        vec4 seen = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalMatrix * normal;
        vToEye = -seen.xyz;
        gl_Position = projectionMatrix * seen;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vFlow;
      varying vec3 vNormal;
      varying vec3 vToEye;
      uniform vec3 uGlass, uLight, uLead;
      uniform vec4 uRun;
      uniform float uRim, uTime;
      void main() {
        float facing = clamp(dot(normalize(vNormal), normalize(vToEye)), 0.0, 1.0);   // 1 through the tube's middle … 0 at its outline
        float edge = 1.0 - facing;
        float own = fract(sin(vFlow.y * 12.9898) * 43758.5453);                        // this line's place in the rhythm
        // Where this point is within the gap between one light and the next: 0 at a light's centre, ±0.5 half way to its neighbours.
        float from = fract(vFlow.x * uRun.x + uTime * uRun.y * uRun.x + own) - 0.5;
        float core = exp(-pow(from / (uRun.z * 0.5), 2.0));
        float haze = exp(-pow(from / 0.3, 2.0)) * (0.5 + 0.5 * cos(from * 6.2831853));  // wide, and exactly nothing half way between lights
        float ends = smoothstep(0.0, 0.1, vFlow.x) * smoothstep(1.0, 0.8, vFlow.x);   // lights rise out of the far end and sink into the hub
        vec3 colour = mix(uLight, uLead, smoothstep(0.0, -uRun.z, from));               // cooler at the front, as light bends through glass
        float inside = mix(0.35, 1.0, facing * facing);                                  // the light sits in the tube's core
        vec3 lit = colour * (core * inside + haze * uRun.w * mix(0.6, 1.0, edge)) * ends; // the haze is what the glass scatters, so it reaches the outline
        float nearer = mix(1.0, 0.5, smoothstep(0.0, 1.0, vFlow.x));                   // a line is a little brighter near the hub
        vec3 glass = uGlass * nearer * (1.0 + uRim * edge * edge);
        gl_FragColor = vec4(glass + lit, 1.0);
        #include <colorspace_fragment>
      }`,
  }),
)

/** A soft shaft of light standing over the middle of the scene, always turned to face the camera. */
const beam = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0),
  new THREE.ShaderMaterial({
    uniforms: { uStrength: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vAt;
      void main() {
        vAt = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vAt;
      uniform float uStrength;
      void main() {
        float across = (vAt.x - 0.5) / mix(0.1, 0.17, vAt.y);                 // wider toward the top
        float light = exp(-across * across) * smoothstep(0.0, 0.3, vAt.y) * smoothstep(1.0, 0.45, vAt.y) * smoothstep(0.5, 0.3, abs(vAt.x - 0.5));
        gl_FragColor = vec4(vec3(0.82, 1.0, 0.9) * light * uStrength, 1.0);
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    transparent: true,
  }),
)
beam.renderOrder = 2
scene.add(beam)

// ---- Drawing: smooth edges, and a little glow round the brightest parts -----------
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: settings.samples }))
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), settings.bloom.strength, settings.bloom.radius, settings.bloom.threshold)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(bloom)
composer.addPass(new OutputPass())

// ---- Loading a variant ----------------------------------------------------------
const loader = new GLTFLoader()
const pictures = new THREE.TextureLoader()
type Shown = { model: THREE.Group; light: THREE.Texture }
const loaded = new Map<string, Promise<Shown>>()
function load(illustration: Illustration, variant: Variant): Promise<Shown> {
  const key = `${illustration.name}/${variant.name}`
  let waiting = loaded.get(key)
  if (!waiting) {
    const file = `${import.meta.env.BASE_URL}illustrations/${key}`
    waiting = Promise.all([loader.loadAsync(`${file}.glb?v=${variant.version}`), pictures.loadAsync(`${file}.webp?v=${variant.version}`)]).then(([made, light]) => {
      made.scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const part = (child.material as THREE.Material).name
        child.material = materials.get(part) ?? materials.get('Ink')!
        if (part !== 'Ground') return
        child.renderOrder = -1
        child.scale.setScalar(settings.ground.reach) // the sheet carries on, dots and all, until its light has faded out
      })
      light.colorSpace = THREE.SRGBColorSpace
      light.anisotropy = 8
      return { model: made.scene, light }
    })
    loaded.set(key, waiting)
  }
  return waiting
}

// ---- Choosing a scene and a variant ---------------------------------------------
let illustration = scenes.find((entry) => entry.name === (asked.get('scene') ?? settings.start)) ?? scenes[0]
let staging = settings.scenes[illustration.name]
let wanted: Variant = illustration.variants[0]
let current: Shown | undefined
let stepBack = 1 // how much further away the camera stands for a larger card or a narrower window
const at = new THREE.Vector3()
const armAngles = new THREE.Spherical() // from what the camera looks at, to the camera

/** Sets the page up for the picture about to be shown: the camera, and the numbers the page draws from. */
function fit() {
  const set = wanted.values as Values
  const basis = illustration.variants[0].values as Values
  at.set(...staging.view.at)
  armAngles.setFromVector3(new THREE.Vector3(...staging.view.from).sub(at))
  camera.fov = staging.view.lens
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  groundMaterial.uniforms.uField.value.set(Number(set['Ground']), Number(set['Dot Pitch']), Number(set['Dot Size']))
  const lit = wanted.ground as GroundLight
  groundMaterial.uniforms.uLit.value.set(lit.span, lit.stored * settings.ground.light)
  groundMaterial.uniforms.uEdge.value.fromArray(lit.edge).multiplyScalar(settings.ground.light)
  if (current) groundMaterial.uniforms.uLight.value = current.light
  plateMaterial.uniforms.uRadius.value = Number(set['Hub Radius'] ?? 1)
  beam.visible = staging.beam.strength > 0
  beam.scale.set(staging.beam.wide * 3, staging.beam.tall, 1)
  beam.material.uniforms.uStrength.value = staging.beam.strength
  // A bigger picture than the first variant's needs the camera further off: measured by the card, or by how far out things stand.
  const size = (from: Values) => ('Card Width' in from ? Math.hypot(Number(from['Card Width']), Number(from['Card Depth'])) : Number(from['Span'] ?? 1))
  stepBack = Math.max(size(set) / size(basis), 1) * Math.min(1 / Math.min(innerWidth / innerHeight / staging.shape, 1), staging.back)
}

const bars = { scene: document.createElement('div'), variant: document.createElement('div') }
bars.scene.className = 'styles scenes'
bars.variant.className = 'styles'
for (const [bar, label] of [[bars.scene, 'Scene'], [bars.variant, 'Variant']] as const) {
  bar.setAttribute('role', 'group')
  bar.setAttribute('aria-label', label)
}
function buttons(bar: HTMLElement, entries: { name: string; title: string }[], chosen: string, choose: (name: string) => void) {
  bar.replaceChildren(
    ...entries.map((entry) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = entry.title
      button.setAttribute('aria-pressed', String(entry.name === chosen))
      button.addEventListener('click', () => choose(entry.name))
      return button
    }),
  )
}

async function show(sceneName: string, variantName?: string | null) {
  illustration = scenes.find((entry) => entry.name === sceneName) ?? scenes[0]
  staging = settings.scenes[illustration.name]
  const first = illustration.variants[0]
  const variant = illustration.variants.find((entry) => entry.name === (variantName ?? staging.start)) ?? first
  const shownScene = illustration
  wanted = variant
  buttons(bars.scene, scenes, illustration.name, (name) => show(name))
  buttons(bars.variant, illustration.variants, variant.name, (name) => show(shownScene.name, name))
  note.textContent = illustration.note
  // The numbers and words this variant was made from; the ones that differ from the first variant are marked.
  const brief = illustration.parameters.length > settings.longList
  values.replaceChildren(
    ...illustration.parameters.flatMap(({ name: key, about }) => {
      const value = (variant.values as Values)[key]
      if (brief && typeof value === 'string' && value === (first.values as Values)[key]) return []
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
  address.searchParams.set('scene', illustration.name)
  address.searchParams.set('variant', variant.name)
  history.replaceState(null, '', address)

  canvas.classList.remove('ready')
  const [shown] = await Promise.all([load(shownScene, variant), current ? new Promise((done) => setTimeout(done, settings.swap)) : null])
  if (wanted !== variant) return // another one was chosen meanwhile
  if (current) scene.remove(current.model)
  current = shown
  scene.add(shown.model)
  fit()
  canvas.classList.add('ready')
}
document.body.append(bars.scene, bars.variant)

// ---- Size, pointer, frames ------------------------------------------------------
function resize() {
  const ratio = Math.min(devicePixelRatio, settings.maxPixelRatio)
  renderer.setPixelRatio(ratio)
  renderer.setSize(innerWidth, innerHeight, false)
  composer.setPixelRatio(ratio)
  composer.setSize(innerWidth, innerHeight)
  fit()
}
addEventListener('resize', resize)
resize()
show(illustration.name, asked.get('variant'))

const lean = { x: 0, y: 0, toX: 0, toY: 0 }
addEventListener('pointermove', (event) => {
  lean.toX = (event.clientX / innerWidth) * 2 - 1
  lean.toY = (event.clientY / innerHeight) * 2 - 1
})
addEventListener('pointerleave', () => (lean.toX = lean.toY = 0))

const still = matchMedia('(prefers-reduced-motion: reduce)').matches
let before = performance.now()
function draw(now: number) {
  const dt = Math.min((now - before) / 1000, 0.05)
  before = now
  if (!still) {
    clock.value += dt
    lean.x += (lean.toX - lean.x) * Math.min(dt * settings.ease, 1)
    lean.y += (lean.toY - lean.y) * Math.min(dt * settings.ease, 1)
  }
  const angles = new THREE.Spherical(armAngles.radius * stepBack, armAngles.phi + THREE.MathUtils.degToRad(lean.y * settings.look[1]), armAngles.theta + THREE.MathUtils.degToRad(lean.x * settings.look[0]))
  camera.position.setFromSpherical(angles).add(at)
  camera.lookAt(at)
  beam.rotation.y = Math.atan2(camera.position.x - at.x, camera.position.z - at.z)
  composer.render()
}
function frame(now: number) {
  requestAnimationFrame(frame)
  draw(now)
}
requestAnimationFrame(frame)
// With ?keep the page can also be asked to draw on the spot (a hidden tab draws no frames of its own); `at` sets the moving light's clock, in seconds.
if (keep) Object.assign(window, { drawNow: (seconds?: number) => (seconds !== undefined && (clock.value = seconds), draw(performance.now())) })
