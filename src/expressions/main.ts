import * as THREE from 'three'
import '../switch/switch.css'
import './expressions.css'
import type { Expression, Stage } from './kit'

/** The control panel of the expressions page. */
const settings = {
  /** The expression shown first (unless the address says ?expression=name). */
  start: 'iris',
  /** Camera: lens angle, its distance, and how far (degrees) the view leans toward the pointer. */
  lens: 30,
  distance: 17,
  look: [9, 6] as [number, number],
  ease: 4,
  /** Each stage: the backdrop's colour at its brightest spot and at the corners, where that spot is, and the text colour. */
  stages: {
    light: { centre: '#000000', corners: '#000000', spot: [0.5, 0.5], ink: 'light' },
    clay: { centre: '#9a9a9a', corners: '#2c2c2c', spot: [0.72, 0.68], ink: 'light' },
    ember: { centre: '#2a2a2a', corners: '#0e0e0e', spot: [0.5, 0.62], ink: 'light' },
  } satisfies Record<Stage, { centre: string; corners: string; spot: [number, number]; ink: 'light' | 'dark' }>,
  /** Milliseconds one expression takes to fade out before the next fades in (matches the CSS). */
  swap: 300,
  maxPixelRatio: 2,
}

// Every file in src/expressions/scenes is one expression.
const files = import.meta.glob<{ default: Expression }>('./scenes/*.ts', { eager: true })
const expressions = Object.entries(files)
  .map(([path, file]) => ({ name: path.replace(/^.*\/|\.ts$/g, ''), ...file.default }))
  .sort((a, b) => a.order - b.order)

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const note = document.querySelector<HTMLElement>('#note')!
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(settings.lens, 1, 0.5, 100)

// The backdrop: one colour glowing softly out of another.
const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    uniforms: { uCentre: { value: new THREE.Color() }, uCorners: { value: new THREE.Color() }, uSpot: { value: new THREE.Vector2(0.5, 0.5) } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform vec3 uCentre, uCorners;
      uniform vec2 uSpot;
      void main() {
        gl_FragColor = vec4(mix(uCentre, uCorners, smoothstep(0.0, 0.85, distance(vUv, uSpot))), 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  }),
)
backdrop.frustumCulled = false
backdrop.renderOrder = -1
scene.add(backdrop)

// The studio the clay shapes stand in: one large soft light from the upper right, and even light from all round.
const sun = new THREE.DirectionalLight(0xffffff, 2.6)
sun.position.set(5, 7, 6)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.radius = 7
sun.shadow.bias = -0.0005
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 })
scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.85))

// ---- Choosing an expression ---------------------------------------------------
const built = new Map<string, ReturnType<Expression['build']>>()
const tabs = new Map<string, HTMLButtonElement>()
let current: ReturnType<Expression['build']> | undefined
let wanted = expressions[0]
async function show(name: string) {
  const expression = expressions.find((entry) => entry.name === name) ?? expressions.find((entry) => entry.name === settings.start) ?? expressions[0]
  wanted = expression
  const stage = settings.stages[expression.stage]
  note.textContent = expression.note
  document.body.classList.toggle('ink-light', stage.ink === 'light')
  for (const [key, tab] of tabs) tab.setAttribute('aria-pressed', String(key === expression.name))
  tabs.get(expression.name)?.scrollIntoView({ block: 'nearest', inline: 'center' })
  // The address keeps the choice, so an expression can be shared as a link.
  const address = new URL(location.href)
  address.searchParams.set('expression', expression.name)
  history.replaceState(null, '', address)

  canvas.classList.remove('ready')
  if (current) await new Promise((done) => setTimeout(done, settings.swap))
  if (wanted !== expression) return // another one was chosen meanwhile
  if (current) scene.remove(current.object)
  let made = built.get(expression.name)
  if (!made) built.set(expression.name, (made = expression.build()))
  current = made
  scene.add(made.object)
  backdrop.material.uniforms.uCentre.value.set(stage.centre)
  backdrop.material.uniforms.uCorners.value.set(stage.corners)
  backdrop.material.uniforms.uSpot.value.fromArray(stage.spot)
  document.body.style.backgroundColor = stage.corners
  canvas.classList.add('ready')
}
const bar = document.createElement('div')
bar.className = 'styles'
bar.setAttribute('role', 'group')
bar.setAttribute('aria-label', 'Expression')
for (const expression of expressions) {
  const tab = document.createElement('button')
  tab.type = 'button'
  tab.textContent = expression.title
  tab.addEventListener('click', () => show(expression.name))
  tabs.set(expression.name, tab)
  bar.append(tab)
}
document.body.append(bar)
addEventListener('keydown', (event) => {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (step) show(expressions[(expressions.indexOf(wanted) + step + expressions.length) % expressions.length].name)
})
show(new URLSearchParams(location.search).get('expression') ?? settings.start)

// ---- Size, pointer, frames ----------------------------------------------------
let distance = settings.distance
function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, settings.maxPixelRatio))
  renderer.setSize(innerWidth, innerHeight, false)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  distance = settings.distance / Math.min(camera.aspect / 0.8, 1) // on a narrow window, step back so the scene still fits
}
addEventListener('resize', resize)
resize()

const lean = { x: 0, y: 0, toX: 0, toY: 0 }
addEventListener('pointermove', (event) => {
  lean.toX = (event.clientX / innerWidth) * 2 - 1
  lean.toY = (event.clientY / innerHeight) * 2 - 1
})
addEventListener('pointerleave', () => (lean.toX = lean.toY = 0))

const still = matchMedia('(prefers-reduced-motion: reduce)').matches // then each expression holds one pose
let before = performance.now()
function frame(now: number) {
  requestAnimationFrame(frame)
  const dt = Math.min((now - before) / 1000, 0.05)
  before = now
  lean.x += (lean.toX - lean.x) * Math.min(dt * settings.ease, 1)
  lean.y += (lean.toY - lean.y) * Math.min(dt * settings.ease, 1)
  const sideways = THREE.MathUtils.degToRad(lean.x * settings.look[0])
  const upward = THREE.MathUtils.degToRad(-lean.y * settings.look[1])
  camera.position.set(Math.sin(sideways) * Math.cos(upward), Math.sin(upward), Math.cos(sideways) * Math.cos(upward)).multiplyScalar(distance)
  camera.lookAt(0, 0, 0)
  current?.update(still ? 1.5 : now / 1000)
  renderer.render(scene, camera)
}
requestAnimationFrame(frame)
