import * as THREE from 'three'
import liquidShader from './shaders/liquid.frag?raw'
import screenShader from './shaders/screen.vert?raw'

/** Tuning of the liquid skin (the wave behaviour itself is at the top of shaders/liquid.frag). */
export const flow = {
  /** Cells across the card. More = finer ripples, slower waves. */
  cells: 128,
  /** Push of a moving pointer: per px/s, and the most it can push. */
  stir: 0.0006,
  stirMax: 0.35,
  /** How much the card's own acceleration tilts the liquid. */
  slosh: 0.000012,
  sloshMax: 0.12,
  /** Small drops that keep the surface alive: strength, and seconds between them (shortest, longest). */
  drop: 0.16,
  dropEvery: [1.1, 2.6] as [number, number],
}

type Draw = (material: THREE.Material, target: THREE.WebGLRenderTarget | null) => void

/**
 * A small height map that behaves like the surface of water, kept in two pictures that take
 * turns being the previous and the next moment.
 */
export function createLiquid(draw: Draw, aspect: number) {
  const width = flow.cells
  const height = Math.round(flow.cells / aspect)
  const target = () =>
    new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    })
  let now = target()
  let next = target()
  const uniforms = {
    uState: { value: now.texture },
    uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
    uAspect: { value: aspect },
    uTouchFrom: { value: new THREE.Vector2() },
    uTouchTo: { value: new THREE.Vector2() },
    uTouch: { value: 0 },
    uDrop: { value: new THREE.Vector3() },
    uSlosh: { value: new THREE.Vector2() },
  }
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: screenShader, fragmentShader: liquidShader, depthTest: false, depthWrite: false })
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  let owed = 0
  let untilDrop = 0.6
  let last: [number, number] | null = null

  return {
    texel: uniforms.uTexel.value,
    get texture() {
      return now.texture
    },
    /**
     * Advance by `dt` seconds. `touch` is the pointer on the card in card coordinates 0–1 (null when
     * it is off the card), `speed` its speed over the card in px/s, `push` the card's acceleration.
     */
    update(dt: number, touch: [number, number] | null, speed: number, push: [number, number]) {
      const clamp = (value: number, most: number) => Math.max(-most, Math.min(most, value))
      uniforms.uTouch.value = touch && last ? Math.min(speed * flow.stir, flow.stirMax) : 0
      if (touch) {
        uniforms.uTouchFrom.value.set(...(last ?? touch))
        uniforms.uTouchTo.value.set(...touch)
      }
      last = touch
      uniforms.uSlosh.value.set(clamp(push[0] * flow.slosh, flow.sloshMax), clamp(push[1] * flow.slosh, flow.sloshMax))

      untilDrop -= dt
      uniforms.uDrop.value.z = 0
      if (untilDrop < 0 && !still) {
        untilDrop = flow.dropEvery[0] + Math.random() * (flow.dropEvery[1] - flow.dropEvery[0])
        uniforms.uDrop.value.set(0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.7, flow.drop)
      }

      // The waves run at 60 steps per second whatever the screen's refresh rate.
      owed = Math.min(owed + dt * 60, 3)
      while (owed >= 1) {
        owed -= 1
        uniforms.uState.value = now.texture
        draw(material, next)
        ;[now, next] = [next, now]
        uniforms.uDrop.value.z = 0
      }
    },
  }
}
