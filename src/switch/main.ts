import * as THREE from 'three'
import './switch.css'
import screenShader from '../glass/shaders/screen.vert?raw'
import switchShader from './switch.frag?raw'

/** The control panel of the switch study. Sizes are in design pixels; the shader has the matching numbers. */
const settings = {
  /** Half length and half height of one switch including its bezel, and the gap between the two. */
  half: [159, 87] as [number, number],
  gap: 62,
  /** Which switches start on. */
  on: [true, false],
  /** Knob spring: higher stiffness = snappier, lower damping = more overshoot. */
  stiffness: 260,
  damping: 21,
  maxScale: 1.25,
  maxPixelRatio: 2,
}

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
const uniforms = {
  uSize: { value: new THREE.Vector2(1, 1) },
  uPixelRatio: { value: 1 },
  uScale: { value: 1 },
  uCentre: { value: [new THREE.Vector2(), new THREE.Vector2()] },
  uOn: { value: settings.on.map(Number) },
}
const quad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({ uniforms, vertexShader: screenShader, fragmentShader: switchShader, depthTest: false, depthWrite: false }),
)
quad.frustumCulled = false
const camera = new THREE.Camera()

// One real button per drawn switch.
const knobs = settings.on.map((on, index) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('role', 'switch')
  button.setAttribute('aria-label', `Switch ${index + 1}`)
  button.setAttribute('aria-checked', String(on))
  const knob = { button, on, at: Number(on), speed: 0 }
  button.addEventListener('click', () => {
    knob.on = !knob.on
    button.setAttribute('aria-checked', String(knob.on))
  })
  document.body.append(button)
  return knob
})

function resize() {
  const width = innerWidth
  const height = innerHeight
  const [halfX, halfY] = settings.half
  const scale = Math.min(width / (halfX * 2 + 90), height / (halfY * 4 + settings.gap + 230), settings.maxScale)
  renderer.setPixelRatio(Math.min(devicePixelRatio, settings.maxPixelRatio))
  renderer.setSize(width, height, false)
  uniforms.uSize.value.set(width, height)
  uniforms.uPixelRatio.value = renderer.getPixelRatio()
  uniforms.uScale.value = scale
  knobs.forEach(({ button }, index) => {
    const offset = (index === 0 ? 1 : -1) * (halfY + settings.gap / 2) * scale // first switch above, second below
    uniforms.uCentre.value[index].set(width / 2, height / 2 + offset)
    button.style.left = `${width / 2 - halfX * scale}px`
    button.style.top = `${height / 2 - offset - halfY * scale}px`
    button.style.width = `${halfX * 2 * scale}px`
    button.style.height = `${halfY * 2 * scale}px`
  })
}
addEventListener('resize', resize)
resize()

let before = performance.now()
function frame(now: number) {
  requestAnimationFrame(frame)
  const dt = Math.min((now - before) / 1000, 0.05)
  before = now
  knobs.forEach((knob, index) => {
    knob.speed += ((Number(knob.on) - knob.at) * settings.stiffness - knob.speed * settings.damping) * dt
    knob.at += knob.speed * dt
    uniforms.uOn.value[index] = knob.at
  })
  renderer.render(quad, camera)
}
requestAnimationFrame(frame)
