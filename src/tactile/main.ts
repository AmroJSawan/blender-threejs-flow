import * as THREE from 'three'
import './tactile.css'

/**
 * Groove: a touch control for a car screen that can be worked without looking.
 *
 * What a knob gives that a drawn button does not, and how each is answered here:
 * - It can be found by feel.            → There is nothing to find: a finger put down anywhere in a zone (half the screen,
 *                                         bounded by the screen's own edges) is already on the control.
 * - A hand can rest on it.              → Putting a finger down changes nothing. It only says where you are.
 * - It turns from wherever it is.       → Sliding is relative to where the finger landed. Up/down is one setting, left/right another.
 * - It clicks in steps you can count.   → Every step is a notch: a short pulse, a tick whose pitch says how high the value is,
 *                                         and a ridge in the surface the finger visibly sticks in and slips over.
 * - It stops at its ends.               → A longer, lower thud and a wall in the groove; no more ticks.
 * - Switching is a separate act.        → A tap with a second finger while the first rests (or a double tap) switches the zone on or off.
 *
 * The picture is one sheet of dark material drawn by a shader: its dents, grooves and ridges are a height the light falls across.
 */
const settings = {
  /**
   * The zones (left and right halves, or top and bottom on an upright screen). Each has a setting worked by sliding up and down (`along`),
   * one worked by sliding sideways (`across`), and a switch. `px` is how far the finger moves for one notch; `lowest`/`highest` are the
   * pitches (Hz) of the tick at the two ends of the range; `tint` is the sheet's colour at the two ends of the up-and-down setting.
   */
  zones: [
    {
      name: 'Climate',
      along: { name: 'Temperature', least: 16, most: 28, step: 0.5, start: 21, px: 30, unit: '°', lowest: 420, highest: 840 },
      across: { name: 'Fan', least: 0, most: 7, step: 1, start: 3, px: 46, unit: '', lowest: 300, highest: 520 },
      turn: { name: 'A/C', on: true },
      tint: ['#1b242d', '#33241e'],
      accent: '#ffb37a',
    },
    {
      name: 'Sound',
      along: { name: 'Volume', least: 0, most: 30, step: 1, start: 12, px: 22, unit: '', lowest: 380, highest: 900 },
      across: { name: 'Station', least: 0, most: 5, step: 1, start: 2, px: 64, unit: '', lowest: 330, highest: 560 },
      turn: { name: 'Sound', on: true },
      tint: ['#1d2225', '#1f2f29'],
      accent: '#8fe9c0',
    },
  ],
  /** The names read out and shown for the Sound zone's sideways setting. */
  stations: ['Jazz', 'News', 'Classical', 'Pop', 'Talk', 'Ambient'],
  /** How far (px) a finger must move before the slide counts, and picks its direction. Below this it is a rest or a tap. */
  slack: 14,
  /** A tap is shorter than this (ms); two taps closer than `again` make a double tap. */
  tap: 260,
  again: 380,
  /** A resting finger hears where it is after this long (ms); a slide hears its value this long after it stops. */
  rest: 420,
  settle: 650,
  /**
   * Feedback. Vibration lengths in ms: about 10 reads as a click, 30 or more as a buzz, so a notch is short and an end stop long.
   * A phone's motor is slow to start, though, and many do not move at all for less than about 15 ms, so these are longer than the ideal.
   * Ticks closer together than `apart` ms are dropped (touch cannot tell them apart, and it turns to noise).
   */
  pulse: { land: 14, notch: 20, heavy: 30, stop: 60, turn: [22, 70, 30] },
  apart: 32,
  loud: 0.5,
  /** The sheet: its dent under a finger (depth and width in px), the groove, the ridges between notches, and how strongly light shows them. */
  sheet: { dent: 20, pad: 54, groove: 12, wide: 32, ridge: 10, reach: 190, relief: 1.0, hint: 0.3 },
  /** How much the shown finger hangs back in a notch before slipping to the next (1 = follows the finger exactly; higher = stickier). */
  stick: 2.4,
  maxPixelRatio: 2,
}

type Setting = (typeof settings.zones)[number]['along']
type Axis = 'along' | 'across'
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const spoken = document.querySelector<HTMLElement>('#spoken')!

// ---- The state of the car --------------------------------------------------------
const zones = settings.zones.map((zone) => ({ ...zone, values: { along: zone.along.start, across: zone.across.start }, on: zone.turn.on }))
type Zone = (typeof zones)[number]
const share = (zone: Zone, axis: Axis) => (zone.values[axis] - zone[axis].least) / (zone[axis].most - zone[axis].least)
function worded(zone: Zone, axis: Axis) {
  const setting = zone[axis]
  if (zone.name === 'Sound' && axis === 'across') return settings.stations[zone.values.across]
  return `${zone.values[axis]}${setting.unit}`
}

// ---- Words on the sheet ----------------------------------------------------------
const blocks = zones.map((zone) => {
  const block = document.createElement('div')
  block.className = 'zone'
  block.innerHTML = `<span class="name"></span><span class="figure"></span><span class="second"></span><span class="how">↕ ${zone.along.name.toLowerCase()} · ↔ ${zone.across.name.toLowerCase()} · second finger: ${zone.turn.name.toLowerCase()} on or off</span>`
  document.querySelector('#zones')!.append(block)
  return block
})
function write() {
  zones.forEach((zone, index) => {
    const [name, figure, second] = blocks[index].children
    name.textContent = zone.name
    figure.textContent = worded(zone, 'along')
    second.textContent = `${zone.across.name} ${worded(zone, 'across')} · ${zone.turn.name} ${zone.on ? 'on' : 'off'}`
    blocks[index].classList.toggle('off', !zone.on)
  })
}
write()

// ---- Modes -----------------------------------------------------------------------
const modes = { dark: false, voice: true }
const labels: Record<keyof typeof modes, string> = { dark: 'Eyes-free', voice: 'Voice' }
for (const key of Object.keys(modes) as (keyof typeof modes)[]) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = labels[key]
  button.setAttribute('aria-pressed', String(modes[key]))
  button.addEventListener('click', () => {
    modes[key] = !modes[key]
    button.setAttribute('aria-pressed', String(modes[key]))
    document.body.classList.toggle('dark', modes.dark)
    if (key === 'voice' && !modes.voice) speechSynthesis?.cancel()
    if (key === 'dark') say(modes.dark ? 'Eyes free. The screen is dark.' : 'Screen on.')
  })
  document.querySelector('#modes')!.append(button)
}

// ---- Sound, vibration, voice -----------------------------------------------------
let audio: AudioContext | undefined
let out: GainNode
let hiss: AudioBuffer
function wake() {
  if (!audio) {
    audio = new AudioContext({ latencyHint: 'interactive' })
    out = audio.createGain()
    out.gain.value = settings.loud
    out.connect(audio.destination)
    hiss = audio.createBuffer(1, audio.sampleRate * 0.05, audio.sampleRate)
    const samples = hiss.getChannelData(0)
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1
  }
  if (audio.state !== 'running') void audio.resume()
}
/** One short tone that dies away: `pitch` Hz (sliding to `to`), `lasts` seconds, `level` 0–1, starting `after` seconds from now. */
function tone(pitch: number, lasts: number, level: number, shape: OscillatorType = 'sine', to = pitch, after = 0) {
  if (!audio) return
  const start = audio.currentTime + after
  const voice = audio.createOscillator()
  const loudness = audio.createGain()
  voice.type = shape
  voice.frequency.setValueAtTime(pitch, start)
  voice.frequency.exponentialRampToValueAtTime(to, start + lasts)
  loudness.gain.setValueAtTime(level, start)
  loudness.gain.exponentialRampToValueAtTime(0.0008, start + lasts)
  voice.connect(loudness).connect(out)
  voice.start(start)
  voice.stop(start + lasts + 0.01)
}
/** The sharp front of a click: a few milliseconds of hiss, kept to the band given. */
function snap(band: number, lasts: number, level: number, kind: BiquadFilterType = 'bandpass') {
  if (!audio) return
  const source = audio.createBufferSource()
  const filter = audio.createBiquadFilter()
  const loudness = audio.createGain()
  source.buffer = hiss
  filter.type = kind
  filter.frequency.value = band
  filter.Q.value = 1.2
  loudness.gain.setValueAtTime(level, audio.currentTime)
  loudness.gain.exponentialRampToValueAtTime(0.0008, audio.currentTime + lasts)
  source.connect(filter).connect(loudness).connect(out)
  source.start()
  source.stop(audio.currentTime + lasts + 0.01)
}
/** Phones that offer no vibration to web pages but do tick when a switch is flipped: flip a hidden one. */
const flipper = document.createElement('label')
flipper.className = 'quiet'
flipper.innerHTML = '<input type="checkbox" switch />'
document.body.append(flipper)
const vibrates = 'vibrate' in navigator
function buzz(pattern: number | number[]) {
  if (vibrates) navigator.vibrate(pattern)
  else flipper.click()
}
// Say plainly when this browser gives a page no vibration, so silence under the finger is not taken for a fault.
if (!vibrates) document.querySelector('#note')!.append(' This browser gives web pages no vibration (iPhones do not): here it is sound only.')
let lastTick = 0
const feel = {
  land() {
    tone(190, 0.04, 0.16, 'sine', 140)
    buzz(settings.pulse.land)
  },
  /** One notch: where in the range it is (0–1) sets the pitch, so the height of the value can be heard. */
  notch(setting: Setting, part: number, heavy: boolean) {
    const now = performance.now()
    if (now - lastTick < settings.apart) return
    lastTick = now
    snap(3200, 0.006, heavy ? 0.5 : 0.34)
    tone(setting.lowest * (setting.highest / setting.lowest) ** part, heavy ? 0.05 : 0.028, heavy ? 0.3 : 0.22, heavy ? 'triangle' : 'sine')
    if (heavy) tone(150, 0.05, 0.3)
    buzz(heavy ? settings.pulse.heavy : settings.pulse.notch)
  },
  stop() {
    snap(420, 0.03, 0.5, 'lowpass')
    tone(170, 0.06, 0.5, 'sine', 110)
    buzz(settings.pulse.stop)
  },
  turn(on: boolean) {
    tone(on ? 520 : 780, 0.05, 0.26, 'triangle')
    tone(on ? 780 : 520, 0.07, 0.26, 'triangle', undefined, 0.075)
    buzz(settings.pulse.turn)
  },
}
function say(words: string) {
  spoken.textContent = words
  if (!modes.voice || !('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const line = new SpeechSynthesisUtterance(words)
  line.rate = 1.2
  speechSynthesis.speak(line)
}

// ---- Fingers ---------------------------------------------------------------------
type Finger = {
  id: number
  slot: number
  zone: Zone
  from: { x: number; y: number; at: number }
  now: { x: number; y: number }
  axis: Axis | null
  carried: number // px slid since the last notch
  notches: number // notches crossed since landing, as drawn
  wall: number // which way the end stop is (−1, 0, +1)
  timer: number
  shown: { press: number; lock: number; wall: number }
  down: boolean
}
const fingers: Finger[] = []
const lastTap = { at: 0, zone: null as Zone | null }
const upright = () => innerHeight > innerWidth
const zoneAt = (x: number, y: number) => zones[(upright() ? y / innerHeight : x / innerWidth) < 0.5 ? 0 : 1]

function turn(zone: Zone) {
  zone.on = !zone.on
  feel.turn(zone.on)
  say(`${zone.turn.name} ${zone.on ? 'on' : 'off'}`)
  write()
}
function notch(finger: Finger, way: number) {
  const axis = finger.axis!
  const setting = finger.zone[axis]
  const next = finger.zone.values[axis] + way * setting.step
  if (next < setting.least || next > setting.most) {
    if (finger.wall !== way) feel.stop()
    finger.wall = way
    finger.shown.wall = 1
    finger.carried = 0 // pinned: turning back answers at once, as a knob does at its stop
    return false
  }
  finger.wall = 0
  finger.zone.values[axis] = next
  finger.notches += way
  feel.notch(setting, share(finger.zone, axis), axis === 'across')
  write()
  return true
}

canvas.addEventListener('pointerdown', (event) => {
  wake()
  canvas.setPointerCapture(event.pointerId)
  // Two fingers can be drawn at once; any more still count (a tap is a tap), they just leave no dent.
  const slot = [0, 1].find((free) => !fingers.some((finger) => finger.slot === free)) ?? -1
  const resting = fingers.find((finger) => finger.down)
  const zone = zoneAt(event.clientX, event.clientY)
  const finger: Finger = {
    id: event.pointerId,
    slot,
    zone,
    from: { x: event.clientX, y: event.clientY, at: performance.now() },
    now: { x: event.clientX, y: event.clientY },
    axis: null,
    carried: 0,
    notches: 0,
    wall: 0,
    timer: 0,
    shown: { press: 0, lock: 0, wall: 0 },
    down: true,
  }
  fingers.push(finger)
  feel.land()
  // A finger that stays put is asking where it is.
  if (!resting) finger.timer = window.setTimeout(() => say(`${zone.name}. ${zone.along.name} ${worded(zone, 'along')}. ${zone.across.name} ${worded(zone, 'across')}.`), settings.rest)
})
canvas.addEventListener('pointermove', (event) => {
  const finger = fingers.find((each) => each.id === event.pointerId && each.down)
  if (!finger) return
  const moved = { x: event.clientX - finger.now.x, y: event.clientY - finger.now.y }
  finger.now = { x: event.clientX, y: event.clientY }
  if (!finger.axis) {
    const far = { x: finger.now.x - finger.from.x, y: finger.now.y - finger.from.y }
    if (Math.hypot(far.x, far.y) < settings.slack) return
    finger.axis = Math.abs(far.y) >= Math.abs(far.x) ? 'along' : 'across'
    clearTimeout(finger.timer)
    return
  }
  if (!finger.zone.on) return // a zone that is off still shows its groove, but nothing moves
  const px = finger.zone[finger.axis].px
  finger.carried += finger.axis === 'along' ? -moved.y : moved.x // up is more, right is more
  while (Math.abs(finger.carried) >= px) {
    const way = Math.sign(finger.carried)
    if (!notch(finger, way)) break
    finger.carried -= way * px
  }
  clearTimeout(finger.timer)
  const { zone, axis } = finger
  finger.timer = window.setTimeout(() => say(`${zone[axis].name} ${worded(zone, axis)}`), settings.settle)
})
function lift(event: PointerEvent) {
  const finger = fingers.find((each) => each.id === event.pointerId && each.down)
  if (!finger) return
  finger.down = false
  clearTimeout(finger.timer)
  const now = performance.now()
  if (finger.axis || now - finger.from.at > settings.tap) return
  // A tap. With another finger resting, it switches that finger's zone; alone, twice in a row, it switches its own.
  const resting = fingers.find((each) => each.down)
  if (resting) {
    clearTimeout(resting.timer)
    turn(resting.zone)
  } else if (lastTap.zone === finger.zone && now - lastTap.at < settings.again) {
    lastTap.zone = null
    turn(finger.zone)
  } else {
    lastTap.at = now
    lastTap.zone = finger.zone
  }
}
canvas.addEventListener('pointerup', lift)
canvas.addEventListener('pointercancel', lift)
canvas.addEventListener('contextmenu', (event) => event.preventDefault())

// ---- The sheet -------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
const view = new THREE.Camera()
const two = <T>(make: () => T) => [make(), make()]
const sheet = new THREE.ShaderMaterial({
  uniforms: {
    uSize: { value: new THREE.Vector2() },
    uRatio: { value: 1 },
    uUpright: { value: 0 },
    uDark: { value: 0 },
    uFinger: { value: two(() => new THREE.Vector4()) }, // where it is drawn (x, y), how far pressed in, how hard against a wall
    uGroove: { value: two(() => new THREE.Vector4()) }, // where it landed (x, y), notch spacing up/down and sideways
    uLock: { value: two(() => new THREE.Vector4()) }, // how settled the up/down groove is, the sideways one, which way the wall is, the lit notch
    uZone: { value: two(() => new THREE.Vector4()) }, // how full, on or off
    uLow: { value: zones.map((zone) => new THREE.Color(zone.tint[0])) },
    uHigh: { value: zones.map((zone) => new THREE.Color(zone.tint[1])) },
    uAccent: { value: zones.map((zone) => new THREE.Color(zone.accent)) },
    uShape: { value: new THREE.Vector4(settings.sheet.dent, settings.sheet.pad, settings.sheet.groove, settings.sheet.wide) },
    uRidge: { value: new THREE.Vector3(settings.sheet.ridge, settings.sheet.reach, settings.sheet.relief) },
  },
  vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform vec2 uSize;
    uniform float uRatio, uUpright, uDark;
    uniform vec4 uFinger[2], uGroove[2], uLock[2], uZone[2], uShape;
    uniform vec3 uLow[2], uHigh[2], uAccent[2], uRidge;

    // One groove: a channel through the landing point with a ridge between each notch and the next, seen only near the finger.
    // 'along' and 'beside' are px from the landing point; 'finger' is where the finger is along it.
    float groove(float along, float beside, float pitch, float finger, float wall) {
      float near = exp(-pow((along - finger) / uRidge.y, 2.0));
      float channel = exp(-beside * beside / (2.0 * uShape.w * uShape.w));
      float ridge = pow(0.5 - 0.5 * cos(6.2831853 * along / pitch), 4.0);
      float stop = wall * 1.4 * exp(-pow((along - finger - sign(wall) * pitch * 0.62) / (pitch * 0.2), 2.0));
      return near * channel * (-uShape.z + uRidge.x * (ridge + abs(stop)));
    }
    // How far the sheet stands above (+) or below (−) flat, at a point in px from the top left.
    float height(vec2 p) {
      float fromSeam = uUpright > 0.5 ? p.y - uSize.y * 0.5 : p.x - uSize.x * 0.5;
      float h = -2.5 * exp(-fromSeam * fromSeam / 60.0);
      for (int i = 0; i < 2; i++) {
        vec4 f = uFinger[i];
        if (f.z < 0.002) continue;
        vec2 fromFinger = p - f.xy;
        vec2 fromLanding = p - uGroove[i].xy;
        vec2 fingerOut = f.xy - uGroove[i].xy;
        h -= uShape.x * f.z * exp(-dot(fromFinger, fromFinger) / (2.0 * uShape.y * uShape.y));
        h += f.z * uLock[i].x * groove(-fromLanding.y, fromLanding.x, uGroove[i].z, -fingerOut.y, uLock[i].z * f.w);
        h += f.z * uLock[i].y * groove(fromLanding.x, fromLanding.y, uGroove[i].w, fingerOut.x, uLock[i].z * f.w);
      }
      return h;
    }
    void main() {
      vec2 p = vec2(gl_FragCoord.x, uSize.y * uRatio - gl_FragCoord.y) / uRatio;
      float h = height(p);
      vec3 normal = normalize(vec3(h - height(p + vec2(1.5, 0.0)), h - height(p + vec2(0.0, 1.5)), 1.5 / uRidge.z));
      vec3 lamp = normalize(vec3(-0.42, -0.56, 0.72));   // a wide soft lamp up and to the left
      float lit = clamp(1.0 + 1.5 * (dot(normal, lamp) - lamp.z) + h * 0.01, 0.5, 1.7);

      float part = uUpright > 0.5 ? p.y / uSize.y : p.x / uSize.x;
      vec4 zone = part < 0.5 ? uZone[0] : uZone[1];
      vec3 low = part < 0.5 ? uLow[0] : uLow[1];
      vec3 high = part < 0.5 ? uHigh[0] : uHigh[1];
      // The zone fills from the bottom with the value, as a wide soft edge: enough to read from the corner of the eye.
      float level = smoothstep(-70.0, 70.0, p.y - uSize.y * (1.0 - zone.x) * (uUpright > 0.5 ? 0.5 : 1.0) - (uUpright > 0.5 && part >= 0.5 ? uSize.y * 0.5 : 0.0));
      vec3 colour = mix(low, high, zone.x) * (0.86 + 0.34 * level);
      colour = mix(vec3(dot(colour, vec3(0.33))) * 0.6, colour, zone.y);

      // The notch the finger is in glows faintly in the zone's own colour.
      for (int i = 0; i < 2; i++) {
        vec4 f = uFinger[i];
        vec2 fromFinger = p - f.xy;
        float glow = f.z * max(uLock[i].x, uLock[i].y) * exp(-dot(fromFinger, fromFinger) / (2.0 * 34.0 * 34.0));
        vec3 accent = (uUpright > 0.5 ? f.y / uSize.y : f.x / uSize.x) < 0.5 ? uAccent[0] : uAccent[1];
        colour += accent * glow * 0.16 * zone.y;
      }
      vec2 fromMiddle = (p - uSize * 0.5) / uSize;
      colour *= lit * (1.0 - 0.5 * dot(fromMiddle, fromMiddle));
      colour += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;   // no banding in the soft slopes
      gl_FragColor = vec4(colour * (1.0 - uDark), 1.0);
      #include <colorspace_fragment>
    }`,
})
const board = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), sheet)
board.frustumCulled = false
const scene = new THREE.Scene().add(board)

function resize() {
  const ratio = Math.min(devicePixelRatio, settings.maxPixelRatio)
  renderer.setPixelRatio(ratio)
  renderer.setSize(innerWidth, innerHeight, false)
  sheet.uniforms.uSize.value.set(innerWidth, innerHeight)
  sheet.uniforms.uRatio.value = ratio
  sheet.uniforms.uUpright.value = upright() ? 1 : 0
}
addEventListener('resize', resize)
resize()

let before = performance.now()
let dark = 0
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
function draw(now: number) {
  const passed = Math.min((now - before) / 1000, 0.05)
  before = now
  const toward = (from: number, to: number, speed: number) => (still ? to : from + (to - from) * (1 - Math.exp(-passed * speed)))
  const u = sheet.uniforms
  for (const slot of [0, 1]) u.uFinger.value[slot].z = 0
  for (let index = fingers.length - 1; index >= 0; index--) {
    const finger = fingers[index]
    finger.shown.press = toward(finger.shown.press, finger.down ? 1 : 0, finger.down ? 22 : 9)
    finger.shown.lock = toward(finger.shown.lock, finger.axis ? 1 : 0, 14)
    finger.shown.wall = toward(finger.shown.wall, finger.wall && finger.down ? 0.75 : 0, 7)
    if (!finger.down && finger.shown.press < 0.01) {
      fingers.splice(index, 1)
      continue
    }
    // Where the finger is drawn: in its notch, hanging back at first and then slipping on to the next.
    let { x, y } = finger.now
    const pitch = { along: finger.zone.along.px, across: finger.zone.across.px }
    if (finger.axis) {
      const px = pitch[finger.axis]
      const part = finger.carried / px
      const out = (finger.notches + Math.sign(part) * Math.abs(part) ** settings.stick) * px
      if (finger.axis === 'along') y = finger.from.y - out
      else x = finger.from.x + out
    }
    if (finger.slot < 0) continue
    const hint = settings.sheet.hint * (1 - finger.shown.lock)
    u.uFinger.value[finger.slot].set(x, y, finger.shown.press, finger.shown.wall)
    u.uGroove.value[finger.slot].set(finger.from.x, finger.from.y, pitch.along, pitch.across)
    u.uLock.value[finger.slot].set(finger.axis === 'along' ? finger.shown.lock : hint, finger.axis === 'across' ? finger.shown.lock : hint, finger.wall, 0)
  }
  zones.forEach((zone, index) => {
    const shown = u.uZone.value[index]
    shown.x = toward(shown.x, share(zone, 'along'), 12)
    shown.y = toward(shown.y, zone.on ? 1 : 0, 8)
  })
  dark = toward(dark, modes.dark ? 1 : 0, 6)
  u.uDark.value = dark
  renderer.render(scene, view)
  requestAnimationFrame(draw)
}
requestAnimationFrame(draw)
