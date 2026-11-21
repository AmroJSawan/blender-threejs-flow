import { createField, type Draw, type Spot } from './field'
import heatShader from './shaders/heat.frag?raw'

/** Heat added by rubbing: per px the pointer travels, and the most per frame (the rest is at the top of shaders/heat.frag). */
export const friction = { warm: 0.012, most: 0.5 }

/** Heat that the pointer rubs in, and that spreads, rises and cools. */
export function createHeat(draw: Draw, aspect: number) {
  const field = createField(draw, aspect, 96, heatShader)
  return {
    get texture() {
      return field.texture
    },
    update(touch: Spot | null, travel: number) {
      field.touch.value = field.stroke(touch) ? Math.min(travel * friction.warm, friction.most) : 0
      field.step()
    },
  }
}
