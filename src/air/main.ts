import './air.css'
import { state as streaks } from './strands'

/**
 * Air in the cabin. Two things are laid together here:
 * - Baked in Blender (blender/make_cabin.py), from straight above and framed alike: an open, detailed car model with its roof and
 *   glass off, under soft studio light (public/air/cabin.webp); and, for each set of vents, only the light its air throws on the
 *   cabin, cool on the left and warm on the right (public/air/light-face.webp, feet, screen, back).
 * - Drawn live (strands.ts): the air itself, a clear light breeze from where each vent is in that picture.
 * When a set of vents is switched on, its air appears and its light comes up on the seats and trim it reaches; the fan sets how
 * much of both. There are also films of simulated air (blender/make_air.py), made for an earlier cabin and switched off.
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
  temperatures: { driver: 19.5, passenger: 24 },
}

const car = document.querySelector<HTMLElement>('#car')!
const base = import.meta.env.BASE_URL + settings.folder
const cabin = new Image()
cabin.src = `${base}cabin.webp`
cabin.alt = ''
car.append(cabin)

const state = { fan: settings.fan, on: Object.fromEntries(settings.sets.map((set) => [set.key, set.on])) as Record<string, boolean> }
// The light each set's air throws on the cabin: shown only where it is brighter than the picture under it.
const washes = settings.sets.map((set) => {
  const wash = new Image()
  wash.src = `${base}light-${set.key}.webp`
  wash.alt = ''
  wash.className = 'wash'
  car.append(wash)
  return wash
})
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
  Object.assign(streaks, { fan: state.fan, on: state.on })
  washes.forEach((wash, index) => {
    const on = state.on[settings.sets[index].key] && state.fan > 0
    wash.style.opacity = String(on ? settings.lights[0] + (settings.lights[1] - settings.lights[0]) * fan : 0)
  })
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
const levels = document.querySelector('#levels')!
for (let each = 0; each <= settings.levels; each++) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = String(each)
  button.setAttribute('aria-pressed', String(each === state.fan))
  button.addEventListener('click', () => {
    state.fan = each
    levels.querySelectorAll('button').forEach((other, at) => other.setAttribute('aria-pressed', String(at === each)))
    show()
  })
  levels.append(button)
}
document.querySelector('#driver b')!.textContent = `${settings.temperatures.driver}°`
document.querySelector('#passenger b')!.textContent = `${settings.temperatures.passenger}°`
show()
