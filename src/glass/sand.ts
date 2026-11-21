import * as THREE from 'three'
import sandShader from './shaders/sand.frag?raw'
import screenShader from './shaders/screen.vert?raw'

/** Tuning of the sand (how it slumps is at the top of shaders/sand.frag). */
export const grit = {
  /** Cells across the card. */
  cells: 128,
  /** Sand moved by the pointer: per px travelled, and the most per step. */
  dig: 0.006,
  digMax: 0.09,
  /** How far shaking the card throws the sand, and the most. */
  shake: 0.00002,
  shakeMax: 0.09,
  /** Settling steps per frame. More = sand slumps faster. */
  steps: 3,
}

type Draw = (material: THREE.Material, target: THREE.WebGLRenderTarget | null) => void

/** A height map of dry sand, kept in two pictures that take turns being the previous and the next moment. */
export function createSand(draw: Draw, aspect: number) {
  const width = grit.cells
  const height = Math.round(grit.cells / aspect)
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
    uSlide: { value: new THREE.Vector2() },
    uReset: { value: 1 },
  }
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: screenShader, fragmentShader: sandShader, depthTest: false, depthWrite: false })
  let last: [number, number] | null = null
  const step = () => {
    uniforms.uState.value = now.texture
    draw(material, next)
    ;[now, next] = [next, now]
  }

  return {
    texel: uniforms.uTexel.value,
    get texture() {
      return now.texture
    },
    /** Lay fresh raked sand. */
    reset() {
      uniforms.uReset.value = 1
      step()
      uniforms.uReset.value = 0
    },
    /**
     * One frame. `touch` is the pointer on the card in card coordinates 0–1 (null when it is off the
     * card), `travel` how many px it moved over the card, `push` the card's acceleration.
     */
    update(touch: [number, number] | null, travel: number, push: [number, number]) {
      const clamp = (value: number) => Math.max(-grit.shakeMax, Math.min(grit.shakeMax, value))
      // Sand keeps going when the card is yanked away under it: it is thrown against the acceleration.
      uniforms.uSlide.value.set(clamp(-push[0] * grit.shake), clamp(-push[1] * grit.shake))
      uniforms.uTouch.value = touch && last ? Math.min(travel * grit.dig, grit.digMax) : 0
      if (touch) {
        uniforms.uTouchFrom.value.set(...(last ?? touch))
        uniforms.uTouchTo.value.set(...touch)
      }
      last = touch
      for (let i = 0; i < grit.steps; i++) {
        step()
        uniforms.uTouch.value = 0 // the stroke is dug once; the other steps only let the sand settle
      }
    },
  }
}
