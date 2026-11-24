import './air.css'
import { state as streaks } from './strands'

/**
 * Air in the cabin, as rendered 3D. Blender (blender/make_air.py) modelled the car's interior simply and let air out of each vent
 * as simulated smoke, so it behaves like air: a jet at the vent that slows, spreads, rolls where it meets the seats and still air,
 * and thins out. It rendered two things from straight above, framed alike:
 * - the cabin by itself, softly lit (public/air/cabin.webp);
 * - for each set of vents, a looping film of its air alone on black (public/air/face.mp4, feet, screen, back).
 * This page lays the films over the cabin, each showing only where it is brighter than what is under it, and fades a set in or out
 * as it is switched. By themselves the films read as smoke, so they are softened and kept faint, and over them the page draws a few
 * faint live streaks from each vent (strands.ts), which give the air its direction: soft body from the films, movement from the streaks. The fan sets how much air shows and how fast it moves. The driver's side blows cool, the passenger's warm.
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
  temperatures: { driver: 19.5, passenger: 24 },
}

const car = document.querySelector<HTMLElement>('#car')!
const base = import.meta.env.BASE_URL + settings.folder
const cabin = new Image()
cabin.src = `${base}cabin.webp`
cabin.alt = ''
car.append(cabin)

const state = { fan: settings.fan, on: Object.fromEntries(settings.sets.map((set) => [set.key, set.on])) as Record<string, boolean> }
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
