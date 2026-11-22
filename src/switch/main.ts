import * as THREE from 'three'
import './switch.css'
import screenShader from '../glass/shaders/screen.vert?raw'
import switchShader from './switch.frag?raw'

/** The control panel of the switch study. Sizes are in design pixels. */
const settings = {
  /** Space kept for one switch (half width and height), and the gap between the two. */
  half: [160, 88] as [number, number],
  gap: 62,
  /** Which switches start on, and the style shown first (unless the address says ?style=name). */
  on: [true, false],
  start: 'knurled',
  /** Spring that moves a switch: higher stiffness = snappier, lower damping = more overshoot. */
  stiffness: 260,
  damping: 21,
  maxScale: 1.25,
  maxPixelRatio: 2,
}

// Every .glsl file in src/switch/styles is one style. Its first lines describe it:
//   // title: Knurled      // note: one sentence      // order: 1      // ink: light (for a dark sheet)
const sources = import.meta.glob<string>('./styles/*.glsl', { query: '?raw', import: 'default', eager: true })
const styles = Object.entries(sources)
  .map(([path, source]) => {
    const tag = (key: string) => source.match(new RegExp(`^// ${key}:\\s*(.+)$`, 'm'))?.[1].trim()
    const name = path.replace(/^.*\/|\.glsl$/g, '')
    return { name, source, title: tag('title') ?? name, note: tag('note') ?? '', order: Number(tag('order') ?? 99), lightInk: tag('ink') === 'light' }
  })
  .sort((a, b) => a.order - b.order)

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const note = document.querySelector<HTMLElement>('#note')!
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
const uniforms = {
  uSize: { value: new THREE.Vector2(1, 1) },
  uPixelRatio: { value: 1 },
  uScale: { value: 1 },
  uCentre: { value: [new THREE.Vector2(), new THREE.Vector2()] },
  uOn: { value: settings.on.map(Number) },
}
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
quad.frustumCulled = false
const camera = new THREE.Camera()

// One real button per drawn switch.
const controls = settings.on.map((on, index) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'control'
  button.setAttribute('role', 'switch')
  button.setAttribute('aria-label', `Switch ${index + 1}`)
  button.setAttribute('aria-checked', String(on))
  const control = { button, on, at: Number(on), speed: 0 }
  button.addEventListener('click', () => {
    control.on = !control.on
    button.setAttribute('aria-checked', String(control.on))
  })
  document.body.append(button)
  return control
})

// ---- Styles -----------------------------------------------------------------
const materials = new Map<string, THREE.ShaderMaterial>()
const tabs = new Map<string, HTMLButtonElement>()
let current = styles[0]
function show(name: string) {
  current = styles.find((style) => style.name === name) ?? styles.find((style) => style.name === settings.start) ?? styles[0]
  let material = materials.get(current.name)
  if (!material) {
    const fragmentShader = switchShader.replace('#include "style"', current.source)
    material = new THREE.ShaderMaterial({ uniforms, vertexShader: screenShader, fragmentShader, depthTest: false, depthWrite: false })
    materials.set(current.name, material)
  }
  quad.material = material
  note.textContent = current.note
  document.body.classList.toggle('ink-light', current.lightInk)
  for (const [key, tab] of tabs) tab.setAttribute('aria-pressed', String(key === current.name))
  tabs.get(current.name)?.scrollIntoView({ block: 'nearest', inline: 'center' })
  // The address keeps the choice, so a style can be shared as a link.
  const address = new URL(location.href)
  address.searchParams.set('style', current.name)
  history.replaceState(null, '', address)
}
const bar = document.createElement('div')
bar.className = 'styles'
bar.setAttribute('role', 'group')
bar.setAttribute('aria-label', 'Switch style')
for (const style of styles) {
  const tab = document.createElement('button')
  tab.type = 'button'
  tab.textContent = style.title
  tab.addEventListener('click', () => show(style.name))
  tabs.set(style.name, tab)
  bar.append(tab)
}
document.body.append(bar)
addEventListener('keydown', (event) => {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (step) show(styles[(styles.indexOf(current) + step + styles.length) % styles.length].name)
})
show(new URLSearchParams(location.search).get('style') ?? settings.start)

// ---- Size -------------------------------------------------------------------
function resize() {
  const width = innerWidth
  const height = innerHeight
  const [halfX, halfY] = settings.half
  const scale = Math.min(width / (halfX * 2 + 90), height / (halfY * 4 + settings.gap + 330), settings.maxScale)
  renderer.setPixelRatio(Math.min(devicePixelRatio, settings.maxPixelRatio))
  renderer.setSize(width, height, false)
  uniforms.uSize.value.set(width, height)
  uniforms.uPixelRatio.value = renderer.getPixelRatio()
  uniforms.uScale.value = scale
  const middle = height / 2 + 24 // a little above the middle: the note and the style switcher sit below
  controls.forEach(({ button }, index) => {
    const offset = (index === 0 ? 1 : -1) * (halfY + settings.gap / 2) * scale // first switch above, second below
    uniforms.uCentre.value[index].set(width / 2, middle + offset)
    button.style.left = `${width / 2 - halfX * scale}px`
    button.style.top = `${height - middle - offset - halfY * scale}px`
    button.style.width = `${halfX * 2 * scale}px`
    button.style.height = `${halfY * 2 * scale}px`
  })
}
addEventListener('resize', resize)
resize()

// ---- Every frame ------------------------------------------------------------
let before = performance.now()
function frame(now: number) {
  requestAnimationFrame(frame)
  const dt = Math.min((now - before) / 1000, 0.05)
  before = now
  controls.forEach((control, index) => {
    control.speed += ((Number(control.on) - control.at) * settings.stiffness - control.speed * settings.damping) * dt
    control.at += control.speed * dt
    uniforms.uOn.value[index] = control.at
  })
  renderer.render(quad, camera)
}
requestAnimationFrame(frame)
