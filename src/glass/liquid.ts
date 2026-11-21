import * as THREE from 'three'
import { createField, type Draw, type Spot } from './field'
import liquidShader from './shaders/liquid.frag?raw'

/** Tuning of the water surface (the wave behaviour itself is at the top of shaders/liquid.frag). */
export const flow = {
  /** Cells across the card. More = finer ripples, slower waves. */
  cells: 128,
  /** Push of a moving pointer: per px/s, and the most it can push. */
  stir: 0.0006,
  stirMax: 0.35,
  /** How much the card's own acceleration tilts the water. */
  slosh: 0.000012,
  sloshMax: 0.12,
  /** Small drops that keep the surface alive: strength, and seconds between them (shortest, longest). */
  drop: 0.16,
  dropEvery: [1.1, 2.6] as [number, number],
}

/** Water: a height map where waves travel, bounce off the rim and die out. */
export function createLiquid(draw: Draw, aspect: number) {
  const uDrop = { value: new THREE.Vector3() }
  const uSlosh = { value: new THREE.Vector2() }
  const field = createField(draw, aspect, flow.cells, liquidShader, { uDrop, uSlosh })
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  let owed = 0
  let untilDrop = 0.6

  return {
    texel: field.texel,
    get texture() {
      return field.texture
    },
    /**
     * Advance by `dt` seconds. `touch` is the pointer on the card in card coordinates 0–1 (null when
     * it is off the card), `speed` its speed over the card in px/s, `push` the card's acceleration.
     */
    update(dt: number, touch: Spot | null, speed: number, push: Spot) {
      const clamp = (value: number, most: number) => Math.max(-most, Math.min(most, value))
      field.touch.value = field.stroke(touch) ? Math.min(speed * flow.stir, flow.stirMax) : 0
      uSlosh.value.set(clamp(push[0] * flow.slosh, flow.sloshMax), clamp(push[1] * flow.slosh, flow.sloshMax))

      untilDrop -= dt
      uDrop.value.z = 0
      if (untilDrop < 0 && !still) {
        untilDrop = flow.dropEvery[0] + Math.random() * (flow.dropEvery[1] - flow.dropEvery[0])
        uDrop.value.set(0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.7, flow.drop)
      }

      // The waves run at 60 steps per second whatever the screen's refresh rate.
      owed = Math.min(owed + dt * 60, 3)
      while (owed >= 1) {
        owed -= 1
        field.step()
        uDrop.value.z = 0
      }
    },
  }
}
