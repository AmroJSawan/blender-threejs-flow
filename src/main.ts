import gsap from 'gsap'
import * as THREE from 'three'
import { config } from './config'
import { createStage } from './stage'
import { createScroll } from './scroll'
import { createHover } from './hover'
import { createShaders } from './shaders'
import { createCards } from './cards'
import { createPipeline } from './render'

async function start() {
  const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
  const stage = await createStage(canvas)
  // Handy in the browser console: __stage.scene, __stage.camera …
  ;(window as unknown as { __stage: unknown }).__stage = stage

  // Small screens get the card view; switching size reloads into the other view.
  const small = window.matchMedia(`(max-width: ${config.cards.maxWidth}px)`)
  small.addEventListener('change', () => location.reload())
  if (config.cards.enabled && small.matches) {
    const loops = createScroll(stage, false)
    const shaders = createShaders(stage)
    const cards = createCards(stage, shaders, createPipeline(stage, shaders))
    const still = new THREE.Vector2()
    const smooth = THREE.MathUtils.smoothstep
    let time = 0
    gsap.ticker.add((_time, deltaMs) => {
      time += deltaMs / 1000
      // No scroll here: reveals and scroll animations go there and back, resting at both ends.
      const phase = (time / config.cards.replay) % 1
      const replay = smooth(phase, 0.08, 0.42) - smooth(phase, 0.58, 0.92)
      loops.update(deltaMs / 1000, replay)
      shaders.update(time, 0, still, replay)
      cards.render()
    })
    return
  }

  const scroll = createScroll(stage)
  const hover = createHover(stage)
  const shaders = createShaders(stage)
  const pipeline = createPipeline(stage, shaders)

  const drift = new THREE.Vector2()
  const lastPosition = new THREE.Vector3()
  let elapsed = 0

  gsap.ticker.add((_time, deltaMs) => {
    const delta = deltaMs / 1000
    elapsed += delta

    scroll.update(delta)
    stage.syncCamera()

    // Mouse parallax, layered on top of the Blender camera move.
    const { parallax, tilt, ease } = config.mouse
    drift.lerp(hover.mouse, ease)
    stage.camera.translateX(drift.x * parallax)
    stage.camera.translateY(drift.y * parallax)
    stage.camera.rotateY(-drift.x * tilt)
    stage.camera.rotateX(drift.y * tilt)
    stage.camera.updateMatrixWorld()

    const moved = lastPosition.distanceToSquared(stage.camera.position) > 1e-10
    lastPosition.copy(stage.camera.position)
    hover.update(moved)

    shaders.setPointer(hover.pointer.x, hover.pointer.y)
    shaders.update(elapsed, scroll.progress, drift)
    pipeline.render(stage.camera)
  })

}

start().catch((error) => {
  console.error(error)
  const message = document.querySelector<HTMLElement>('#message')!
  message.hidden = false
  message.textContent = `Could not load ${config.model}. Export from Blender (N panel → three.js → Export) or run "npm run demo".`
})
