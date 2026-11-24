import './car.css'
import { icon } from './icons'
import { makeSill, type Bay, type Crossing, type Rising } from './sill'
import { feel, felt, say, voice, wake } from '../tactile/feel'

/**
 * A whole car screen made of Groove zones (see ../tactile/main.ts for the control itself and the reasons behind it).
 *
 * Nothing on it is a button to aim at. The screen is four zones, each found by where it is against the screen's own edges:
 * - the stage, the upper part: a block of four scenes (Map, Media, Car, Phone) that rolls sideways like a drum, one scene per notch.
 *   Sliding up or down works the scene's own setting; a second-finger tap is the scene's one action.
 * - three rollers along the bottom, where a hand falls: the driver's climate by the driver, sound in the middle, the passenger's climate.
 * The bottom of the screen is the sill: one slab of dark machined metal, drawn in real 3D (see sill.ts). Its settings are shapes cut
 * into it: a knurled roller in a slot for temperature, milled waves for the fan, turned rings for volume, a ball in a row of dimples
 * for the track, glowing slots for seat heat. What stands up is worked up and down, what runs across is worked sideways, and each
 * carries its usual icon. The one being changed keeps the light and its number grows; the rest of the slab falls back.
 * The stage's scenes sit on a wide drum, with the next and the previous scene showing at its edges, so it is plain there is more that way.
 * In every zone: a finger put down changes nothing, up/down is one setting and sideways another, each step is a notch that is heard
 * and felt, the ends stop, and a second-finger tap (or a double tap) switches. The zone being changed grows; the rest dims.
 */
const settings = {
  /** How far (px) a finger moves before it counts as a slide; how short (ms) a tap is, and how close together two make a double tap. */
  slack: 14,
  tap: 260,
  again: 380,
  /** A resting finger hears where it is after this long (ms); a slide hears its value this long after it stops. */
  rest: 420,
  settle: 650,
  /** How much the picture hangs back in a notch before slipping to the next (1 = follows the finger exactly). */
  stick: 2.4,
  /**
   * The stage's drum: how much of the stage's width one scene takes (the rest shows its neighbours), and the angle between scenes.
   */
  drum: { face: 0.8, angle: 34 },
  /** How fast the fan's waves cross their bay at full speed (bays a second). */
  air: 0.42,
  /** Which side the driver sits: 'left' or 'right'. The driver's climate is on that side. */
  driver: 'left' as 'left' | 'right',
}

// ---- What can be set ---------------------------------------------------------------
/** One setting: either a run of numbers (least … most by step) or a list of named values. `px` is the slide for one notch. */
type Dial = { thing?: Rising | Crossing; icon?: string; name: string; least: number; most: number; step: number; value: number; px: number; unit: string; names?: string[]; lowest: number; highest: number; heavy?: boolean; flipped?: boolean }
type Turn = { name: string; on: boolean; words: [string, string]; icon?: string }
type Axis = 'along' | 'across'
const numbers = (name: string, least: number, most: number, step: number, value: number, px: number, unit: string, pitch: [number, number]): Dial => ({ name, least, most, step, value, px, unit, lowest: pitch[0], highest: pitch[1] })
const named = (name: string, names: string[], value: number, px: number, pitch: [number, number]): Dial => ({ name, names, least: 0, most: names.length - 1, step: 1, value, px, unit: '', lowest: pitch[0], highest: pitch[1], heavy: true })
const place = (dial: Dial) => (dial.value - dial.least) / dial.step
const part = (dial: Dial) => (dial.value - dial.least) / (dial.most - dial.least || 1)
const word = (dial: Dial, at = place(dial)) => dial.names?.[at] ?? `${dial.least + at * dial.step}${dial.unit}`

/** The stage's scenes: each has one setting of its own (up/down) and one action (second finger). */
const scenes = [
  { name: 'Map', along: named('Zoom', ['Region', 'City', 'Streets', 'Junction'], 2, 54, [360, 620]), turn: { name: 'Guidance', on: true, words: ['on', 'muted'] } as Turn },
  { name: 'Media', along: named('Playlist', ['Morning drive', 'Desert nights', 'Deep focus', 'Podcasts'], 1, 54, [360, 620]), turn: { name: 'Music', on: true, words: ['playing', 'paused'] } as Turn },
  { name: 'Car', along: named('Drive mode', ['Eco', 'Comfort', 'Sport'], 1, 64, [360, 620]), turn: { name: 'Doors', on: true, words: ['locked', 'unlocked'] } as Turn },
  { name: 'Phone', along: named('Contact', ['Home', 'Office', 'Sara', 'Omar'], 0, 54, [360, 620]), turn: { name: 'Call', on: false, words: ['started', 'ended'] } as Turn },
]
const scene = { ...named('Scene', scenes.map((each) => each.name), 0, 150, [240, 400]), flipped: true } // slid like a page: to the left for the next one

type Zone = { key: string; name: string; along: () => Dial; across: Dial; turn: () => Turn; made: HTMLElement }
const climate = (key: string, name: string, second: Dial): Zone => {
  const along: Dial = { ...numbers('Temperature', 16, 28, 0.5, key === 'driver' ? 21 : 22.5, 30, '°', [420, 840]), thing: 'column', icon: 'temperature' }
  const turn: Turn = { name: 'A/C', on: true, words: ['on', 'off'], icon: 'cold' }
  return { key, name, along: () => along, across: second, turn: () => turn, made: document.createElement('section') }
}
const volume: Dial = { ...numbers('Volume', 0, 30, 1, 12, 22, '', [380, 900]), thing: 'rings', icon: 'volume' }
const sound: Turn = { name: 'Sound', on: true, words: ['on', 'muted'], icon: 'volume' }
const zones: Zone[] = [
  { key: 'stage', name: 'Stage', along: () => scenes[scene.value].along, across: scene, turn: () => scenes[scene.value].turn, made: document.createElement('section') },
  climate('driver', 'Driver', { ...numbers('Fan', 0, 7, 1, 3, 46, '', [300, 520]), thing: 'air', icon: 'fan' }),
  { key: 'sound', name: 'Sound', along: () => volume, across: { ...named('Track', ['Low Sun', 'Glass Road', 'Night Shift', 'Open Water', 'Slow Signal'], 1, 70, [330, 560]), thing: 'points', icon: 'track' }, turn: () => sound, made: document.createElement('section') },
  climate('passenger', 'Passenger', { ...numbers('Seat heat', 0, 3, 1, 1, 60, '', [300, 520]), thing: 'element', icon: 'seat' }),
]
const [stage, ...rollers] = zones
const dialOf = (zone: Zone, axis: Axis) => (axis === 'along' ? zone.along() : zone.across)
if (settings.driver === 'right') rollers.reverse()

// ---- Building the screen -----------------------------------------------------------
const car = document.querySelector<HTMLElement>('#car')!
const status = document.createElement('div')
status.className = 'status'
car.append(status)

stage.made.className = 'zone stage'
stage.made.innerHTML = `
  <div class="prism">
    <article class="scene map">
      <svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g class="land">
          <g class="roads"><path d="M-40 120H840M-40 260H840M-40 400H840M120-40V540M300-40V540M480-40V540M660-40V540" /><path class="lanes" d="M-40 190H840M-40 330H840M210-40V540M390-40V540M570-40V540" /><path class="wide" d="M-40 470C200 430 330 300 480 260S700 150 840 60" /></g>
          <path class="water" d="M560 540C600 470 700 440 840 430V540Z" />
          <path class="route" d="M300 540V400H480V260C560 240 620 200 660 160V-40" />
          <circle class="puck" cx="480" cy="330" r="13" /><circle class="puck-dot" cx="480" cy="330" r="5" />
        </g>
      </svg>
      <div class="turn"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M16 40V24a8 8 0 0 1 8-8h12M29 9l8 7-8 7" /></svg><div><b>350 m</b><span>Al Wasl Road</span></div></div>
      <div class="arrive"><b>18 min</b><span>12 km · arrive 10:02</span></div>
    </article>
    <article class="scene media">
      <div class="art"></div>
      <div class="playing"><span class="small">Now playing</span><b class="track"></b><span class="by">The Quiet Engines</span><div class="bar"><i></i></div></div>
      <ol class="list"></ol>
    </article>
    <article class="scene vehicle">
      <svg viewBox="0 0 300 560" aria-hidden="true"><rect class="body" x="62" y="40" width="176" height="480" rx="74" /><path class="glass" d="M88 190q62-34 124 0l-10 64H98zM98 388h104l8 54q-60 26-120 0z" /><rect class="wheel" x="44" y="118" width="22" height="70" rx="9" /><rect class="wheel" x="234" y="118" width="22" height="70" rx="9" /><rect class="wheel" x="44" y="380" width="22" height="70" rx="9" /><rect class="wheel" x="234" y="380" width="22" height="70" rx="9" /></svg>
      <dl><div><dt>Range</dt><dd class="range"></dd></div><div><dt>Battery</dt><dd>78%</dd></div><div><dt>Tyres</dt><dd>2.4 bar</dd></div><div><dt>Doors</dt><dd class="doors"></dd></div></dl>
      <ol class="list"></ol>
    </article>
    <article class="scene phone">
      <div class="face"></div>
      <div class="playing"><span class="small call"></span><b class="who"></b><span class="by">Mobile</span></div>
      <ol class="list"></ol>
    </article>
  </div>
  <div class="tag"><b></b><span></span></div>
  <ol class="pager">${scenes.map((each) => `<li>${icon({ Map: 'map', Media: 'track', Car: 'car', Phone: 'phone' }[each.name]!)}${each.name}</li>`).join('')}</ol>`
car.append(stage.made)

const wheelsCanvas = document.createElement('canvas')
wheelsCanvas.className = 'wheels'
car.append(wheelsCanvas)
const row = document.createElement('div')
row.className = 'row'
for (const zone of rollers) {
  zone.made.className = `zone roller ${zone.key}`
  // Each setting's icon, value and name sit under its light, with a small sign of the way it is worked.
  const half = (axis: Axis, dial: Dial) => `<div class="part ${axis}"><p class="read">${icon(dial.icon!)}<b></b><span>${dial.name}</span><i class="way"></i></p></div>`
  zone.made.innerHTML = `<header><span class="title">${zone.name}</span><span class="switch">${icon(zone.turn().icon!)}<em></em></span></header><div class="pair">${half('along', zone.along())}${half('across', zone.across)}</div>`
  row.append(zone.made)
}
car.append(row)

scenes.forEach((each, index) => {
  const list = stage.made.querySelectorAll('.scene')[index].querySelector('.list')
  list?.replaceChildren(...each.along.names!.map((name) => Object.assign(document.createElement('li'), { textContent: name })))
})

const reading = new Map<Zone, Axis>(zones.map((zone) => [zone, 'along'])) // which setting each roller's counter shows
const ranges = [268, 312, 241] // km, by drive mode
function write() {
  const now = new Date()
  status.innerHTML = `<span>${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}</span><span class="drive"><b>D</b> 86 km/h</span><span>${ranges[scenes[2].along.value]} km · 24° outside</span>`
  for (const zone of rollers) {
    for (const axis of ['along', 'across'] as const) zone.made.querySelector(`.part.${axis} .read b`)!.textContent = word(dialOf(zone, axis))
    zone.made.querySelector('.switch em')!.textContent = `${zone.turn().name} ${zone.turn().words[zone.turn().on ? 0 : 1]}`
    zone.made.classList.toggle('off', !zone.turn().on)
  }
  const current = scenes[scene.value]
  stage.made.querySelector('.tag b')!.textContent = current.name
  stage.made.querySelector('.tag span')!.textContent = `${current.along.name} ${word(current.along)} · ${current.turn.name} ${current.turn.words[current.turn.on ? 0 : 1]}`
  stage.made.querySelectorAll('.pager li').forEach((item, at) => item.classList.toggle('chosen', at === scene.value))
  scenes.forEach((each, index) => {
    const made = stage.made.querySelectorAll<HTMLElement>('.scene')[index]
    made.classList.toggle('off', !each.turn.on)
    made.dataset.at = String(each.along.value)
    made.querySelectorAll('.list li').forEach((item, at) => item.classList.toggle('chosen', at === each.along.value))
  })
  const set = (pick: string, words: string) => (stage.made.querySelector(pick)!.textContent = words)
  set('.track', (zones.find((zone) => zone.key === 'sound')!.across.names ?? [])[zones.find((zone) => zone.key === 'sound')!.across.value])
  set('.range', `${ranges[scenes[2].along.value]} km`)
  set('.doors', scenes[2].turn.on ? 'Locked' : 'Unlocked')
  set('.who', word(scenes[3].along))
  set('.call', scenes[3].turn.on ? 'Calling…' : 'Favourites')
  set('.face', word(scenes[3].along)[0])
}
write()
setInterval(write, 20000)

// ---- Modes -------------------------------------------------------------------------
const modes = { dark: false, voice: voice.on }
const labels: Record<keyof typeof modes, string> = { dark: 'Eyes-free', voice: 'Voice' }
for (const key of Object.keys(modes) as (keyof typeof modes)[]) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = labels[key]
  button.setAttribute('aria-pressed', String(modes[key]))
  button.addEventListener('click', () => {
    modes[key] = !modes[key]
    voice.on = modes.voice
    button.setAttribute('aria-pressed', String(modes[key]))
    document.body.classList.toggle('dark', modes.dark)
    if (key === 'voice' && !modes.voice) speechSynthesis?.cancel()
    if (key === 'dark') say(modes.dark ? 'Eyes free. The screen is dark.' : 'Screen on.')
  })
  document.querySelector('#modes')!.append(button)
}
if (!felt) document.body.classList.add('unfelt')

// ---- Fingers -----------------------------------------------------------------------
type Finger = { id: number; zone: Zone; from: { x: number; y: number; at: number }; now: { x: number; y: number }; axis: Axis | null; carried: number; wall: number; timer: number; down: boolean }
const fingers: Finger[] = []
const turned = new Map(zones.map((zone) => [zone, { along: 0, across: 0 }])) // notches each roller has turned in all, so its ridges never jump
const lastTap = { at: 0, zone: null as Zone | null }
const zoneAt = (x: number, y: number) => zones.find((zone) => zone.made === document.elementFromPoint(x, y)?.closest('.zone'))

function turn(zone: Zone) {
  const it = zone.turn()
  it.on = !it.on
  feel.turn(it.on)
  say(`${it.name} ${it.words[it.on ? 0 : 1]}`)
  write()
}
function notch(finger: Finger, way: number) {
  const dial = dialOf(finger.zone, finger.axis!)
  const next = dial.value + way * dial.step
  if (next < dial.least || next > dial.most) {
    if (finger.wall !== way) feel.stop()
    finger.wall = way
    finger.carried = 0 // pinned: turning back answers at once, as a knob does at its stop
    return false
  }
  finger.wall = 0
  dial.value = next
  turned.get(finger.zone)![finger.axis!] += way
  feel.notch(dial.lowest, dial.highest, part(dial), Boolean(dial.heavy))
  write()
  return true
}

car.addEventListener('pointerdown', (event) => {
  wake()
  const zone = zoneAt(event.clientX, event.clientY)
  if (!zone) return
  car.setPointerCapture(event.pointerId)
  const resting = fingers.find((finger) => finger.down)
  const finger: Finger = { id: event.pointerId, zone, from: { x: event.clientX, y: event.clientY, at: performance.now() }, now: { x: event.clientX, y: event.clientY }, axis: null, carried: 0, wall: 0, timer: 0, down: true }
  fingers.push(finger)
  feel.land()
  // A finger that stays put is asking where it is.
  if (!resting)
    finger.timer = window.setTimeout(() => {
      const name = zone === stage ? scenes[scene.value].name : zone.name
      say(`${name}. ${zone.along().name} ${word(zone.along())}.${zone === stage ? '' : ` ${zone.across.name} ${word(zone.across)}.`}`)
    }, settings.rest)
})
car.addEventListener('pointermove', (event) => {
  const finger = fingers.find((each) => each.id === event.pointerId && each.down)
  if (!finger) return
  const moved = { x: event.clientX - finger.now.x, y: event.clientY - finger.now.y }
  finger.now = { x: event.clientX, y: event.clientY }
  if (!finger.axis) {
    const far = { x: finger.now.x - finger.from.x, y: finger.now.y - finger.from.y }
    if (Math.hypot(far.x, far.y) < settings.slack) return
    finger.axis = Math.abs(far.y) >= Math.abs(far.x) ? 'along' : 'across'
    reading.set(finger.zone, finger.axis)
    clearTimeout(finger.timer)
    write()
    return
  }
  const dial = dialOf(finger.zone, finger.axis)
  finger.carried += (finger.axis === 'along' ? -moved.y : moved.x) * (dial.flipped ? -1 : 1) // up is more, right is more
  while (Math.abs(finger.carried) >= dial.px) {
    const way = Math.sign(finger.carried)
    if (!notch(finger, way)) break
    finger.carried -= way * dial.px
  }
  clearTimeout(finger.timer)
  const { zone, axis } = finger
  finger.timer = window.setTimeout(() => {
    const now = dialOf(zone, axis)
    say(zone === stage && axis === 'across' ? word(now) : `${now.name} ${word(now)}`)
  }, settings.settle)
})
function lift(event: PointerEvent) {
  const at = fingers.findIndex((each) => each.id === event.pointerId)
  if (at < 0) return
  const [finger] = fingers.splice(at, 1)
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
car.addEventListener('pointerup', lift)
car.addEventListener('pointercancel', lift)
car.addEventListener('contextmenu', (event) => event.preventDefault())

// ---- Drawing: the rollers' ridges, the counters and the stage's block of scenes, easing toward where they should be ----
const drawn = new Map(zones.map((zone) => [zone, { turned: { along: 0, across: 0 }, place: { along: place(zone.along()), across: place(zone.across) } }]))
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
let before = performance.now()
function draw(now: number) {
  const passed = Math.min((now - before) / 1000, 0.05)
  before = now
  const toward = (from: number, to: number, speed: number) => (still ? to : from + (to - from) * (1 - Math.exp(-passed * speed)))
  const busy = fingers.filter((finger) => finger.axis)
  car.classList.toggle('busy', busy.length > 0)
  for (const zone of zones) {
    const state = drawn.get(zone)!
    const finger = busy.find((each) => each.zone === zone)
    const held = fingers.some((each) => each.zone === zone)
    // How far into the next notch the sliding finger is: the picture hangs back at first, then slips on.
    const into = finger ? finger.carried / dialOf(zone, finger.axis!).px : 0
    const slipped = Math.sign(into) * Math.abs(into) ** settings.stick
    for (const axis of ['along', 'across'] as const) {
      const dial = dialOf(zone, axis)
      const extra = finger?.axis === axis ? slipped : 0
      state.turned[axis] = toward(state.turned[axis], (turned.get(zone)![axis] + extra) * dial.px, 30)
      state.place[axis] = toward(state.place[axis], place(dial) + extra, 26)
    }
    const made = zone.made
    made.classList.toggle('held', held)
    made.classList.toggle('busy', Boolean(finger))
    made.classList.toggle('sideways', (finger?.axis ?? reading.get(zone)) === 'across')
    made.classList.toggle('stopped', Boolean(finger?.wall))
    if (zone === stage) {
      // The drum of scenes turns with the finger; the scenes either side of the current one show at the stage's edges.
      const face = made.clientWidth * settings.drum.face
      const radius = face / (2 * Math.tan((settings.drum.angle * Math.PI) / 360))
      made.querySelector<HTMLElement>('.prism')!.style.transform = `translateZ(${-radius}px) rotateY(${-state.place.across * settings.drum.angle}deg)`
      made.querySelectorAll<HTMLElement>('.scene').forEach((each, index) => {
        const away = Math.abs(index - state.place.across)
        each.style.transform = `rotateY(${index * settings.drum.angle}deg) translateZ(${radius}px)`
        each.style.visibility = away < 1.6 ? 'visible' : 'hidden'
        each.style.setProperty('--away', String(Math.min(away, 1)))
        each.style.setProperty('--at', String(drawn.get(stage)!.place.along))
      })
      continue
    }
    for (const axis of ['along', 'across'] as const) made.querySelector(`.part.${axis}`)!.classList.toggle('busy', finger?.axis === axis)
  }
  paint(passed, now / 1000)
  requestAnimationFrame(draw)
}

// ---- The sill (sill.ts): told each frame where the bays are, what they are set to, and where the fingers are --------
const sill = makeSill(wheelsCanvas)
const lit = new Map(rollers.map((zone) => [zone, { on: 1, up: 0, over: 0, flow: 0 }]))
const pressed = [0, 0]
const focus = { x: 0, y: 0, amount: 0 }
function paint(passed: number, clock: number) {
  const band = row.getBoundingClientRect()
  const busy = fingers.find((finger) => finger.axis && rollers.includes(finger.zone))
  const ease = (from: number, to: number, speed: number) => from + (to - from) * (1 - Math.exp(-passed * speed))
  const bays: Bay[] = rollers.map((zone) => {
    const state = lit.get(zone)!
    const where = zone.made.getBoundingClientRect()
    const at = drawn.get(zone)!
    const mine = busy?.zone === zone
    state.on = ease(state.on, zone.turn().on ? 1 : 0, 7)
    state.up = ease(state.up, mine && busy!.axis === 'along' ? 1 : 0, 9)
    state.over = ease(state.over, mine && busy!.axis === 'across' ? 1 : 0, 9)
    state.flow += passed * settings.air * (0.12 + at.place.across / 7) * state.on // the air moves faster with every notch of the fan
    const rising = zone.along()
    if (mine) {
      // The light stays on the setting being changed: a third of the way across its bay, or three quarters.
      focus.x = where.left + where.width * (busy!.axis === 'along' ? 0.26 : 0.72)
      focus.y = band.top + band.height * 0.46
    }
    return {
      left: where.left,
      right: where.right,
      on: state.on,
      rise: { kind: rising.thing as Rising, part: Math.min(Math.max(at.place.along / Math.max(place({ ...rising, value: rising.most }), 1), 0), 1), turned: at.turned.along / rising.px, busy: state.up },
      cross: { kind: zone.across.thing as Crossing, place: at.place.across, busy: state.over, flow: state.flow },
    }
  })
  focus.amount = ease(focus.amount, busy ? 1 : 0, 8)
  const down = fingers.filter((each) => rollers.includes(each.zone)).slice(0, 2)
  const shown = [0, 1].map((slot) => {
    pressed[slot] = ease(pressed[slot], down[slot] ? 1 : 0, down[slot] ? 20 : 8)
    return { x: down[slot]?.now.x ?? 0, y: down[slot]?.now.y ?? 0, press: down[slot] ? pressed[slot] : 0 }
  })
  sill.paint({ wide: car.clientWidth, tall: car.clientHeight, top: band.top, bottom: band.bottom, bays, fingers: shown, clock, focus })
}
requestAnimationFrame(draw)
