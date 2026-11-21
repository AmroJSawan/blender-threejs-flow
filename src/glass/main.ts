import * as THREE from 'three'
import '../style.css'
import './glass.css'
import { createBody } from './body'
import { createLiquid } from './liquid'
import backgroundShader from './shaders/background.frag?raw'
import cardShader from './shaders/card.frag?raw'
import screenShader from './shaders/screen.vert?raw'

/** The control panel of the glass page. */
const settings = {
  /** Card shape: width / height, the share of the window it may fill, its largest height and corner radius (px). */
  aspect: 0.72,
  fill: [0.8, 0.56] as [number, number],
  maxHeight: 540,
  radius: 30,
  /** Words behind the glass. */
  words: 'REFRACTION · BLUR · DISTORTION · FLUID · GLASS · ',
  /** Variant shown first (a file name in shaders/variants), unless the address says ?glass=name. */
  start: 'clear',
  maxPixelRatio: 2,
}

// Every .glsl file in shaders/variants is one kind of glass. Its first lines describe it:
//   // title: Frost      // note: one sentence      // order: 2      // springs: 1.5
const sources = import.meta.glob<string>('./shaders/variants/*.glsl', { query: '?raw', import: 'default', eager: true })
const variants = Object.entries(sources)
  .map(([path, source]) => {
    const name = path.replace(/^.*\/|\.glsl$/g, '')
    const tag = (key: string) => source.match(new RegExp(`^// ${key}:\\s*(.+)$`, 'm'))?.[1].trim()
    return { name, source, title: tag('title') ?? name, note: tag('note') ?? '', order: Number(tag('order') ?? 99), springs: Number(tag('springs') ?? 1) }
  })
  .sort((a, b) => a.order - b.order)

const canvas = document.querySelector<HTMLCanvasElement>('#glass')!
const note = document.querySelector<HTMLElement>('#note')!
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
quad.frustumCulled = false
const camera = new THREE.Camera()
/** Draws one full-screen pass into `target` (null = the screen). */
const draw = (material: THREE.Material, target: THREE.WebGLRenderTarget | null) => {
  quad.material = material
  renderer.setRenderTarget(target)
  renderer.render(quad, camera)
}

const font = (size: number, weight = 800) => `${weight} ${size}px system-ui, -apple-system, 'Segoe UI', sans-serif`

/** One line of words as a texture that tiles sideways. */
function typeTexture(words: string) {
  const sheet = document.createElement('canvas')
  const pen = sheet.getContext('2d')!
  pen.font = font(200)
  sheet.width = Math.min(Math.ceil(pen.measureText(words).width), 4096)
  sheet.height = 256
  pen.font = font(200)
  pen.fillStyle = '#fff'
  pen.textBaseline = 'middle'
  pen.fillText(words, 0, 136, sheet.width)
  const texture = new THREE.CanvasTexture(sheet)
  texture.wrapS = THREE.RepeatWrapping
  return texture
}

/** The print on the card: a small heading, a number and the variant's name. */
const face = document.createElement('canvas')
face.width = 720
face.height = Math.round(720 / settings.aspect)
const faceTexture = new THREE.CanvasTexture(face)
function printFace(title: string, index: number) {
  const pen = face.getContext('2d')!
  pen.clearRect(0, 0, face.width, face.height)
  pen.fillStyle = 'rgba(255, 255, 255, 0.95)'
  pen.shadowColor = 'rgba(8, 10, 18, 0.55)' // keeps the print readable over bright type behind the glass
  pen.shadowBlur = 22
  pen.textBaseline = 'alphabetic'
  pen.font = font(30, 600)
  pen.letterSpacing = '6px'
  pen.fillText('GLASS', 64, 104)
  pen.textAlign = 'right'
  pen.fillText(`${String(index + 1).padStart(2, '0')} / ${String(variants.length).padStart(2, '0')}`, face.width - 64, 104)
  pen.textAlign = 'left'
  pen.letterSpacing = '0px'
  let size = 96
  do pen.font = font(size, 700)
  while (pen.measureText(title).width > face.width - 128 && (size -= 6) > 30)
  pen.fillText(title, 64, face.height - 76)
  faceTexture.needsUpdate = true
}

// The background is drawn into its own picture, with smaller blurred versions for the glass to read.
const scene = new THREE.WebGLRenderTarget(1, 1, {
  generateMipmaps: true,
  minFilter: THREE.LinearMipmapLinearFilter,
  magFilter: THREE.LinearFilter,
  depthBuffer: false,
})
const type = typeTexture(settings.words)
const background = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uType: { value: type },
    uTypeAspect: { value: type.image.width / type.image.height },
  },
  vertexShader: screenShader,
  fragmentShader: backgroundShader,
  depthTest: false,
  depthWrite: false,
})

const body = createBody()
const liquid = createLiquid(draw, settings.aspect)
const uniforms = {
  uScene: { value: scene.texture },
  uLiquid: { value: liquid.texture },
  uLiquidTexel: { value: liquid.texel },
  uFace: { value: faceTexture },
  uBuffer: { value: new THREE.Vector2(1, 1) },
  uPixelRatio: { value: 1 },
  uTime: background.uniforms.uTime,
  uCenter: { value: new THREE.Vector2() },
  uSize: { value: new THREE.Vector2(1, 1) },
  uRadius: { value: settings.radius },
  uToCard: { value: new THREE.Vector4(1, 0, 0, 1) },
  uToScreen: { value: new THREE.Vector4(1, 0, 0, 1) },
  uTilt: { value: new THREE.Vector2() },
}

// ---- Variants ---------------------------------------------------------------
const materials = new Map<string, THREE.ShaderMaterial>()
let card: THREE.ShaderMaterial
let current = variants[0]
const buttons = new Map<string, HTMLButtonElement>()

function show(name: string) {
  current = variants.find((variant) => variant.name === name) ?? variants.find((variant) => variant.name === settings.start) ?? variants[0]
  let material = materials.get(current.name)
  if (!material) {
    const fragmentShader = cardShader.replace('#include "variant"', current.source)
    material = new THREE.ShaderMaterial({ uniforms, vertexShader: screenShader, fragmentShader, depthTest: false, depthWrite: false })
    materials.set(current.name, material)
  }
  card = material
  body.loose = current.springs
  printFace(current.title, variants.indexOf(current))
  note.textContent = current.note
  for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === current.name))
  buttons.get(current.name)?.scrollIntoView({ block: 'nearest', inline: 'center' })
  // The address keeps the choice, so a look can be shared as a link.
  const address = new URL(location.href)
  address.searchParams.set('glass', current.name)
  history.replaceState(null, '', address)
}

const bar = document.createElement('div')
bar.className = 'effects'
bar.setAttribute('role', 'group')
bar.setAttribute('aria-label', 'Kind of glass')
for (const variant of variants) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = variant.title
  button.addEventListener('click', () => show(variant.name))
  buttons.set(variant.name, button)
  bar.append(button)
}
document.body.append(bar)
addEventListener('keydown', (event) => {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (step) show(variants[(variants.indexOf(current) + step + variants.length) % variants.length].name)
})
show(new URLSearchParams(location.search).get('glass') ?? settings.start)

// ---- Size -------------------------------------------------------------------
const rest = { x: 0, y: 0 }
const half: [number, number] = [1, 1]
function resize() {
  const width = innerWidth
  const height = innerHeight
  renderer.setPixelRatio(Math.min(devicePixelRatio, settings.maxPixelRatio))
  renderer.setSize(width, height, false)
  renderer.getDrawingBufferSize(uniforms.uBuffer.value)
  scene.setSize(uniforms.uBuffer.value.x, uniforms.uBuffer.value.y)
  uniforms.uPixelRatio.value = renderer.getPixelRatio()
  background.uniforms.uResolution.value.set(width, height)
  const cardHeight = Math.min(height * settings.fill[1], settings.maxHeight, (width * settings.fill[0]) / settings.aspect)
  uniforms.uSize.value.set(cardHeight * settings.aspect, cardHeight)
  half[0] = (cardHeight * settings.aspect) / 2
  half[1] = cardHeight / 2
  rest.x = width / 2
  rest.y = height / 2 + 14 // a little above the middle: the note and the switcher sit below
}
addEventListener('resize', resize)
resize()

// ---- Pointer ----------------------------------------------------------------
/** Pointer offset from the card's resting place (y up), or null when it is away. */
let pointer: [number, number] | null = null
let moved = 0 // px travelled over the card since the last frame
const place = (event: PointerEvent): [number, number] => [event.clientX - rest.x, innerHeight - event.clientY - rest.y]
/** The pointer in the card's own frame. */
const onCard = () => (pointer ? body.local(pointer[0] - body.x, pointer[1] - body.y) : null)
const isOver = () => {
  const spot = onCard()
  return !!spot && Math.abs(spot[0]) < half[0] && Math.abs(spot[1]) < half[1]
}
canvas.addEventListener('pointermove', (event) => {
  const before = onCard()
  pointer = place(event)
  const after = onCard()
  if (before && after) moved += Math.hypot(after[0] - before[0], after[1] - before[1])
  canvas.classList.toggle('over', isOver())
})
canvas.addEventListener('pointerdown', (event) => {
  pointer = place(event)
  if (!isOver()) return
  canvas.setPointerCapture(event.pointerId)
  body.grab(pointer[0], pointer[1])
  canvas.classList.add('held')
})
const letGo = (event: PointerEvent) => {
  body.release()
  canvas.classList.remove('held')
  if (event.pointerType !== 'mouse') pointer = null // a lifted finger is gone; a mouse is still there
}
canvas.addEventListener('pointerup', letGo)
canvas.addEventListener('pointercancel', letGo)
canvas.addEventListener('pointerleave', () => {
  if (!body.held) pointer = null
})

// ---- Every frame ------------------------------------------------------------
let before = performance.now()
function frame(now: number) {
  requestAnimationFrame(frame)
  const dt = Math.min((now - before) / 1000, 0.05)
  before = now
  const time = now / 1000
  const over = isOver()

  body.update(dt, time, pointer, over, half)
  const spot = onCard()
  const touch: [number, number] | null = spot && over ? [spot[0] / (half[0] * 2) + 0.5, spot[1] / (half[1] * 2) + 0.5] : null
  liquid.update(dt, touch, dt > 0 ? moved / dt : 0, body.push)
  moved = 0

  uniforms.uTime.value = time
  uniforms.uLiquid.value = liquid.texture
  uniforms.uCenter.value.set(rest.x + body.x, rest.y + body.y)
  uniforms.uToCard.value.set(...body.toCard)
  uniforms.uToScreen.value.set(...body.toScreen)
  uniforms.uTilt.value.set(...body.tilt)

  draw(background, scene)
  draw(card, null)
}
requestAnimationFrame(frame)
