import * as THREE from 'three'
import './air.css'

/**
 * Air in the cabin. The car is seen from above, and each vent is where it is in the car: two by the doors and two in the middle
 * of the dashboard, one along the windscreen, one by each front footwell, and two for the back seats.
 * From each vent that is on, air shows as a soft, blurred plume: it leaves the vent in the direction the vent points,
 * spreads as it goes, and fades. It is cool blue on a cool side of the car and warm amber on a warm side.
 *
 * How the plumes are made: each is a fan of fine lines from its vent, with brighter runs travelling outward along them. The lines
 * themselves are barely shown. They are blurred several times over, and it is the blur that is seen, so the air reads as air: soft,
 * with only a hint of its grain and movement.
 *
 * Touch a dashboard vent's plume and drag to aim it. The buttons choose where the air goes and how hard the fan blows.
 */
type Group = 'face' | 'feet' | 'screen' | 'back'
type Vent = { name: string; group: Group; side: 'driver' | 'passenger'; at: [number, number]; points: number; swing: number; reach: number; spread: number; mouth: number }
const settings = {
  /**
   * The vents (x across, y up; the cabin is about 1.24 wide and 1.9 long, its middle at 0,0; the front of the car is up).
   * `points` is the direction it blows (degrees: 0 is toward the car's right, −90 toward the back), `swing` how far it can be aimed
   * either way, `reach` how far its air goes at full fan, `spread` how wide the plume opens (degrees), `mouth` the vent's own width.
   */
  vents: [
    { name: 'Driver, door side', group: 'face', side: 'driver', at: [-0.5, 0.47], points: -82, swing: 40, reach: 0.62, spread: 26, mouth: 0.07 },
    { name: 'Driver, middle', group: 'face', side: 'driver', at: [-0.11, 0.47], points: -112, swing: 40, reach: 0.62, spread: 26, mouth: 0.07 },
    { name: 'Passenger, middle', group: 'face', side: 'passenger', at: [0.11, 0.47], points: -68, swing: 40, reach: 0.62, spread: 26, mouth: 0.07 },
    { name: 'Passenger, door side', group: 'face', side: 'passenger', at: [0.5, 0.47], points: -98, swing: 40, reach: 0.62, spread: 26, mouth: 0.07 },
    { name: 'Windscreen', group: 'screen', side: 'driver', at: [0, 0.57], points: 90, swing: 0, reach: 0.2, spread: 30, mouth: 0.82 },
    { name: 'Driver, feet', group: 'feet', side: 'driver', at: [-0.31, 0.36], points: -90, swing: 0, reach: 0.3, spread: 62, mouth: 0.16 },
    { name: 'Passenger, feet', group: 'feet', side: 'passenger', at: [0.31, 0.36], points: -90, swing: 0, reach: 0.3, spread: 62, mouth: 0.16 },
    { name: 'Back, left', group: 'back', side: 'driver', at: [-0.05, -0.2], points: -112, swing: 0, reach: 0.4, spread: 34, mouth: 0.05 },
    { name: 'Back, right', group: 'back', side: 'passenger', at: [0.05, -0.2], points: -68, swing: 0, reach: 0.4, spread: 34, mouth: 0.05 },
  ] as Vent[],
  /** Which sets of vents start on, the fan's level (0–7), and each side's temperature (°C). */
  on: { face: true, feet: false, screen: false, back: true } as Record<Group, boolean>,
  fan: 4,
  levels: 7,
  temperatures: { driver: 19.5, passenger: 24 },
  /** The colour of air at the coolest and the warmest setting (16 and 28 °C). */
  cool: '#6cc4ff',
  warm: '#ffa45c',
  /** Lines in each plume and steps along each. */
  lanes: 30,
  steps: 48,
  /** How much of its full reach the air has with the fan at its lowest, how fast the runs travel at the lowest and at full, and the plume's slow sway. */
  least: 0.35,
  speed: [0.25, 1.1],
  sway: 0.035,
  /** Brightness of the lines; how much of the picture is left after a 60th of a second; how much of the sharp lines shows through the blur; how strong the blur is. */
  dot: 1.9,
  stays: 0.86,
  grain: 0.12,
  soft: 2.4,
  gain: 1.25,
  /** How near a plume a touch must land to take hold of its vent (cabin units). */
  hold: 0.2,
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
const target = (wide: number, tall: number) => new THREE.WebGLRenderTarget(wide, tall, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false })

// ---- What the car is set to ----
const state = {
  on: { ...settings.on },
  fan: settings.fan,
  aim: settings.vents.map((vent) => vent.points), // where each vent points now
  shown: settings.vents.map(() => 0), // how much each vent's air is showing (it eases in and out)
}

// ---- The plumes: for every vent a fan of lines, each point knowing its vent, how far out it is and which line it is on ----
const total = settings.vents.length * settings.lanes * settings.steps
const out = new Float32Array(total)
const lane = new Float32Array(total)
const which = new Float32Array(total)
const joins: number[] = []
settings.vents.forEach((_, vent) => {
  for (let row = 0; row < settings.lanes; row++)
    for (let step = 0; step < settings.steps; step++) {
      const at = (vent * settings.lanes + row) * settings.steps + step
      out[at] = step / (settings.steps - 1)
      lane[at] = (row / (settings.lanes - 1)) * 2 - 1
      which[at] = vent
      if (step) joins.push(at - 1, at)
    }
})
const lines = new THREE.BufferGeometry()
lines.setAttribute('position', new THREE.BufferAttribute(new Float32Array(total * 3), 3))
lines.setAttribute('along', new THREE.BufferAttribute(out, 1))
lines.setAttribute('lane', new THREE.BufferAttribute(lane, 1))
lines.setAttribute('vent', new THREE.BufferAttribute(which, 1))
lines.setIndex(joins)
const count = settings.vents.length
const air = new THREE.ShaderMaterial({
  blending: THREE.AdditiveBlending,
  depthTest: false,
  transparent: true,
  uniforms: {
    uVent: { value: settings.vents.map((vent) => new THREE.Vector4(vent.at[0], vent.at[1], (vent.points * Math.PI) / 180, 0)) }, // where it is (x, y), where it points (radians), how much it shows
    uForm: { value: settings.vents.map((vent) => new THREE.Vector4(vent.reach, (vent.spread * Math.PI) / 180, vent.mouth, 0)) }, // reach, spread, mouth
    uColour: { value: settings.vents.map(() => new THREE.Color()) },
    uShape: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uRun: { value: 0 },
    uFan: { value: 0 },
    uLook: { value: new THREE.Vector3(settings.dot, settings.least, settings.sway) },
  },
  vertexShader: /* glsl */ `
    attribute float along, lane, vent;
    uniform vec4 uVent[${count}], uForm[${count}];
    uniform vec3 uColour[${count}], uLook;
    uniform vec2 uShape;
    uniform float uTime, uRun, uFan;
    varying vec3 vLight;
    void main() {
      int i = int(vent + 0.5);
      vec4 from = uVent[i];
      vec4 form = uForm[i];
      // The plume sways a little, slowly, as air does; every line in it sways together.
      float way = from.z + uLook.z * sin(uTime * 0.6 + vent * 1.7) * along;
      // Each line leaves the vent's mouth at its own place and angle, so the plume opens as it goes.
      float turn = way + lane * form.y * 0.5;
      vec2 heading = vec2(cos(turn), sin(turn));
      vec2 across = vec2(-sin(from.z), cos(from.z));
      float far = form.x * mix(uLook.y, 1.0, uFan) * along;
      // Air slows as it goes: the lines bend a little with distance, each its own way, so the far end is loose.
      float own = fract(sin((lane + vent * 3.1) * 91.7) * 43758.5453);
      vec2 p = from.xy + across * lane * form.z * 0.5 + heading * far + across * (own - 0.5) * 0.05 * along * along;
      gl_Position = vec4(p * uShape, 0.0, 1.0);
      // Brighter runs travel outward; the air is strongest at the vent and gone by the end of its reach; the middle lines are strongest.
      float run = 0.45 + 0.55 * pow(0.5 + 0.5 * cos(6.2831853 * (along * 1.6 - uRun + own)), 2.0);
      float fade = smoothstep(0.0, 0.06, along) * pow(1.0 - along, 1.6);
      float middle = 1.0 - 0.55 * lane * lane;
      vLight = uColour[i] * uLook.x * run * fade * middle * from.w * (0.35 + 0.65 * uFan);
    }`,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec3 vLight;
    void main() { gl_FragColor = vec4(vLight, 1.0); }`,
})
const plumes = new THREE.LineSegments(lines, air)
plumes.frustumCulled = false
const drawing = new THREE.Scene().add(plumes)

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
  uniforms: { uLines: { value: null as THREE.Texture | null }, uSoft: { value: null as THREE.Texture | null }, uLook: { value: new THREE.Vector3(settings.gain, settings.grain, settings.soft) } },
  vertexShader: full,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uLines, uSoft;
    uniform vec3 uLook;
    void main() {
      // What is seen is the blur; only a little of the lines themselves is let through, as the air's grain.
      vec3 light = texture2D(uSoft, vUv).rgb * uLook.z + texture2D(uLines, vUv).rgb * uLook.y;
      vec3 colour = 1.0 - exp(-light * uLook.x);
      colour += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
      gl_FragColor = vec4(colour, 1.0);
      #include <colorspace_fragment>
    }`,
})
const toning = pass(tone)

// ---- Size ----
const shape = new THREE.Vector2(1, 1)
let trails: THREE.WebGLRenderTarget[] = []
let soft: THREE.WebGLRenderTarget[] = []
function resize() {
  const ratio = Math.min(devicePixelRatio, settings.maxPixelRatio)
  renderer.setPixelRatio(ratio)
  renderer.setSize(innerWidth, innerHeight, false)
  const wide = Math.round(innerWidth * ratio)
  const tall = Math.round(innerHeight * ratio)
  for (const each of [...trails, ...soft]) each.dispose()
  trails = [0, 1].map(() => target(wide, tall))
  soft = [0, 1].map(() => target(Math.round(wide / 4), Math.round(tall / 4)))
  // One cabin unit is half the shorter side of the window, the same as the drawing of the car over it.
  shape.set(Math.min(1, innerHeight / innerWidth), Math.min(1, innerWidth / innerHeight))
  air.uniforms.uShape.value.copy(shape)
}
addEventListener('resize', resize)
resize()

// ---- The buttons: where the air goes, and the fan ----
const places: [Group, string][] = [['face', 'Face'], ['feet', 'Feet'], ['screen', 'Windscreen'], ['back', 'Back seats']]
const where = document.querySelector('#where')!
for (const [group, words] of places) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = words
  button.setAttribute('aria-pressed', String(state.on[group]))
  button.addEventListener('click', () => {
    state.on[group] = !state.on[group]
    button.setAttribute('aria-pressed', String(state.on[group]))
  })
  where.append(button)
}
const levels = document.querySelector('#levels')!
for (let each = 0; each <= settings.levels; each++) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = String(each)
  button.setAttribute('aria-pressed', String(each === state.fan))
  button.addEventListener('click', () => {
    state.fan = each
    levels.querySelectorAll('button').forEach((other, at) => other.setAttribute('aria-pressed', String(at === each)))
  })
  levels.append(button)
}
document.querySelector('#driver b')!.textContent = `${settings.temperatures.driver}°`
document.querySelector('#passenger b')!.textContent = `${settings.temperatures.passenger}°`

// ---- Aiming a vent: take hold of its plume and drag ----
const cabin = (event: PointerEvent) => new THREE.Vector2(((event.clientX / innerWidth) * 2 - 1) / shape.x, (1 - (event.clientY / innerHeight) * 2) / shape.y)
let held = -1
canvas.addEventListener('pointerdown', (event) => {
  const touch = cabin(event)
  let nearest = settings.hold
  settings.vents.forEach((vent, index) => {
    if (!vent.swing || !state.on[vent.group]) return
    // how near the touch is to the line this vent's air runs along
    const from = touch.clone().sub(new THREE.Vector2(...vent.at))
    const way = (state.aim[index] * Math.PI) / 180
    const along = THREE.MathUtils.clamp(from.x * Math.cos(way) + from.y * Math.sin(way), 0, vent.reach)
    const off = from.clone().sub(new THREE.Vector2(Math.cos(way), Math.sin(way)).multiplyScalar(along)).length()
    if (off < nearest) {
      nearest = off
      held = index
    }
  })
  if (held >= 0) canvas.setPointerCapture(event.pointerId)
})
canvas.addEventListener('pointermove', (event) => {
  if (held < 0) return
  const vent = settings.vents[held]
  const from = cabin(event).sub(new THREE.Vector2(...vent.at))
  if (from.length() < 0.06) return
  const wanted = (Math.atan2(from.y, from.x) * 180) / Math.PI
  const turned = ((wanted - vent.points + 540) % 360) - 180 // how far from where it points by itself, −180 … 180
  state.aim[held] = vent.points + THREE.MathUtils.clamp(turned, -vent.swing, vent.swing)
})
const release = () => (held = -1)
canvas.addEventListener('pointerup', release)
canvas.addEventListener('pointercancel', release)

// ---- Frames ----
const cool = new THREE.Color(settings.cool)
const warm = new THREE.Color(settings.warm)
let before = performance.now()
let fan = state.fan / settings.levels
let turn = 0
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
function draw(now: number) {
  const passed = Math.min((now - before) / 1000, 1 / 30) * (still ? 0.25 : 1)
  before = now
  const u = air.uniforms
  fan += (state.fan / settings.levels - fan) * Math.min(passed * 2.5, 1)
  u.uTime.value += passed
  u.uRun.value += passed * THREE.MathUtils.lerp(settings.speed[0], settings.speed[1], fan)
  u.uFan.value = fan
  settings.vents.forEach((vent, index) => {
    const wanted = state.on[vent.group] && state.fan > 0 ? 1 : 0
    state.shown[index] += (wanted - state.shown[index]) * Math.min(passed * 3, 1)
    const shown = u.uVent.value[index]
    shown.z += ((state.aim[index] * Math.PI) / 180 - shown.z) * Math.min(passed * 10, 1)
    shown.w = state.shown[index]
    u.uColour.value[index].copy(cool).lerp(warm, THREE.MathUtils.clamp((settings.temperatures[vent.side] - 16) / 12, 0, 1))
  })
  // The picture of lines: what was there, fainter, with this frame's lines on top.
  fade.uniforms.uBefore.value = trails[turn].texture
  fade.uniforms.uStays.value = settings.stays ** (passed * 60)
  renderer.setRenderTarget(trails[1 - turn])
  renderer.render(fading, flat)
  renderer.render(drawing, flat)
  // Blurred, a quarter the size, three times over and wider each time: this is the air that is seen.
  let from = trails[1 - turn].texture
  for (const wide of [1, 2.2, 4]) {
    blur.uniforms.uFrom.value = from
    blur.uniforms.uWay.value.set(wide / soft[0].width, 0)
    renderer.setRenderTarget(soft[0])
    renderer.render(blurring, flat)
    blur.uniforms.uFrom.value = soft[0].texture
    blur.uniforms.uWay.value.set(0, wide / soft[0].height)
    renderer.setRenderTarget(soft[1])
    renderer.render(blurring, flat)
    from = soft[1].texture
  }
  tone.uniforms.uLines.value = trails[1 - turn].texture
  tone.uniforms.uSoft.value = soft[1].texture
  renderer.setRenderTarget(null)
  renderer.render(toning, flat)
  turn = 1 - turn
  requestAnimationFrame(draw)
}
requestAnimationFrame(draw)
