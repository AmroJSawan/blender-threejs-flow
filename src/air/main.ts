import * as THREE from 'three'
import './air.css'

/**
 * Air, drawn as fine wires of light. The look follows a generative piece by Rey Rad (hair-thin lines gathering into silk, with
 * a fringe of colour at bright edges), but nothing here is left to chance: the air follows a path that is drawn.
 *
 * - The path is a curve led by a few chosen points (`settings.path`): out of the vent on the left, up, down and away to the right.
 * - The air is a ribbon of lanes laid side by side along that curve, evenly spaced, each one a single unbroken wire.
 *   It is narrow at the vent and opens as it goes.
 * - Part way along it meets a body it cannot pass through. The lanes part round it and close again behind, as air does round a wing:
 *   that is the dark eye in the ribbon.
 * - A slow swell runs down the ribbon, the same for neighbouring lanes, so it moves as one sheet.
 * - Brighter runs travel along each wire, faster with the fan. More fan also opens more lanes.
 * - A finger pushes the wires near it aside; they close again when it leaves.
 * Each frame the wires are added onto a picture that fades quickly, a soft copy is added as glow, and red is read from a little
 * further out than blue, which gives the bright edges their fringe of colour.
 */
const settings = {
  /** The path, as points that lead the curve (x across, y up; 1 is half the shorter side of the window). It runs near them, not through them. */
  path: [[-2.6, -0.62], [-1.7, -0.45], [-0.8, 0.34], [0.0, 0.08], [0.8, -0.42], [1.7, 0.16], [2.6, 0.5]] as [number, number][],
  /** How many wires, and how many steps each is drawn in. */
  lanes: 150,
  steps: 260,
  /** How wide the ribbon is at its widest with the fan full, and how much of that it has with the fan off. */
  wide: 0.46,
  least: 0.3,
  /** The body the air parts round: where along the path it is (0–1) and how big. */
  body: { at: 0.56, size: 0.13 },
  /** The swell that runs down the ribbon: how far it moves the wires, and how fast. */
  swell: 0.022,
  /** How fast the bright runs travel at fan level 0 and how much each level adds (path lengths a second). */
  speed: 0.05,
  perLevel: 0.05,
  levels: 7,
  start: 3,
  /** A wire's brightness; how much of the picture is left after a 60th of a second (nearer 1 = softer, more smeared). */
  dot: 0.085,
  stays: 0.8,
  /** Toning: how strongly the picture is brightened, the colour fringe (how much further out red is read than blue), and the glow. */
  gain: 1.5,
  fringe: 0.009,
  glow: 0.36,
  /** A finger's push: how far it reaches and how far it moves the wires. */
  reach: 0.26,
  push: 0.11,
  maxPixelRatio: 2,
}

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
renderer.autoClear = false
const flat = new THREE.Camera()
const quad = new THREE.PlaneGeometry(2, 2)
const pass = (material: THREE.Material) => {
  const mesh = new THREE.Mesh(quad, material)
  mesh.frustumCulled = false
  return new THREE.Scene().add(mesh)
}
const full = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

const target = (wide: number, tall: number, type: THREE.TextureDataType, filter: THREE.MagnificationTextureFilter) =>
  new THREE.WebGLRenderTarget(wide, tall, { type, format: THREE.RGBAFormat, minFilter: filter, magFilter: filter, depthBuffer: false })

// ---- The wires: every lane is one line along the path, each of its points knowing how far along it is and which lane it is in ----
const along = new Float32Array(settings.lanes * settings.steps)
const lane = new Float32Array(settings.lanes * settings.steps)
const joins: number[] = []
for (let row = 0; row < settings.lanes; row++)
  for (let step = 0; step < settings.steps; step++) {
    const at = row * settings.steps + step
    along[at] = step / (settings.steps - 1)
    lane[at] = (row / (settings.lanes - 1)) * 2 - 1
    if (step) joins.push(at - 1, at)
  }
const wires = new THREE.BufferGeometry()
wires.setAttribute('position', new THREE.BufferAttribute(new Float32Array(settings.lanes * settings.steps * 3), 3))
wires.setAttribute('along', new THREE.BufferAttribute(along, 1))
wires.setAttribute('lane', new THREE.BufferAttribute(lane, 1))
wires.setIndex(joins)
const count = settings.path.length
const dots = new THREE.ShaderMaterial({
  blending: THREE.AdditiveBlending,
  depthTest: false,
  transparent: true,
  uniforms: {
    uPath: { value: settings.path.map(([x, y]) => new THREE.Vector2(x, y)) },
    uShape: { value: new THREE.Vector2(1, 1) },
    uUpright: { value: 0 },
    uTime: { value: 0 },
    uRun: { value: 0 }, // how far the bright runs have travelled
    uFan: { value: settings.start / settings.levels },
    uWide: { value: new THREE.Vector2(settings.wide, settings.least) },
    uBody: { value: new THREE.Vector2(settings.body.at, settings.body.size) },
    uSwell: { value: settings.swell },
    uDot: { value: settings.dot },
    uFinger: { value: new THREE.Vector4() }, // where it is (x, y), how hard it pushes
    uReach: { value: new THREE.Vector2(settings.reach, settings.push) },
  },
  vertexShader: /* glsl */ `
    attribute float along, lane;
    uniform vec2 uPath[${count}], uShape, uWide, uBody, uReach;
    uniform float uUpright, uTime, uRun, uFan, uSwell;
    uniform vec4 uFinger;
    varying float vLight;
    // The drawn path: a smooth curve led by the chosen points.
    vec2 path(float t) {
      float f = clamp(t, 0.0, 1.0) * float(${count - 3});
      int i = int(min(floor(f), float(${count - 4})));
      float u = f - float(i);
      vec2 a, b, c, d;
      for (int k = 0; k < ${count - 3}; k++) if (k == i) { a = uPath[k]; b = uPath[k + 1]; c = uPath[k + 2]; d = uPath[k + 3]; }
      // a curve whose bending changes smoothly too, so lanes far from the middle have no kinks where its pieces meet
      float v = 1.0 - u;
      return (v * v * v * a + (3.0 * u * u * u - 6.0 * u * u + 4.0) * b + (-3.0 * u * u * u + 3.0 * u * u + 3.0 * u + 1.0) * c + u * u * u * d) / 6.0;
    }
    void main() {
      vec2 middle = path(along);
      vec2 heading = normalize(path(along + 0.004) - path(along - 0.004));
      vec2 side = vec2(-heading.y, heading.x);
      // Narrow at the vent, opening as it goes; wider with more fan.
      float wide = uWide.x * mix(uWide.y, 1.0, uFan) * (0.16 + 0.84 * smoothstep(0.0, 0.3, along));
      float across = lane * wide;
      // The body in its way: the lanes part round it and close again behind.
      float ahead = (along - uBody.x) * 1.5;   // drawn out along the path, so the lanes part and close gently
      across += uBody.y * uBody.y * across / (ahead * ahead + across * across + 0.006);
      // One slow swell down the whole ribbon.
      across += uSwell * sin(6.2831853 * (along * 1.6 - uTime * 0.06) + lane * 1.6) * smoothstep(0.08, 0.5, along);
      vec2 p = middle + side * across;
      // A finger pushes the wires near it aside.
      // A finger parts the wires sideways, as another body would: those on one side of it go one way, the rest the other.
      vec2 from = p - uFinger.xy;
      float beside = dot(from, side);
      p += side * (beside / (abs(beside) + 0.03)) * uFinger.z * uReach.y * exp(-dot(from, from) / (uReach.x * uReach.x));
      if (uUpright > 0.5) p = vec2(-p.y, p.x);
      gl_Position = vec4(p * uShape, 0.0, 1.0);
      // Brighter runs travel along each wire; lanes further out only appear as the fan rises; the ribbon's two edges are its brightest wires.
      float own = fract(sin(lane * 91.7) * 43758.5453);
      float run = 0.3 + 0.7 * pow(0.5 + 0.5 * cos(6.2831853 * (along * 2.6 - uRun + own)), 3.0);
      float open = smoothstep(0.02, -0.12, abs(lane) - (0.3 + 0.7 * uFan));
      float rim = mix(1.0, 2.6, pow(abs(lane), 8.0));
      vLight = run * open * rim * smoothstep(0.0, 0.05, along) * smoothstep(1.0, 0.86, along);
    }`,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform float uDot;
    varying float vLight;
    void main() { gl_FragColor = vec4(vec3(uDot * vLight), 1.0); }`,
})
const lines = new THREE.LineSegments(wires, dots)
lines.frustumCulled = false
const drawing = new THREE.Scene().add(lines)
const fade = new THREE.ShaderMaterial({
  uniforms: { uBefore: { value: null as THREE.Texture | null }, uStays: { value: settings.stays } },
  vertexShader: full,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uBefore;
    uniform float uStays;
    void main() { gl_FragColor = vec4(texture2D(uBefore, vUv).rgb * uStays, 1.0); }`,
})
const fading = pass(fade)
let trails: THREE.WebGLRenderTarget[] = []
let soft: THREE.WebGLRenderTarget[] = []

// ---- Toning: a soft copy for the glow, then the fringe of colour ----
const blur = new THREE.ShaderMaterial({
  uniforms: { uFrom: { value: null as THREE.Texture | null }, uWay: { value: new THREE.Vector2() } },
  vertexShader: full,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uFrom;
    uniform vec2 uWay;
    void main() {
      vec3 sum = texture2D(uFrom, vUv).rgb * 0.227;
      sum += (texture2D(uFrom, vUv + uWay * 1.385).rgb + texture2D(uFrom, vUv - uWay * 1.385).rgb) * 0.316;
      sum += (texture2D(uFrom, vUv + uWay * 3.231).rgb + texture2D(uFrom, vUv - uWay * 3.231).rgb) * 0.0703;
      gl_FragColor = vec4(sum, 1.0);
    }`,
})
const blurring = pass(blur)
const tone = new THREE.ShaderMaterial({
  uniforms: { uLines: { value: null as THREE.Texture | null }, uSoft: { value: null as THREE.Texture | null }, uLook: { value: new THREE.Vector3(settings.gain, settings.fringe, settings.glow) } },
  vertexShader: full,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uLines, uSoft;
    uniform vec3 uLook;
    float both(vec2 at) { return texture2D(uLines, at).r + texture2D(uSoft, at).r * uLook.z; }
    void main() {
      // Red is read from a little further out than green, and blue from a little further in: bright edges split into colour.
      vec2 out_ = vUv - 0.5;
      vec3 light = vec3(both(0.5 + out_ * (1.0 - uLook.y)), both(vUv), both(0.5 + out_ * (1.0 + uLook.y)));
      // The glow alone carries more of the fringe than the lines do, as in a lens.
      vec3 halo = vec3(texture2D(uSoft, 0.5 + out_ * (1.0 - uLook.y * 2.2)).r, texture2D(uSoft, vUv).r * 0.72, texture2D(uSoft, 0.5 + out_ * (1.0 + uLook.y * 2.2)).r * 1.15) * uLook.z;
      vec3 colour = 1.0 - exp(-(light + halo * vec3(1.15, 0.85, 1.0)) * uLook.x);
      colour += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
      gl_FragColor = vec4(colour, 1.0);
      #include <colorspace_fragment>
    }`,
})
const toning = pass(tone)

// ---- Size, the fan's level, a finger ----
const shape = new THREE.Vector2(1, 1)
function resize() {
  const ratio = Math.min(devicePixelRatio, settings.maxPixelRatio)
  renderer.setPixelRatio(ratio)
  renderer.setSize(innerWidth, innerHeight, false)
  const wide = Math.round(innerWidth * ratio)
  const tall = Math.round(innerHeight * ratio)
  for (const each of [...trails, ...soft]) each.dispose()
  trails = [0, 1].map(() => target(wide, tall, THREE.HalfFloatType, THREE.LinearFilter))
  soft = [0, 1].map(() => target(Math.round(wide / 4), Math.round(tall / 4), THREE.HalfFloatType, THREE.LinearFilter))
  // The ring is as wide as the shorter side of the window, whichever that is.
  shape.set(Math.min(1, innerHeight / innerWidth), Math.min(1, innerWidth / innerHeight))
  dots.uniforms.uShape.value.copy(shape)
  dots.uniforms.uUpright.value = innerHeight > innerWidth ? 1 : 0
}
addEventListener('resize', resize)
resize()

let level = settings.start
const bar = document.querySelector('#levels')!
for (let each = 0; each <= settings.levels; each++) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = String(each)
  button.setAttribute('aria-pressed', String(each === level))
  button.addEventListener('click', () => {
    level = each
    bar.querySelectorAll('button').forEach((other, at) => other.setAttribute('aria-pressed', String(at === each)))
  })
  bar.append(button)
}

const finger = { x: 0, y: 0, down: false, push: 0 }
function where(event: PointerEvent) {
  const x = ((event.clientX / innerWidth) * 2 - 1) / shape.x
  const y = (1 - (event.clientY / innerHeight) * 2) / shape.y
  return innerHeight > innerWidth ? { x: y, y: -x } : { x, y } // an upright window shows the path turned a quarter
}
canvas.addEventListener('pointerdown', (event) => {
  Object.assign(finger, where(event), { down: true })
  canvas.setPointerCapture(event.pointerId)
})
canvas.addEventListener('pointermove', (event) => {
  if (finger.down) Object.assign(finger, where(event))
})
const lift = () => (finger.down = false)
canvas.addEventListener('pointerup', lift)
canvas.addEventListener('pointercancel', lift)

// ---- Frames ----
let before = performance.now()
let fan = settings.start / settings.levels
let turn = 0
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
function draw(now: number) {
  const passed = Math.min((now - before) / 1000, 1 / 30) * (still ? 0.25 : 1)
  before = now
  const u = dots.uniforms
  fan += (level / settings.levels - fan) * Math.min(passed * 2.5, 1)
  finger.push += ((finger.down ? 1 : 0) - finger.push) * Math.min(passed * (finger.down ? 9 : 4), 1)
  u.uTime.value += passed
  u.uRun.value += passed * (settings.speed + settings.perLevel * fan * settings.levels) * 2.6
  u.uFan.value = fan
  u.uFinger.value.set(finger.x, finger.y, finger.push, 0)
  // The picture of wires: what was there, fainter, with this frame's wires on top.
  fade.uniforms.uBefore.value = trails[turn].texture
  fade.uniforms.uStays.value = settings.stays ** (passed * 60)
  renderer.setRenderTarget(trails[1 - turn])
  renderer.render(fading, flat)
  renderer.render(drawing, flat)
  // A soft copy, a quarter the size, for the glow.
  blur.uniforms.uFrom.value = trails[1 - turn].texture
  blur.uniforms.uWay.value.set(1 / soft[0].width, 0)
  renderer.setRenderTarget(soft[0])
  renderer.render(blurring, flat)
  blur.uniforms.uFrom.value = soft[0].texture
  blur.uniforms.uWay.value.set(0, 1 / soft[0].height)
  renderer.setRenderTarget(soft[1])
  renderer.render(blurring, flat)
  // And onto the screen.
  tone.uniforms.uLines.value = trails[1 - turn].texture
  tone.uniforms.uSoft.value = soft[1].texture
  renderer.setRenderTarget(null)
  renderer.render(toning, flat)
  turn = 1 - turn
  requestAnimationFrame(draw)
}
requestAnimationFrame(draw)
