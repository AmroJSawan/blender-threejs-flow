import * as THREE from 'three'
import './tactile.css'
import { feel, felt, say, voice, wake } from './feel'

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
 * The picture: each zone is one wide roller set into the dashboard, drawn by a shader. At rest it lies almost flat. Under a finger it
 * swells; once the finger slides, it becomes a drum turning with the finger, its knurled ridges passing one per notch, and the
 * window in it (a counter drum, like an odometer's) grows and rolls to the new value. Sliding sideways turns it into an upright drum.
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
   * The roller. `inset` is the gap round it (px) and `corner` its rounding; `curve` how far round the drum the zone's edge is (0 flat … 1 a full half turn);
   * `rest` how much of a drum it already is with no finger on it, and `wake` with a finger resting. `knurl` is how deep the ridges look,
   * `satin` how strong the long soft highlights are, and `grows` how much of the screen the zone being changed takes from the other (0–0.5).
   */
  roller: { inset: 10, corner: 28, curve: 0.9, rest: 0.12, wake: 0.3, knurl: 0.9, satin: 0.1, grows: 0.07, dims: 0.3 },
  /**
   * The window with the value in it. `wide` and `tall` are its size as shares of the zone (with a cap in px), `up` how far above the
   * zone's middle it sits (share of the zone's height), and `zoom` how many times bigger it is while its value is being changed.
   */
  window: { wide: 0.56, tall: 0.17, cap: [210, 74], up: 0.1, zoom: 1.45, corner: 18 },
  /** How much the shown finger hangs back in a notch before slipping to the next (1 = follows the finger exactly; higher = stickier). */
  stick: 2.4,
  maxPixelRatio: 2,
}

type Axis = 'along' | 'across'
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!

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
// The value itself is drawn on the counter drum by the shader; these are the quiet words round it.
const blocks = zones.map((zone) => {
  const block = document.createElement('div')
  block.className = 'zone'
  block.innerHTML = `<span class="name"></span><span class="second"></span><span class="how">↕ ${zone.along.name.toLowerCase()} · ↔ ${zone.across.name.toLowerCase()} · second finger: ${zone.turn.name.toLowerCase()} on or off</span>`
  document.querySelector('#zones')!.append(block)
  return block
})
const reading = zones.map(() => 'along' as Axis) // which setting each zone's window shows
function write() {
  zones.forEach((zone, index) => {
    const [name, second] = blocks[index].children
    const other: Axis = reading[index] === 'along' ? 'across' : 'along'
    name.textContent = `${zone.name} · ${zone[reading[index]].name}`
    second.textContent = `${zone[other].name} ${worded(zone, other)} · ${zone.turn.name} ${zone.on ? 'on' : 'off'}`
    blocks[index].classList.toggle('off', !zone.on)
  })
}
write()

// ---- Modes -----------------------------------------------------------------------
const modes = { dark: false, voice: voice.on }
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
    voice.on = modes.voice
    if (key === 'voice' && !modes.voice) speechSynthesis?.cancel()
    if (key === 'dark') say(modes.dark ? 'Eyes free. The screen is dark.' : 'Screen on.')
  })
  document.querySelector('#modes')!.append(button)
}

// Say plainly when this browser gives a page no vibration, so silence under the finger is not taken for a fault.
if (!felt) document.querySelector('#note')!.append(' This browser gives web pages no vibration (iPhones do not): here it is sound only.')

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
const turned = zones.map(() => ({ along: 0, across: 0 })) // notches each drum has turned in all, so its ridges never jump
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
  turned[zones.indexOf(finger.zone)][axis] += way
  finger.notches += way
  feel.notch(setting.lowest, setting.highest, share(finger.zone, axis), axis === 'across')
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
    reading[zones.indexOf(finger.zone)] = finger.axis
    write()
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

// ---- The picture -----------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
const view = new THREE.Camera()
const two = <T>(make: () => T) => [make(), make()]

/** A strip of every value a setting can take, one above the next, for the counter drum to show. */
const CELL = { wide: 384, tall: 128 }
function tape(zone: Zone, axis: Axis) {
  const setting = zone[axis]
  const count = Math.round((setting.most - setting.least) / setting.step) + 1
  const strip = document.createElement('canvas')
  strip.width = CELL.wide
  strip.height = CELL.tall * count
  const pen = strip.getContext('2d')!
  pen.fillStyle = '#fff'
  pen.textAlign = 'center'
  pen.textBaseline = 'middle'
  const kept = zone.values[axis]
  for (let index = 0; index < count; index++) {
    zone.values[axis] = setting.least + index * setting.step
    const words = worded(zone, axis)
    pen.font = `600 ${words.length > 5 ? 62 : 100}px Inter, system-ui, -apple-system, 'Segoe UI', sans-serif`
    pen.fillText(words, CELL.wide / 2, CELL.tall * (index + 0.54))
  }
  zone.values[axis] = kept
  const picture = new THREE.CanvasTexture(strip)
  picture.anisotropy = 8
  return { picture, count }
}
const tapes = zones.map((zone) => ({ along: tape(zone, 'along'), across: tape(zone, 'across') }))

const sheet = new THREE.ShaderMaterial({
  uniforms: {
    uSize: { value: new THREE.Vector2() },
    uRatio: { value: 1 },
    uDark: { value: 0 },
    uRect: { value: two(() => new THREE.Vector4()) }, // each roller: its middle (x, y) and half its size (x, y), px
    uRoll: { value: two(() => new THREE.Vector4()) }, // how much of a drum it is for up/down and for sideways; how far each has turned, px
    uPitch: { value: zones.map((zone) => new THREE.Vector2(zone.along.px, zone.across.px)) },
    uWindow: { value: two(() => new THREE.Vector4()) }, // each window: its middle and half its size, px
    uRead: { value: two(() => new THREE.Vector4()) }, // the value shown (as a place in its strip), how many values, which setting (0 up/down, 1 sideways), how lit
    uZone: { value: two(() => new THREE.Vector4()) }, // how full, on or off, how dimmed
    uFinger: { value: two(() => new THREE.Vector4()) }, // where a finger is (x, y), how far pressed in, how hard against the end
    uLow: { value: zones.map((zone) => new THREE.Color(zone.tint[0])) },
    uHigh: { value: zones.map((zone) => new THREE.Color(zone.tint[1])) },
    uAccent: { value: zones.map((zone) => new THREE.Color(zone.accent)) },
    uLook: { value: new THREE.Vector4(settings.roller.corner, settings.roller.curve, settings.roller.knurl, settings.roller.satin) },
    uCorner: { value: settings.window.corner },
    uTape0a: { value: tapes[0].along.picture },
    uTape0b: { value: tapes[0].across.picture },
    uTape1a: { value: tapes[1].along.picture },
    uTape1b: { value: tapes[1].across.picture },
  },
  vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform vec2 uSize, uPitch[2];
    uniform float uRatio, uDark, uCorner;
    uniform vec4 uRect[2], uRoll[2], uWindow[2], uRead[2], uZone[2], uFinger[2], uLook;
    uniform vec3 uLow[2], uHigh[2], uAccent[2];
    uniform sampler2D uTape0a, uTape0b, uTape1a, uTape1b;

    // How far outside (+) or inside (−) a rounded rectangle a point is, px.
    float box(vec2 q, vec2 half_, float corner) {
      vec2 d = abs(q) - half_ + corner;
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - corner;
    }
    // One ridge and the groove beside it, per turn of 't': how deep the groove is (0–1), and which way its wall leans.
    vec2 knurl(float t) {
      float wave = 0.5 + 0.5 * cos(6.2831853 * t);
      return vec2(pow(wave, 26.0), -26.0 * pow(wave, 25.0) * 3.1415927 * sin(6.2831853 * t));
    }
    float written(int zone, float sideways, vec2 at) {
      if (zone == 0) return sideways < 0.5 ? texture2D(uTape0a, at).a : texture2D(uTape0b, at).a;
      return sideways < 0.5 ? texture2D(uTape1a, at).a : texture2D(uTape1b, at).a;
    }
    // Long soft lamps overhead, seen in a satin surface: a strong band above the middle, a faint one below.
    float bands(vec3 n) {
      return exp(-pow((n.y + 0.42) / 0.17, 2.0)) + 0.22 * exp(-pow((n.y - 0.56) / 0.26, 2.0)) + 0.5 * exp(-pow((n.x + 0.5) / 0.2, 2.0)) * abs(n.x);
    }

    void main() {
      vec2 p = vec2(gl_FragCoord.x, uSize.y * uRatio - gl_FragCoord.y) / uRatio;
      vec3 colour = vec3(0.012, 0.014, 0.016);   // the dashboard the rollers are set into
      for (int i = 0; i < 2; i++) {
        vec4 rect = uRect[i];
        vec2 q = p - rect.xy;
        float outside = box(q, rect.zw, uLook.x);
        if (outside > 1.0) continue;

        // ---- The roller: flat when left alone, a drum across the slide when turned ----
        float upDown = uRoll[i].x, sideways = uRoll[i].y;
        vec2 round_ = clamp(q / rect.zw * uLook.y, -0.999, 0.999);
        vec3 n = normalize(vec3(round_.x * sideways, round_.y * upDown, sqrt(max(1.0 - round_.x * round_.x * sideways * sideways - round_.y * round_.y * upDown * upDown, 0.04))));
        vec2 onDrum = vec2(mix(q.x, rect.z * asin(round_.x) / uLook.y, sideways), mix(q.y, rect.w * asin(round_.y) / uLook.y, upDown));
        vec2 ridgeA = knurl((onDrum.y + uRoll[i].z) / uPitch[i].x);
        vec2 ridgeB = knurl((onDrum.x - uRoll[i].w) / uPitch[i].y);
        float showA = max(upDown, 0.2 * (1.0 - sideways)), showB = sideways;
        n = normalize(n + uLook.z * 0.05 * vec3(showB * ridgeB.y, showA * ridgeA.y, 0.0));
        float grooves = showA * ridgeA.x + showB * ridgeB.x;

        vec4 zone = uZone[i];
        vec3 body = mix(uLow[i], uHigh[i], zone.x);
        body = mix(vec3(dot(body, vec3(0.33))) * 0.7, body, zone.y);
        vec3 lamp = normalize(vec3(-0.12, -0.5, 0.86));
        vec3 made = body * (0.22 + 1.0 * clamp(dot(n, lamp), 0.0, 1.0)) * (1.0 - 0.32 * grooves);
        made += vec3(0.82, 0.88, 0.94) * bands(n) * uLook.w * (1.0 - 0.7 * grooves);
        made *= mix(0.35, 1.0, smoothstep(0.0, 54.0, -outside));                    // darker where it sinks into the dashboard

        // ---- Fingers on it: a soft press, lit faintly in the zone's colour ----
        for (int f = 0; f < 2; f++) {
          vec2 away = p - uFinger[f].xy;
          float under = uFinger[f].z * exp(-dot(away, away) / (2.0 * 44.0 * 44.0));
          made = made * (1.0 - 0.22 * under) + uAccent[i] * under * 0.07 * zone.y;
          made += vec3(0.5, 0.12, 0.08) * uFinger[f].w * under * 0.35;                // against the end stop
        }

        // ---- The window: a counter drum behind glass ----
        vec4 pane = uWindow[i];
        vec2 w = p - pane.xy;
        float beyond = box(w, pane.zw, uCorner);
        if (beyond < 1.5) {
          float across = uRead[i].z;
          float along = clamp((across < 0.5 ? w.y / pane.w : w.x / pane.z) * 0.95, -0.999, 0.999);
          float angle = asin(along);
          float tall = pane.w * 1.02;                                                // one value's height on the drum
          float wide = tall * 3.0;
          // The counter turns against the roller, like two meshed wheels: higher values stand above, and to the right.
          float cell = uRead[i].x + (across < 0.5 ? -pane.w * angle / tall : pane.z * angle / (wide * 0.62));
          float which = floor(cell + 0.5);
          vec2 inCell = across < 0.5 ? vec2(w.x / wide + 0.5, which - cell + 0.5) : vec2(cell - which + 0.5, w.y / tall + 0.5);
          float ink = 0.0;
          if (which > -0.5 && which < uRead[i].y - 0.5 && inCell.x > 0.0 && inCell.x < 1.0 && inCell.y > 0.0 && inCell.y < 1.0)
            ink = written(i, across, vec2(inCell.x, 1.0 - (which + inCell.y) / uRead[i].y));
          float facing = cos(angle);
          float middle = exp(-pow(along / 0.42, 2.0));
          vec3 drum = vec3(0.03, 0.034, 0.038) * (0.35 + 0.95 * facing);
          drum += vec3(1.0) * ink * facing * mix(0.2, 1.0, middle) * mix(0.4, 1.0, zone.y);
          drum += uAccent[i] * uRead[i].w * 0.05 * middle;
          drum *= mix(0.3, 1.0, smoothstep(0.0, 20.0, -beyond));                     // the shadow of the window's edge
          drum += 0.035 * smoothstep(0.2, -1.0, w.y / pane.w);                       // the glass, catching light near its top
          made = mix(made, drum, smoothstep(1.0, -1.0, beyond));
          made += 0.1 * exp(-pow((beyond - 1.0) / 1.3, 2.0));                        // its bevelled rim
        }
        made *= 1.0 - zone.z;
        colour = mix(colour, made, smoothstep(1.0, -1.0, outside));
      }
      colour += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
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
}
addEventListener('resize', resize)
resize()

/** What is drawn of each zone, easing toward what is so. */
const drawn = zones.map((zone, index) => ({
  drum: { along: settings.roller.rest, across: 0 },
  turned: { along: 0, across: 0 },
  place: (zone.values[reading[index]] - zone[reading[index]].least) / zone[reading[index]].step,
  busy: 0,
  dim: 0,
}))
let before = performance.now()
let dark = 0
let split = 0.5 // how much of the screen the first zone has
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
function draw(now: number) {
  const passed = Math.min((now - before) / 1000, 0.05)
  before = now
  const toward = (from: number, to: number, speed: number) => (still ? to : from + (to - from) * (1 - Math.exp(-passed * speed)))
  const u = sheet.uniforms

  for (const slot of [0, 1]) u.uFinger.value[slot].set(0, 0, 0, 0)
  for (let index = fingers.length - 1; index >= 0; index--) {
    const finger = fingers[index]
    finger.shown.press = toward(finger.shown.press, finger.down ? 1 : 0, finger.down ? 22 : 9)
    finger.shown.wall = toward(finger.shown.wall, finger.wall && finger.down ? 1 : 0, 7)
    if (!finger.down && finger.shown.press < 0.01) fingers.splice(index, 1)
    else if (finger.slot >= 0) u.uFinger.value[finger.slot].set(finger.now.x, finger.now.y, finger.shown.press, finger.shown.wall)
  }

  // The zone being changed takes a little of the screen from the other.
  const sliding = zones.map((zone) => fingers.find((finger) => finger.down && finger.zone === zone && finger.axis))
  split = toward(split, 0.5 + settings.roller.grows * ((sliding[0] ? 1 : 0) - (sliding[1] ? 1 : 0)), 7)
  const tallWay = upright()
  zones.forEach((zone, index) => {
    const state = drawn[index]
    const finger = sliding[index]
    const resting = fingers.some((each) => each.down && each.zone === zone)
    const axis = reading[index]
    // How far into the next notch the sliding finger is, hanging back at first and then slipping on.
    const part = finger ? finger.carried / zone[finger.axis!].px : 0
    const slipped = Math.sign(part) * Math.abs(part) ** settings.stick
    for (const each of ['along', 'across'] as const) {
      const wanted = finger?.axis === each ? 1 : each === 'along' && !finger ? (resting ? settings.roller.wake : settings.roller.rest) : 0
      state.drum[each] = toward(state.drum[each], wanted, 9)
      state.turned[each] = toward(state.turned[each], (turned[index][each] + (finger?.axis === each ? slipped : 0)) * zone[each].px, 30)
    }
    state.place = toward(state.place, (zone.values[axis] - zone[axis].least) / zone[axis].step + (finger ? slipped : 0), 26)
    state.busy = toward(state.busy, finger ? 1 : 0, 8)
    state.dim = toward(state.dim, !finger && sliding.some(Boolean) ? settings.roller.dims : 0, 7)

    // Where the roller and its window are.
    const from = index === 0 ? 0 : split
    const to = index === 0 ? split : 1
    const inset = settings.roller.inset
    const box = tallWay
      ? { left: 0, top: from * innerHeight, wide: innerWidth, tall: (to - from) * innerHeight }
      : { left: from * innerWidth, top: 0, wide: (to - from) * innerWidth, tall: innerHeight }
    const half = { x: box.wide / 2 - inset * (tallWay ? 1 : 0.75), y: box.tall / 2 - inset * (tallWay ? 0.75 : 1) }
    const middle = { x: box.left + box.wide / 2, y: box.top + box.tall / 2 }
    u.uRect.value[index].set(middle.x, middle.y, half.x, half.y)
    const zoom = 1 + (settings.window.zoom - 1) * state.busy
    const pane = {
      x: middle.x,
      y: middle.y - half.y * 2 * settings.window.up,
      wide: Math.min(half.x * settings.window.wide, settings.window.cap[0]) * zoom,
      tall: Math.min(half.y * 2 * settings.window.tall, settings.window.cap[1]) * zoom,
    }
    u.uWindow.value[index].set(pane.x, pane.y, pane.wide, pane.tall)
    u.uRoll.value[index].set(state.drum.along, state.drum.across, state.turned.along, state.turned.across)
    u.uRead.value[index].set(state.place, tapes[index][axis].count, axis === 'along' ? 0 : 1, state.busy)
    const shown = u.uZone.value[index]
    shown.set(toward(shown.x, share(zone, 'along'), 12), toward(shown.y, zone.on ? 1 : 0, 8), state.dim, 0)

    // The words sit just above and below the window, wherever it is.
    const block = blocks[index].style
    block.left = `${box.left}px`
    block.top = `${box.top}px`
    block.width = `${box.wide}px`
    block.height = `${box.tall}px`
    block.setProperty('--above', `${pane.y - pane.tall - box.top}px`)
    block.setProperty('--below', `${pane.y + pane.tall - box.top}px`)
    block.opacity = String(1 - state.dim * 1.6)
  })
  dark = toward(dark, modes.dark ? 1 : 0, 6)
  u.uDark.value = dark
  renderer.render(scene, view)
  requestAnimationFrame(draw)
}
requestAnimationFrame(draw)
