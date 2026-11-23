import './car.css'
import { feel, felt, say, voice, wake } from '../tactile/feel'

/**
 * A whole car screen made of Groove zones (see ../tactile/main.ts for the control itself and the reasons behind it).
 *
 * Nothing on it is a button to aim at. The screen is four zones, each found by where it is against the screen's own edges:
 * - the stage, the upper part: a block of four scenes (Map, Media, Car, Phone) that rolls sideways like a drum, one scene per notch.
 *   Sliding up or down works the scene's own setting; a second-finger tap is the scene's one action.
 * - three rollers along the bottom, where a hand falls: the driver's climate by the driver, sound in the middle, the passenger's climate.
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
  /** Degrees between one value and the next on a counter wheel, and how many values either side of the current one are drawn. */
  wheel: { step: 24, either: 3 },
  /** Which side the driver sits: 'left' or 'right'. The driver's climate is on that side. */
  driver: 'left' as 'left' | 'right',
}

// ---- What can be set ---------------------------------------------------------------
/** One setting: either a run of numbers (least … most by step) or a list of named values. `px` is the slide for one notch. */
type Dial = { name: string; least: number; most: number; step: number; value: number; px: number; unit: string; names?: string[]; lowest: number; highest: number; heavy?: boolean; flipped?: boolean }
type Turn = { name: string; on: boolean; words: [string, string] }
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
  const along = numbers('Temperature', 16, 28, 0.5, key === 'driver' ? 21 : 22.5, 30, '°', [420, 840])
  const turn: Turn = { name: 'A/C', on: true, words: ['on', 'off'] }
  return { key, name, along: () => along, across: second, turn: () => turn, made: document.createElement('section') }
}
const volume = numbers('Volume', 0, 30, 1, 12, 22, '', [380, 900])
const sound: Turn = { name: 'Sound', on: true, words: ['on', 'muted'] }
const zones: Zone[] = [
  { key: 'stage', name: 'Stage', along: () => scenes[scene.value].along, across: scene, turn: () => scenes[scene.value].turn, made: document.createElement('section') },
  climate('driver', 'Driver', numbers('Fan', 0, 7, 1, 3, 46, '', [300, 520])),
  { key: 'sound', name: 'Sound', along: () => volume, across: named('Track', ['Low Sun', 'Glass Road', 'Night Shift', 'Open Water', 'Slow Signal'], 1, 70, [330, 560]), turn: () => sound, made: document.createElement('section') },
  climate('passenger', 'Passenger', numbers('Seat heat', 0, 3, 1, 1, 60, '', [300, 520])),
]
const [stage, ...rollers] = zones
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
  <div class="tag"><b></b><span></span></div>`
car.append(stage.made)

const row = document.createElement('div')
row.className = 'row'
for (const zone of rollers) {
  zone.made.className = `zone roller ${zone.key}`
  zone.made.innerHTML = `<div class="ridges a"></div><div class="ridges b"></div><span class="label"></span><div class="counter"><div class="wheel a"></div><div class="wheel b"></div></div><span class="second"></span>`
  row.append(zone.made)
}
car.append(row)

/** Fills a counter wheel with every value of a setting, each on its own facet of the wheel. */
function facets(wheel: HTMLElement, dial: Dial) {
  wheel.replaceChildren(
    ...Array.from({ length: place({ ...dial, value: dial.most }) + 1 }, (_, at) => {
      const facet = document.createElement('span')
      facet.textContent = word(dial, at)
      if (facet.textContent.length > 5) facet.className = 'long'
      return facet
    }),
  )
}
for (const zone of rollers) {
  facets(zone.made.querySelector('.wheel.a')!, zone.along())
  facets(zone.made.querySelector('.wheel.b')!, zone.across)
}
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
    const shown = reading.get(zone)!
    const other = shown === 'along' ? zone.across : zone.along()
    const dial = shown === 'along' ? zone.along() : zone.across
    zone.made.querySelector('.label')!.textContent = `${zone.name} · ${dial.name}`
    zone.made.querySelector('.second')!.textContent = `${other.name} ${word(other)} · ${zone.turn().name} ${zone.turn().words[zone.turn().on ? 0 : 1]}`
    zone.made.classList.toggle('off', !zone.turn().on)
  }
  const current = scenes[scene.value]
  stage.made.querySelector('.tag b')!.textContent = current.name
  stage.made.querySelector('.tag span')!.textContent = `${current.along.name} ${word(current.along)} · ${current.turn.name} ${current.turn.words[current.turn.on ? 0 : 1]}`
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
const dialOf = (zone: Zone, axis: Axis) => (axis === 'along' ? zone.along() : zone.across)
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
const radians = (settings.wheel.step * Math.PI) / 180
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
      // The block of scenes turns with the finger; the scene's own setting shows inside the scene.
      const wide = made.clientWidth
      made.querySelector<HTMLElement>('.prism')!.style.transform = `translateZ(${-wide / 2}px) rotateY(${-state.place.across * 90}deg)`
      made.querySelectorAll<HTMLElement>('.scene').forEach((each, index) => {
        each.style.transform = `rotateY(${index * 90}deg) translateZ(${wide / 2}px)`
        each.style.visibility = Math.abs(index - state.place.across) < 1.02 ? 'visible' : 'hidden'
        each.style.setProperty('--at', String(drawn.get(stage)!.place.along))
      })
      continue
    }
    made.style.setProperty('--a', `${-state.turned.along}px`)
    made.style.setProperty('--b', `${state.turned.across}px`)
    made.style.setProperty('--pa', `${zone.along().px}px`)
    made.style.setProperty('--pb', `${zone.across.px}px`)
    const counter = made.querySelector<HTMLElement>('.counter')!
    for (const axis of ['along', 'across'] as const) {
      const wheel = made.querySelector<HTMLElement>(axis === 'along' ? '.wheel.a' : '.wheel.b')!
      const facet = axis === 'along' ? counter.clientHeight * 0.62 : counter.clientWidth * 0.46
      const radius = facet / (2 * Math.tan(radians / 2))
      const spin = axis === 'along' ? 'rotateX' : 'rotateY'
      // Higher values stand above, and to the right: the counter turns against the roller, like two meshed wheels.
      wheel.style.transform = `translateZ(${-radius}px) ${spin}(${-state.place[axis] * settings.wheel.step}deg)`
      Array.from(wheel.children as HTMLCollectionOf<HTMLElement>).forEach((each, at) => {
        const away = Math.abs(at - state.place[axis])
        each.style.display = away > settings.wheel.either ? 'none' : ''
        each.style.transform = `${spin}(${at * settings.wheel.step}deg) translateZ(${radius}px)`
        each.style.opacity = String(Math.max(0, 1 - away * 0.62))
      })
    }
  }
  requestAnimationFrame(draw)
}
requestAnimationFrame(draw)
