import * as THREE from 'three'
import { createField, type Draw, type Spot } from './field'
import sandShader from './shaders/sand.frag?raw'

/** Tuning of the sand (how it slumps is at the top of shaders/sand.frag). */
export const grit = {
  /** Cells across the card. */
  cells: 128,
  /** Sand moved by the pointer: per px travelled, and the most per frame. */
  dig: 0.006,
  digMax: 0.09,
  /** How far shaking the card throws the sand, and the most. */
  shake: 0.00002,
  shakeMax: 0.09,
  /** Settling steps per frame. More = sand slumps faster. */
  steps: 3,
}

/** Dry sand: a height map that only moves where a slope is steeper than its angle of rest. */
export function createSand(draw: Draw, aspect: number) {
  const uSlide = { value: new THREE.Vector2() }
  const uReset = { value: 0 }
  const field = createField(draw, aspect, grit.cells, sandShader, { uSlide, uReset })

  return {
    texel: field.texel,
    get texture() {
      return field.texture
    },
    /** Lay fresh raked sand. */
    reset() {
      uReset.value = 1
      field.step()
      uReset.value = 0
    },
    /** One frame. `travel` is how many px the pointer moved over the card, `push` the card's acceleration. */
    update(touch: Spot | null, travel: number, push: Spot) {
      const clamp = (value: number) => Math.max(-grit.shakeMax, Math.min(grit.shakeMax, value))
      // Sand keeps going when the card is yanked away under it: it is thrown against the acceleration.
      uSlide.value.set(clamp(-push[0] * grit.shake), clamp(-push[1] * grit.shake))
      field.touch.value = field.stroke(touch) ? Math.min(travel * grit.dig, grit.digMax) : 0
      for (let i = 0; i < grit.steps; i++) {
        field.step()
        field.touch.value = 0 // the stroke is dug once; the other steps only let the sand settle
      }
    },
  }
}
