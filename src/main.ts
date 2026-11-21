import gsap from 'gsap'
import * as THREE from 'three'
import { config } from './config'
import { createStage } from './stage'
import { createScroll } from './scroll'
import { createHover } from './hover'
import { createShaders } from './shaders'

async function start() {
  const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
  const stage = await createStage(canvas)
  const scroll = createScroll(stage)
  const hover = createHover(stage)
  const shaders = createShaders(stage)

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

    shaders.update(elapsed, scroll.progress, drift)
    stage.renderer.render(stage.scene, stage.camera)
  })

  // Handy in the browser console: __stage.scene, __stage.camera …
  ;(window as unknown as { __stage: unknown }).__stage = stage
}

start().catch((error) => {
  console.error(error)
  const message = document.querySelector<HTMLElement>('#message')!
  message.hidden = false
  message.textContent = `Could not load ${config.model}. Export from Blender (N panel → three.js → Export) or run "npm run demo".`
})
