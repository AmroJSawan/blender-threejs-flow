import * as THREE from 'three'
import { config } from './config'
import type { Shaders } from './shaders'
import type { Stage } from './stage'

// Screen effects: every .frag file in src/shaders/effects, by file name.
const sources = import.meta.glob<string>('./shaders/effects/*.frag', { query: '?raw', import: 'default', eager: true })
const effects = new Map(Object.entries(sources).map(([path, source]) => [path.replace(/^.*\/|\.frag$/g, ''), source]))

/**
 * Draws one picture. Use render(camera) instead of renderer.render(scene, camera).
 *
 * 1. The scene.
 * 2. Objects whose shader has `#pragma refract` (glass that bends what is behind it):
 *    the picture so far is copied into the texture uScene, then they are drawn on top.
 * 3. The screen effect, if one is chosen: the picture is copied again and redrawn through
 *    src/shaders/effects/<name>.frag.
 *
 * The copies are taken straight from the canvas, so steps 2 and 3 cost one copy each and
 * nothing at all when they are not used.
 */
export function createPipeline(stage: Stage, shaders: Shaders) {
  const { renderer, scene } = stage
  const { uniforms, refractors } = shaders
  const gl = renderer.getContext()

  // ---- Copy of the canvas ----------------------------------------------------
  let copy: THREE.FramebufferTexture | null = null
  let copyHasMips = false

  /** Copies what has been drawn so far into uScene. `mips` also builds blurred, smaller versions (for glow). */
  function grab(mips: boolean) {
    const { x: width, y: height } = uniforms.uBuffer.value
    if (!copy || copy.image.width !== width || copy.image.height !== height || copyHasMips !== mips) {
      copy?.dispose()
      copy = new THREE.FramebufferTexture(width, height)
      copy.magFilter = THREE.LinearFilter
      copy.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter
      copyHasMips = mips
      uniforms.uScene.value = copy
    }
    renderer.copyFramebufferToTexture(copy)
    if (mips) {
      renderer.state.bindTexture(gl.TEXTURE_2D, (renderer.properties.get(copy) as { __webglTexture: WebGLTexture }).__webglTexture)
      gl.generateMipmap(gl.TEXTURE_2D)
      renderer.state.unbindTexture()
    }
  }

  /** Draws on top of the picture instead of starting a new one. */
  function onTop(draw: () => void) {
    const background = scene.background
    scene.background = null
    renderer.autoClear = false
    draw()
    renderer.autoClear = true
    scene.background = background
  }

  // ---- Refracting objects ----------------------------------------------------
  const frustum = new THREE.Frustum()
  const toScreen = new THREE.Matrix4()
  function inView(object: THREE.Object3D) {
    for (let o: THREE.Object3D | null = object; o; o = o.parent) if (!o.visible) return false
    return frustum.intersectsObject(object)
  }

  // ---- Screen effect ---------------------------------------------------------
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
  screen.frustumCulled = false
  const screenCamera = new THREE.Camera()
  const materials = new Map<string, THREE.ShaderMaterial>()
  let effect: THREE.ShaderMaterial | null = null
  let effectName = 'off'

  function setEffect(name: string) {
    const source = effects.get(name)
    effectName = source ? name : 'off'
    if (!source) {
      effect = null
      return
    }
    let material = materials.get(name)
    if (!material) {
      material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: source,
        depthTest: false,
        depthWrite: false,
      })
      material.userData.mips = source.includes('#pragma mipmap')
      materials.set(name, material)
    }
    effect = screen.material = material
  }
  // ?effect=ascii in the address picks an effect, so a look can be shared as a link.
  setEffect(new URLSearchParams(location.search).get('effect') ?? config.look.effect)

  // Small switcher at the bottom of the screen.
  if (config.look.effectPicker && effects.size) {
    const bar = document.createElement('div')
    bar.className = 'effects'
    bar.setAttribute('role', 'group')
    bar.setAttribute('aria-label', 'Screen effect')
    for (const name of ['off', ...[...effects.keys()].sort()]) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = name
      button.setAttribute('aria-pressed', String(name === effectName))
      button.addEventListener('click', () => {
        setEffect(name)
        for (const other of bar.children) other.setAttribute('aria-pressed', String(other === button))
      })
      bar.append(button)
    }
    document.body.append(bar)
  }

  return {
    effects: [...effects.keys()],
    setEffect,
    render(camera: THREE.Camera) {
      renderer.getDrawingBufferSize(uniforms.uBuffer.value)
      camera.layers.set(0)
      renderer.render(scene, camera)

      if (refractors.length) {
        frustum.setFromProjectionMatrix(toScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
        if (refractors.some(inView)) {
          grab(false)
          camera.layers.set(1)
          onTop(() => renderer.render(scene, camera))
          camera.layers.set(0)
        }
      }

      if (effect) {
        grab(effect.userData.mips)
        onTop(() => renderer.render(screen, screenCamera))
      }
    },
  }
}

export type Pipeline = ReturnType<typeof createPipeline>
