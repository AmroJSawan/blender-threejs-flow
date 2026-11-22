/**
 * The lab canvas. The studies lie on one large board (.world) that is moved and scaled inside the
 * window (.stage): drag or scroll to pan, pinch or Ctrl-scroll to zoom. Choosing a study flies to
 * its frame and runs it there, live; choosing it again (or the toolbar's button) opens it.
 * Without this script the page is an ordinary list of links.
 */
const settings = {
  /** How far out and in the canvas can be zoomed. */
  zoom: [0.12, 2.5] as [number, number],
  /** One press of + or −, or one notch of the toolbar's buttons. */
  step: 1.25,
  /** Milliseconds a flight to a study takes. */
  flight: 520,
  /** Room kept clear round what is being shown, px: more at the top and bottom, where the floating pieces are. */
  margin: { side: 48, top: 84, bottom: 104 },
  /** How much of the window a chosen study's frame may fill (1 = edge to edge within the margins), and the most it is enlarged. */
  closeUp: 0.82,
  closest: 1.6,
  /** Pixels the pointer may wander during a click before it counts as a drag. */
  slack: 5,
  /** The size a study is laid out at inside its frame (matches lab.css). */
  page: 1280,
}

const stage = document.querySelector<HTMLElement>('#stage')!
const world = document.querySelector<HTMLElement>('#world')!
const frames = [...document.querySelectorAll<HTMLAnchorElement>('[data-study]')]
const inOrder = [...frames].sort((a, b) => number(a).localeCompare(number(b)))
const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-go]')]
const nav = document.querySelector<HTMLDetailsElement>('#nav')!
const level = document.querySelector<HTMLElement>('#level')!
const openLink = document.querySelector<HTMLAnchorElement>('#open')!
const chosenName = document.querySelector<HTMLElement>('#chosen')!
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
const canRunLive = matchMedia('(hover: hover) and (min-width: 700px)').matches // phones show the picture only
function number(frame: Element) { return frame.querySelector('.no')!.textContent ?? '' }

document.body.classList.add('canvas')
if (innerWidth < 700) nav.open = false

// ---- The view: where the board sits in the window, and its scale -------------------------------
type View = { x: number; y: number; k: number }
const view: View = { x: 0, y: 0, k: 1 }
function apply() {
  world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`
  // The dot grid thins out rather than turning to noise when zoomed far out.
  const grid = 24 * view.k * (view.k < 0.35 ? 4 : view.k < 0.7 ? 2 : 1)
  stage.style.setProperty('--grid', `${grid}px`)
  stage.style.setProperty('--gx', `${view.x}px`)
  stage.style.setProperty('--gy', `${view.y}px`)
  level.textContent = `${Math.round(view.k * 100)}%`
}
const clamp = (k: number) => Math.min(Math.max(k, settings.zoom[0]), settings.zoom[1])
/** Zooms by `factor`, keeping the point of the board under (cx, cy) where it is. */
function zoomAt(cx: number, cy: number, factor: number) {
  const k = clamp(view.k * factor)
  view.x = cx - ((cx - view.x) * k) / view.k
  view.y = cy - ((cy - view.y) * k) / view.k
  view.k = k
  apply()
}

let flying = 0
function flyTo(to: View, instant = calm) {
  cancelAnimationFrame(flying)
  if (instant) return void (Object.assign(view, to), apply())
  const from = { ...view }
  const began = performance.now()
  const tick = (now: number) => {
    const t = Math.min((now - began) / settings.flight, 1)
    const eased = 1 - Math.pow(1 - t, 4)
    // Scale is eased on a log scale, so zooming in feels as even as zooming out.
    view.k = from.k * Math.pow(to.k / from.k, eased)
    view.x = from.x + (to.x - from.x) * eased
    view.y = from.y + (to.y - from.y) * eased
    apply()
    if (t < 1) flying = requestAnimationFrame(tick)
  }
  flying = requestAnimationFrame(tick)
}

type Box = { x: number; y: number; w: number; h: number }
/** Where an element lies on the board, in the board's own pixels. */
function boxOf(element: HTMLElement): Box {
  const style = getComputedStyle(element)
  return { x: Number(style.getPropertyValue('--x')), y: Number(style.getPropertyValue('--y')), w: element.offsetWidth, h: element.offsetHeight }
}
/** The view that shows `box` centred, filling `fill` of the room between the floating pieces. */
function viewOf(box: Box, fill: number, most: number): View {
  const { side, top, bottom } = settings.margin
  const roomW = Math.max(innerWidth - side * 2, 120)
  const roomH = Math.max(innerHeight - top - bottom, 120)
  const k = clamp(Math.min((roomW * fill) / box.w, (roomH * fill) / box.h, most))
  return { k, x: side + (roomW - box.w * k) / 2 - box.x * k, y: top + (roomH - box.h * k) / 2 - box.y * k }
}
function everything(): Box {
  const boxes = [...world.querySelectorAll<HTMLElement>('.brief, .frame')].map(boxOf)
  const x = Math.min(...boxes.map((box) => box.x))
  const y = Math.min(...boxes.map((box) => box.y))
  return { x, y, w: Math.max(...boxes.map((box) => box.x + box.w)) - x, h: Math.max(...boxes.map((box) => box.y + box.h)) - y }
}
const fit = (instant?: boolean) => flyTo(viewOf(everything(), 1, 1), instant)

// ---- Choosing a study ---------------------------------------------------------------------------
let chosen: HTMLAnchorElement | undefined
function choose(frame: HTMLAnchorElement, fly = true) {
  if (chosen !== frame) {
    chosen = frame
    for (const other of frames) other.classList.toggle('chosen', other === frame)
    for (const link of links) link.classList.toggle('chosen', link.dataset.go === frame.id)
    chosenName.textContent = frame.querySelector('.name')!.textContent
    openLink.href = frame.href
    // One study runs at a time, in its own frame: the last one is removed, so its drawing stops.
    document.querySelector('.shot iframe')?.remove()
    if (canRunLive) {
      const page = document.createElement('iframe')
      page.title = `${chosenName.textContent}, live`
      page.tabIndex = -1
      page.setAttribute('aria-hidden', 'true')
      page.addEventListener('load', () => page.classList.add('ready'))
      page.src = frame.href
      frame.querySelector('.shot')!.append(page)
    }
  }
  if (!fly) return
  history.replaceState(null, '', `#${frame.id}`) // the address keeps the choice, so a study's place on the canvas can be shared
  flyTo(viewOf(boxOf(frame), settings.closeUp, settings.closest))
}
function step(by: number) {
  const index = chosen ? inOrder.indexOf(chosen) : by > 0 ? -1 : 0
  choose(inOrder[(index + by + inOrder.length) % inOrder.length])
}

// ---- Steering: drag, scroll, pinch, keys --------------------------------------------------------
const fingers = new Map<number, { x: number; y: number }>()
let dragged = 0 // how far the pointer has travelled since it went down, px
stage.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  cancelAnimationFrame(flying)
  fingers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (fingers.size === 1) dragged = 0
})
addEventListener('pointermove', (event) => {
  const finger = fingers.get(event.pointerId)
  if (!finger) return
  const dx = event.clientX - finger.x
  const dy = event.clientY - finger.y
  if (fingers.size === 2) {
    // Two fingers: the gap between them sets the zoom, their midpoint drags the board.
    const [a, b] = [...fingers.values()]
    const gapBefore = Math.hypot(a.x - b.x, a.y - b.y)
    finger.x = event.clientX
    finger.y = event.clientY
    const gap = Math.hypot(a.x - b.x, a.y - b.y)
    view.x += dx / 2
    view.y += dy / 2
    zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, gap / Math.max(gapBefore, 1))
    dragged = Infinity
    return
  }
  finger.x = event.clientX
  finger.y = event.clientY
  dragged += Math.abs(dx) + Math.abs(dy)
  if (dragged < settings.slack) return
  stage.classList.add('moving')
  view.x += dx
  view.y += dy
  apply()
})
function release(event: PointerEvent) {
  fingers.delete(event.pointerId)
  if (!fingers.size) stage.classList.remove('moving')
}
addEventListener('pointerup', release)
addEventListener('pointercancel', release)

stage.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()
    cancelAnimationFrame(flying)
    if (event.ctrlKey || event.metaKey) return zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.01)) // also a trackpad pinch
    view.x -= event.deltaX
    view.y -= event.deltaY
    apply()
  },
  { passive: false },
)

// A click on a study chooses it; a click on the chosen one opens it. The end of a drag does neither.
for (const frame of frames) {
  frame.addEventListener('click', (event) => {
    if (dragged >= settings.slack || frame !== chosen) event.preventDefault()
    if (dragged < settings.slack && frame !== chosen) choose(frame)
  })
  frame.addEventListener('focus', () => frame.matches(':focus-visible') && choose(frame)) // tabbing through them flies from one to the next
}
for (const link of links) {
  link.addEventListener('click', (event) => {
    event.preventDefault()
    choose(frames.find((frame) => frame.id === link.dataset.go)!)
    if (innerWidth < 700) nav.open = false
  })
}

const centre = () => [innerWidth / 2, innerHeight / 2] as const
document.querySelector('#in')!.addEventListener('click', () => zoomAt(...centre(), settings.step))
document.querySelector('#out')!.addEventListener('click', () => zoomAt(...centre(), 1 / settings.step))
document.querySelector('#level')!.addEventListener('click', () => zoomAt(...centre(), 1 / view.k))
document.querySelector('#fit')!.addEventListener('click', () => fit())
document.querySelector('#prev')!.addEventListener('click', () => step(-1))
document.querySelector('#next')!.addEventListener('click', () => step(1))
addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const pan: Record<string, [number, number]> = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] }
  if (event.key === '+' || event.key === '=') zoomAt(...centre(), settings.step)
  else if (event.key === '-' || event.key === '_') zoomAt(...centre(), 1 / settings.step)
  else if (event.key === '0') fit()
  else if (event.key === '1') zoomAt(...centre(), 1 / view.k)
  else if (event.key === ']') step(1)
  else if (event.key === '[') step(-1)
  else if (pan[event.key]) {
    view.x += pan[event.key][0]
    view.y += pan[event.key][1]
    apply()
  } else return
  event.preventDefault()
})

// ---- Start: the whole board, with one study chosen (the one named in the address, if any) ----
const named = frames.find((frame) => `#${frame.id}` === location.hash)
fit(true)
choose(named ?? frames.find((frame) => frame.id === 'glow') ?? frames[0], Boolean(named))
addEventListener('resize', () => (chosen && view.k > 0.6 ? choose(chosen) : fit(true)))
export {}
