import * as THREE from 'three'
import './air.css'

/**
 * Air, drawn as fine wires of light. A study after a generative piece by Rey Rad ("a single circular composition with local
 * attractors"): thousands of hair-thin lines following a slow flow, gathering into silk where the flow draws together, opening
 * dark eyes where it turns, and held inside a wavering outline that carries a fringe of colour.
 *
 * How it is made here, live on the graphics card:
 * - A quarter of a million points each know where they are (kept in a picture, one pixel per point).
 * - Every frame each point moves a little along the flow at its place. The flow has no sources or sinks (it is the curl of a
 *   slowly changing field), so points neither bunch up nor thin out by themselves: they slide past one another in sheets.
 *   A few slow whirls turn in it, and a finger dragged across pushes it.
 * - A wavering ring holds them in: past it, points are drawn back. Being held there, they gather, and the outline shows bright.
 * - Each point leaves a faint dot. The dots are added onto a picture that fades slowly, so every point draws a line behind it.
 * - Last, that picture is toned, and its red is taken from a little further out than its blue: the fringe of colour at the edges.
 */
const settings = {
  /** Points along one side of the square that holds them: 512 is about 262,000 points. Phones get the smaller number. */
  side: matchMedia('(pointer: coarse)').matches ? 320 : 512,
  /** How fast the air moves at fan level 0 and how much each level adds (screen-heights a second, roughly). */
  speed: 0.05,
  perLevel: 0.034,
  levels: 7,
  start: 3,
  /** The flow: how large its features are (higher = finer), how fast it changes, and how strong the whirls are. */
  grain: 0.85,
  drift: 0.035,
  whirls: 0.4,
  /** The outline: its radius (1 = half the shorter side of the window), how deeply it wavers, and how firmly it holds. */
  ring: 0.74,
  waver: 0.11,
  hold: 2.4,
  /** How long a point lives before it starts again somewhere else inside (seconds, give or take). */
  life: 14,
  /** Each point's dot: how bright; and how much of the picture is left after a 60th of a second (nearer 1 = longer lines). */
  dot: 0.011,
  stays: 0.955,
  /** Toning: how strongly the picture is brightened, the colour fringe (how much further out red is read than blue), and the glow. */
  gain: 1.5,
  fringe: 0.011,
  glow: 0.32,
  /** A finger's push: how far it reaches and how hard. */
  reach: 0.16,
  push: 1.6,
  maxPixelRatio: 1.5,
}

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
renderer.autoClear = false
const kind = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float') ? THREE.FloatType : THREE.HalfFloatType
const flat = new THREE.Camera()
const quad = new THREE.PlaneGeometry(2, 2)
const pass = (material: THREE.Material) => {
  const mesh = new THREE.Mesh(quad, material)
  mesh.frustumCulled = false
  return new THREE.Scene().add(mesh)
}
const full = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

// ---- Where the points are: two pictures, read from one and written to the other, turn about ----
const target = (wide: number, tall: number, type: THREE.TextureDataType, filter: THREE.MagnificationTextureFilter) =>
  new THREE.WebGLRenderTarget(wide, tall, { type, format: THREE.RGBAFormat, minFilter: filter, magFilter: filter, depthBuffer: false })
const places = [0, 1].map(() => target(settings.side, settings.side, kind, THREE.NearestFilter))
const seeded = new Float32Array(settings.side * settings.side * 4)
for (let index = 0; index < settings.side * settings.side; index++) {
  const far = Math.sqrt(Math.random()) * settings.ring
  const turn = Math.random() * Math.PI * 2
  seeded.set([Math.cos(turn) * far, Math.sin(turn) * far, Math.random(), Math.random()], index * 4) // x, y, age (0–1), its own number
}
const seed = new THREE.DataTexture(seeded, settings.side, settings.side, THREE.RGBAFormat, THREE.FloatType)
seed.needsUpdate = true

const flow = /* glsl */ `
  uniform float uTime, uGrain, uDrift, uWhirls;
  vec3 mod289(vec3 x) { return x - floor(x / 289.0) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x / 289.0) * 289.0; }
  vec3 permute(vec3 x) { return mod289((x * 34.0 + 1.0) * x); }
  float noise(vec2 v) {   // simplex noise, −1 … 1
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 a0 = x - floor(x + 0.5);
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    return 130.0 * dot(m, vec3(a0.x * x0.x + h.x * x0.y, a0.yz * x12.xz + h.yz * x12.yw));
  }
  // The field the air turns round. Its level lines are the paths the air follows.
  float field(vec2 p) {
    float t = uTime * uDrift;
    float f = noise(p * uGrain + vec2(t, t * 0.6)) + 0.3 * noise(p * uGrain * 2.1 - vec2(t * 1.3, -t * 0.8) + 7.3);
    for (int i = 0; i < 4; i++) {
      float n = float(i);
      vec2 middle = 0.46 * vec2(sin(t * (0.7 + 0.23 * n) + n * 2.4), cos(t * (0.55 + 0.19 * n) + n * 1.7));
      vec2 away = p - middle;
      f += uWhirls * (mod(n, 2.0) < 0.5 ? 1.0 : -1.0) * exp(-dot(away, away) / (0.05 + 0.02 * n));
    }
    return f;
  }
  vec2 air(vec2 p) {
    float e = 0.004;
    return vec2(field(p + vec2(0.0, e)) - field(p - vec2(0.0, e)), field(p - vec2(e, 0.0)) - field(p + vec2(e, 0.0))) / (2.0 * e) * 0.22;
  }
`
const step = new THREE.ShaderMaterial({
  uniforms: {
    uPlaces: { value: seed as THREE.Texture },
    uTime: { value: 0 },
    uPassed: { value: 0 },
    uSpeed: { value: settings.speed },
    uGrain: { value: settings.grain },
    uDrift: { value: settings.drift },
    uWhirls: { value: settings.whirls },
    uRing: { value: new THREE.Vector3(settings.ring, settings.waver, settings.hold) },
    uLife: { value: settings.life },
    uFinger: { value: new THREE.Vector4() }, // where it is (x, y) and how it is moving (x, y)
    uReach: { value: new THREE.Vector2(settings.reach, settings.push) },
  },
  vertexShader: full,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uPlaces;
    uniform float uPassed, uSpeed, uLife;
    uniform vec3 uRing;
    uniform vec4 uFinger;
    uniform vec2 uReach;
    ${flow}
    float chance(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 point = texture2D(uPlaces, vUv);
      vec2 p = point.xy;
      vec2 going = air(p) * (uSpeed / 0.05);
      // The outline: a ring that wavers slowly. Past it the air is turned back, and the points gather along it.
      float turn = atan(p.y, p.x);
      float edge = uRing.x * (1.0 + uRing.y * (0.6 * sin(turn * 3.0 + uTime * 0.11) + 0.4 * sin(turn * 5.0 - uTime * 0.17 + 1.3) + 0.3 * sin(turn * 2.0 + uTime * 0.07 + 4.0)));
      float past = length(p) - edge;
      going -= normalize(p + 1e-5) * max(past, 0.0) * uRing.z * 4.0;
      going -= normalize(p + 1e-5) * smoothstep(-0.06, 0.0, past) * 0.03;
      // A finger carries the air near it along.
      vec2 from = p - uFinger.xy;
      going += uFinger.zw * uReach.y * exp(-dot(from, from) / (uReach.x * uReach.x));
      p += going * uPassed;
      float age = point.z + uPassed / (uLife * (0.6 + 0.8 * point.w));
      if (age > 1.0) {
        // Its time is up: it starts again somewhere inside.
        float far = sqrt(chance(vUv + uTime)) * uRing.x * 0.96;
        float where = chance(vUv.yx + uTime * 1.7) * 6.2831853;
        p = vec2(cos(where), sin(where)) * far;
        age = 0.0;
      }
      gl_FragColor = vec4(p, age, point.w);
    }`,
})
const stepping = pass(step)

// ---- The lines: each point leaves a dot on a picture that fades ----
const refs = new Float32Array(settings.side * settings.side * 2)
for (let index = 0; index < settings.side * settings.side; index++) refs.set([((index % settings.side) + 0.5) / settings.side, (Math.floor(index / settings.side) + 0.5) / settings.side], index * 2)
const cloud = new THREE.BufferGeometry()
cloud.setAttribute('position', new THREE.BufferAttribute(new Float32Array(settings.side * settings.side * 3), 3))
cloud.setAttribute('ref', new THREE.BufferAttribute(refs, 2))
const dots = new THREE.ShaderMaterial({
  blending: THREE.AdditiveBlending,
  depthTest: false,
  transparent: true,
  uniforms: { uPlaces: { value: null as THREE.Texture | null }, uShape: { value: new THREE.Vector2(1, 1) }, uDot: { value: settings.dot }, uSize: { value: 1 } },
  vertexShader: /* glsl */ `
    attribute vec2 ref;
    uniform sampler2D uPlaces;
    uniform vec2 uShape;
    uniform float uSize;
    varying float vFresh;
    void main() {
      vec4 point = texture2D(uPlaces, ref);
      vFresh = smoothstep(0.0, 0.04, point.z) * smoothstep(1.0, 0.9, point.z);   // a point fades in when it starts and out before it ends
      gl_Position = vec4(point.xy * uShape, 0.0, 1.0);
      gl_PointSize = uSize;
    }`,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform float uDot;
    varying float vFresh;
    void main() { gl_FragColor = vec4(vec3(uDot * vFresh), 1.0); }`,
})
const points = new THREE.Points(cloud, dots)
points.frustumCulled = false
const drawing = new THREE.Scene().add(points)
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
  dots.uniforms.uSize.value = ratio
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

const finger = { x: 0, y: 0, moved: new THREE.Vector2(), down: false }
const where = (event: PointerEvent) => ({ x: ((event.clientX / innerWidth) * 2 - 1) / shape.x, y: (1 - (event.clientY / innerHeight) * 2) / shape.y })
canvas.addEventListener('pointerdown', (event) => {
  Object.assign(finger, where(event), { down: true })
  canvas.setPointerCapture(event.pointerId)
})
canvas.addEventListener('pointermove', (event) => {
  const now = where(event)
  if (finger.down || event.pointerType === 'mouse') finger.moved.add(new THREE.Vector2(now.x - finger.x, now.y - finger.y))
  Object.assign(finger, now)
})
const lift = () => (finger.down = false)
canvas.addEventListener('pointerup', lift)
canvas.addEventListener('pointercancel', lift)

// ---- Frames ----
let before = performance.now()
let speed = settings.speed + settings.perLevel * level
let turn = 0
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
function draw(now: number) {
  const passed = Math.min((now - before) / 1000, 1 / 30) * (still ? 0.25 : 1)
  before = now
  speed += (settings.speed + settings.perLevel * level - speed) * Math.min(passed * 2.5, 1)
  // Where the points go next.
  step.uniforms.uPlaces.value = turn === 0 && step.uniforms.uTime.value === 0 ? seed : places[turn].texture
  step.uniforms.uTime.value += passed
  step.uniforms.uPassed.value = passed
  step.uniforms.uSpeed.value = speed
  // The push is the finger's speed, capped, and dies away when it stops: a still finger adds nothing.
  const push = finger.moved.clone().divideScalar(Math.max(passed, 1 / 120)).clampLength(0, 3)
  step.uniforms.uFinger.value.set(finger.x, finger.y, push.x, push.y)
  finger.moved.multiplyScalar(0.6)
  renderer.setRenderTarget(places[1 - turn])
  renderer.render(stepping, flat)
  // The picture of lines: what was there, a little fainter, and a dot for every point on top.
  fade.uniforms.uBefore.value = trails[turn].texture
  fade.uniforms.uStays.value = settings.stays ** (passed * 60)
  renderer.setRenderTarget(trails[1 - turn])
  renderer.render(fading, flat)
  dots.uniforms.uPlaces.value = places[1 - turn].texture
  dots.uniforms.uDot.value = settings.dot * (0.55 + 0.45 * (level / settings.levels)) * (262144 / (settings.side * settings.side)) ** 0.5
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
