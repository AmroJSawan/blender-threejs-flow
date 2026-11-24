import './air.css'
import { icon } from '../car/icons'
import { feel, say, voice, wake } from '../tactile/feel'
import { state as streaks, tint } from './strands'

/**
 * Air in the cabin. Two things are laid together here:
 * - Baked in Blender (blender/make_cabin.py), from straight above and framed alike: an open, detailed car model with its roof and
 *   glass off, under soft studio light (public/air/cabin.webp); and, for each set of vents, only the light its air throws on the
 *   cabin, cool on the left and warm on the right (public/air/light-face.webp, feet, screen, back).
 * - Drawn live (strands.ts): the air itself, a clear light breeze from where each vent is in that picture.
 * When a set of vents is switched on, its air appears and its light comes up on the seats and trim it reaches; the fan sets how
 * much of both, and each side's temperature sets the colour of both.
 * The controls are on the car: its three flat panels (one in front of each side seat, one behind the driver) take a slide up or
 * down, the side ones for that side's temperature and the middle one for the fan. Each notch ticks and is felt, as on the Groove pages. There are also films of simulated air (blender/make_air.py), made for an earlier cabin and switched off.
 */
const settings = {
  folder: 'air/',
  /** The sets of vents, in the order of their buttons, and which start on. */
  sets: [
    { key: 'face', words: 'Face', on: true },
    { key: 'feet', words: 'Feet', on: false },
    { key: 'screen', words: 'Windscreen', on: false },
    { key: 'back', words: 'Back seats', on: true },
  ],
  /** The fan: its levels, the one it starts at, how strongly air shows at the lowest and at full (0–1), and how fast the film plays at each. */
  levels: 7,
  fan: 4,
  /** The rendered films of simulated air read as smoke, which is the wrong feeling, so they are off (0). Raise `haze` toward 1 to bring them back under the live air. */
  haze: 0,
  shows: [0.15, 0.42],
  plays: [0.5, 1.4],
  /** How strongly the air's baked light shows on the cabin at the lowest fan and at full (0–1). */
  lights: [0.35, 0.95],
  temperatures: { driver: 18.5, passenger: 25 },
  /** The lowest and highest temperature (°C) and the size of one notch. */
  degrees: [16, 28, 0.5],
  /**
   * Where each control lies on the car's picture: left, top, width, height, as shares of the square (0–1). They are the model's own flat panels.
   * `travel` is how far a finger slides to go through the whole range, in panel heights.
   */
  panels: {
    driver: { at: [0.268, 0.245, 0.15, 0.175], travel: 2.2 },
    passenger: { at: [0.582, 0.245, 0.15, 0.175], travel: 2.2 },
    fan: { at: [0.43, 0.525, 0.14, 0.13], travel: 1.3 },
  },
  /** A touch that moves less than this (px) and lifts within this time (ms) is a tap: one notch up on the top half, one down on the bottom. */
  tap: [6, 350],
  /** How fast the fan's sign turns at full (turns a second). */
  spins: 1.6,
}

const car = document.querySelector<HTMLElement>('#car')!
const base = import.meta.env.BASE_URL + settings.folder
const cabin = new Image()
cabin.src = `${base}cabin.webp`
cabin.alt = ''
car.append(cabin)

type Side = 'driver' | 'passenger'
const sides: Side[] = ['driver', 'passenger']
const state = { fan: settings.fan, temperatures: { ...settings.temperatures }, on: Object.fromEntries(settings.sets.map((set) => [set.key, set.on])) as Record<string, boolean> }
// The light each set's air throws on the cabin: shown only where it is brighter than the picture under it. One copy for each
// side of the car, so each can take the colour of its own temperature.
const washes = settings.sets.flatMap((set) =>
  sides.map((side) => {
    const wash = document.createElement('div')
    wash.className = `wash ${side}`
    wash.innerHTML = `<img src="${base}light-${set.key}.webp" alt="" /><i></i>`
    car.append(wash)
    return { wash, set: set.key, side }
  }),
)
const films = (settings.haze > 0 ? settings.sets : []).map((set) => {
  const film = document.createElement('video')
  film.src = `${base}${set.key}.mp4`
  film.muted = true
  film.loop = true
  film.playsInline = true
  film.autoplay = true
  film.setAttribute('aria-hidden', 'true')
  car.append(film)
  return film
})
function show() {
  const fan = state.fan / settings.levels
  Object.assign(streaks, { fan: state.fan, on: state.on, temperatures: state.temperatures })
  for (const { wash, set, side } of washes) {
    const on = state.on[set] && state.fan > 0
    wash.style.opacity = String(on ? settings.lights[0] + (settings.lights[1] - settings.lights[0]) * fan : 0)
    wash.style.setProperty('--tint', colour(state.temperatures[side]))
  }
  films.forEach((film, index) => {
    const on = state.on[settings.sets[index].key] && state.fan > 0
    film.style.opacity = String(on ? (settings.shows[0] + (settings.shows[1] - settings.shows[0]) * fan) * settings.haze : 0)
    film.playbackRate = settings.plays[0] + (settings.plays[1] - settings.plays[0]) * fan
    if (on) void film.play().catch(() => {})
  })
}

const where = document.querySelector('#where')!
for (const set of settings.sets) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = set.words
  button.setAttribute('aria-pressed', String(state.on[set.key]))
  button.addEventListener('click', () => {
    state.on[set.key] = !state.on[set.key]
    button.setAttribute('aria-pressed', String(state.on[set.key]))
    show()
  })
  where.append(button)
}

// ---- The controls on the car ----
function colour(degrees: number) {
  return `#${tint(degrees).getHexString()}`
}
type Dial = { key: keyof typeof settings.panels; name: string; sign: string; side: string; lowest: number; highest: number; step: number; get(): number; set(value: number): void; words(value: number): string; spoken(value: number): string; tint(value: number): string }
const controls = document.querySelector<HTMLElement>('#controls')!
function dial(made: Dial) {
  const panel = settings.panels[made.key]
  const face = document.createElement('div')
  face.className = `dial ${made.side}`
  face.tabIndex = 0
  face.setAttribute('role', 'slider')
  face.setAttribute('aria-label', made.name)
  face.setAttribute('aria-orientation', 'vertical')
  face.setAttribute('aria-valuemin', String(made.lowest))
  face.setAttribute('aria-valuemax', String(made.highest))
  const [left, top, wide, tall] = panel.at
  Object.assign(face.style, { left: `${left * 100}%`, top: `${top * 100}%`, width: `${wide * 100}%`, height: `${tall * 100}%` })
  face.innerHTML = `<span class="more"></span>${icon(made.sign)}<b></b><span class="less"></span><span class="level"><i></i></span>`
  const words = face.querySelector('b')!
  const notches = Math.round((made.highest - made.lowest) / made.step)
  function paint() {
    const value = made.get()
    words.innerHTML = made.words(value)
    face.setAttribute('aria-valuenow', String(value))
    face.setAttribute('aria-valuetext', made.spoken(value))
    face.style.setProperty('--part', String((value - made.lowest) / (made.highest - made.lowest)))
    face.style.setProperty('--tint', made.tint(value))
    face.classList.toggle('off', value === made.lowest && made.key === 'fan')
  }
  /** Go to a notch (counted from the lowest); past either end is a stop. Says whether the value changed. */
  function go(notch: number) {
    const held = Math.max(0, Math.min(notches, notch))
    const value = made.lowest + held * made.step
    if (value === made.get()) {
      if (held !== notch) feel.stop()
      return false
    }
    made.set(value)
    feel.notch(520, 1400, held / notches, held === 0 || held === notches || value % 1 === 0)
    paint()
    show()
    return true
  }
  const now = () => Math.round((made.get() - made.lowest) / made.step)
  let hold: { id: number; y: number; from: number; when: number; moved: boolean; stopped: boolean } | undefined
  face.addEventListener('pointerdown', (event) => {
    if (hold) return
    wake()
    feel.land()
    face.setPointerCapture(event.pointerId)
    face.classList.add('held')
    hold = { id: event.pointerId, y: event.clientY, from: now(), when: performance.now(), moved: false, stopped: false }
  })
  face.addEventListener('pointermove', (event) => {
    if (!hold || event.pointerId !== hold.id) return
    const slid = hold.y - event.clientY
    if (Math.abs(slid) > settings.tap[0]) hold.moved = true
    if (!hold.moved) return
    const wanted = hold.from + Math.round((slid / (face.offsetHeight * panel.travel)) * notches)
    const past = wanted < 0 || wanted > notches
    // The end stop is felt once each time the finger runs into it, not on every move while it stays there.
    if (past && hold.stopped && Math.max(0, Math.min(notches, wanted)) === now()) return
    go(wanted)
    hold.stopped = past
  })
  const lift = (event: PointerEvent) => {
    if (!hold || event.pointerId !== hold.id) return
    if (event.type === 'pointerup' && !hold.moved && performance.now() - hold.when < settings.tap[1]) {
      const box = face.getBoundingClientRect()
      go(now() + (event.clientY < box.top + box.height / 2 ? 1 : -1))
    }
    if (voice.on && made.get() !== made.lowest + hold.from * made.step) say(made.spoken(made.get()))
    face.classList.remove('held')
    hold = undefined
  }
  face.addEventListener('pointerup', lift)
  face.addEventListener('pointercancel', lift)
  face.addEventListener('keydown', (event) => {
    const steps: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, Home: -notches, End: notches }
    if (!(event.key in steps)) return
    event.preventDefault()
    wake()
    go(now() + steps[event.key])
  })
  controls.append(face)
  paint()
  return face
}
voice.on = false // this page ticks and is felt, but does not speak unless asked to
const degrees = (value: number) => `${value % 1 ? value.toFixed(1) : value}<small>°</small>`
for (const side of sides)
  dial({
    key: side,
    name: `${side === 'driver' ? 'Left' : 'Right'} temperature`,
    sign: 'temperature',
    side: side === 'driver' ? 'left' : 'right',
    lowest: settings.degrees[0],
    highest: settings.degrees[1],
    step: settings.degrees[2],
    get: () => state.temperatures[side],
    set: (value) => (state.temperatures[side] = value),
    words: degrees,
    spoken: (value) => `${value} degrees`,
    tint: colour,
  })
const blower = dial({
  key: 'fan',
  name: 'Fan speed',
  sign: 'fan',
  side: 'right',
  lowest: 0,
  highest: settings.levels,
  step: 1,
  get: () => state.fan,
  set: (value) => {
    state.fan = value
    turning.playbackRate = value / settings.levels
  },
  words: (value) => (value ? String(value) : 'Off'),
  spoken: (value) => (value ? `Fan ${value}` : 'Fan off'),
  tint: () => '#ffffff',
})
// The fan's sign turns, faster with the fan.
const turning = blower.querySelector('.icon')!.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 1000 / settings.spins, iterations: Infinity })
turning.playbackRate = state.fan / settings.levels
show()
