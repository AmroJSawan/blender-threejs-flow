import { createField, type Draw, type Spot } from './field'
import fogShader from './shaders/fog.frag?raw'

/** Frost that a warm finger wipes clear and that slowly grows back (tuning at the top of shaders/fog.frag). */
export function createFog(draw: Draw, aspect: number) {
  const field = createField(draw, aspect, 96, fogShader)
  return {
    get texture() {
      return field.texture
    },
    update(touch: Spot | null) {
      field.stroke(touch)
      field.touch.value = touch ? 1 : 0
      field.step()
    },
  }
}
