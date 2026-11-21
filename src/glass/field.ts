import * as THREE from 'three'
import screenShader from './shaders/screen.vert?raw'

export type Draw = (material: THREE.Material, target: THREE.WebGLRenderTarget | null) => void
export type Spot = [number, number]

/**
 * A small map laid over the card that a shader advances one moment at a time (water height, sand
 * height, how far frost has been wiped). It is kept in two pictures that take turns being the
 * previous and the next moment. Every such shader receives uState, uTexel, uAspect and the
 * pointer's stroke (uTouchFrom, uTouchTo, uTouch).
 */
export function createField(draw: Draw, aspect: number, cells: number, fragmentShader: string, extra: Record<string, THREE.IUniform> = {}) {
  const width = cells
  const height = Math.round(cells / aspect)
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
    ...extra,
  }
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: screenShader, fragmentShader, depthTest: false, depthWrite: false })
  let last: Spot | null = null

  return {
    texel: uniforms.uTexel.value,
    touch: uniforms.uTouch,
    get texture() {
      return now.texture
    },
    /** Tells the shader where the pointer went since the last frame. False when it has only just arrived (or is away). */
    stroke(spot: Spot | null) {
      const moving = !!spot && !!last
      if (spot) {
        uniforms.uTouchFrom.value.set(...(last ?? spot))
        uniforms.uTouchTo.value.set(...spot)
      }
      last = spot
      return moving
    },
    /** Advance one moment. */
    step() {
      uniforms.uState.value = now.texture
      draw(material, next)
      ;[now, next] = [next, now]
    },
  }
}
