import * as THREE from 'three'
import { config } from './config'
import type { Stage } from './stage'

// Every .frag file in src/shaders is available by its file name.
const sources = import.meta.glob<string>('./shaders/*.frag', { query: '?raw', import: 'default', eager: true })
// Shared snippets: write  #include "file.glsl"  in any shader.
const snippets = import.meta.glob<string>('./shaders/*.glsl', { query: '?raw', import: 'default', eager: true })
function withIncludes(source: string): string {
  return source.replace(/^[ \t]*#include "(.+?)"/gm, (line, file: string) => snippets[`./shaders/${file}`] ?? line)
}
const fragments = new Map(Object.entries(sources).map(([path, src]) => [path.replace(/^.*\/|\.frag$/g, ''), withIncludes(src)]))
// Optional: a .vert file with the same name moves the vertices too (e.g. wave displacement).
const vertexSources = import.meta.glob<string>('./shaders/*.vert', { query: '?raw', import: 'default', eager: true })
const vertices = new Map(Object.entries(vertexSources).map(([path, src]) => [path.replace(/^.*\/|\.vert$/g, ''), withIncludes(src)]))

const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vLocalPosition;
  varying vec3 vLocalNormal;
  varying float vWave;
  uniform float uFullscreen;
  void main() {
    vUv = uv;
    vWave = 0.0;
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vLocalPosition = position;
    vLocalNormal = normal;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = uFullscreen > 0.5 ? vec4(position.xy, 1.0, 1.0) : projectionMatrix * viewMatrix * world;
  }
`

/**
 * Fragment shaders.
 * - On an object: add the custom property `shader` in Blender with the file name (e.g. "pulse").
 * - Behind everything: set config.look.backgroundShader.
 * - Add <name>.vert next to <name>.frag to also displace the surface.
 * - A shader is solid unless it contains `#pragma transparent`, `nodepth`, `additive` or `underlay`.
 * Uniforms every shader receives: uTime, uScroll, uMouse, uResolution, uHover, uColor, uBoundsMin, uBoundsMax.
 */
export function createShaders(stage: Stage) {
  const shared = {
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uMouse: { value: new THREE.Vector2() },
    uResolution: { value: new THREE.Vector2(1, 1) },
  }

  const make = (name: string, extra: Record<string, THREE.IUniform>, fullscreen = false) => {
    const fragmentShader = fragments.get(name)
    if (!fragmentShader) {
      console.warn(`Shader "${name}" not found. Available: ${[...fragments.keys()].join(', ')}`)
      return null
    }
    const vertexShader = (!fullscreen && vertices.get(name)) || vertex
    // Every declared float starts at 0, so an object without that Blender property never
    // inherits the value of another object drawn with the same shader.
    const defaults: Record<string, THREE.IUniform> = {}
    for (const [, uniform] of (vertexShader + fragmentShader).matchAll(/uniform\s+float\s+(\w+)\s*;/g)) defaults[uniform] = { value: 0 }
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { ...defaults, ...shared, uFullscreen: { value: fullscreen ? 1 : 0 }, uHover: { value: 0 }, uColor: { value: new THREE.Color('#ffffff') }, ...extra },
      depthTest: !fullscreen,
      depthWrite: !fullscreen,
    })
  }

  const anchors: (() => void)[] = []

  stage.root.traverse((object) => {
    const name = object.userData.shader
    if (typeof name !== 'string' || !name || !(object instanceof THREE.Mesh)) return
    const old = Array.isArray(object.material) ? object.material[0] : object.material
    const uColor = { value: old instanceof THREE.MeshStandardMaterial ? old.color.clone() : new THREE.Color('#ffffff') }
    // Shares the hover amount animated in hover.ts (if the object or a parent is hoverable).
    let owner: THREE.Object3D = object
    while (!owner.userData.hoverAmount && owner.parent) owner = owner.parent
    const uHover = (owner.userData.hoverAmount ?? (object.userData.hoverAmount = { value: 0 })) as THREE.IUniform<number>
    // The object's own size, for shaders that draw relative to its box (e.g. lineart).
    object.geometry.computeBoundingBox()
    const box = object.geometry.boundingBox!
    const uAnchor = { value: new THREE.Vector3() }
    // Number properties set in Blender become uniforms: `floors = 12` → `uniform float uFloors`.
    const numbers: Record<string, THREE.IUniform> = {}
    for (const [key, value] of Object.entries(object.userData)) {
      if (typeof value === 'number') numbers[`u${key[0].toUpperCase()}${key.slice(1)}`] = { value }
    }
    const material = make(name, { ...numbers, uColor, uHover, uAnchor, uBoundsMin: { value: box.min }, uBoundsMax: { value: box.max } })
    if (!material) return
    // Grouped objects share their parent's position, so flat2d.glsl flattens them as one drawing.
    const group = object.parent && object.parent !== stage.root ? object.parent : object
    anchors.push(() => group.getWorldPosition(uAnchor.value))
    material.side = old.side // keeps Blender's backface-culling choice
    // Shaders are solid by default (fastest, and they hide each other correctly).
    // A shader opts into other behaviour with a  #pragma  line:
    const has = (pragma: string) => material.fragmentShader.includes(`#pragma ${pragma}`)
    if (has('transparent')) material.transparent = true // uses the alpha it outputs
    if (has('nodepth')) material.depthWrite = false // never hides what is behind it (thin lines, glows)
    if (has('additive')) {
      // Light-like: adds to what is behind it.
      material.transparent = true
      material.blending = THREE.AdditiveBlending
      material.depthWrite = false
    }
    // Draw order: ordinary Blender materials, then ground sheets, then every other shader object.
    object.renderOrder = 1
    if (has('underlay')) {
      // Ground sheets blend over the ordinary scene (the floor) and are painted before the other
      // shader objects, so they can never cut into the drawing that stands on them.
      material.blending = THREE.CustomBlending // blends while staying in the solid pass
      material.depthTest = material.depthWrite = false
      object.renderOrder = 0.5
      object.userData.underlay = true
    }
    object.material = material
  })

  const bg = config.look.backgroundShader
  if (bg) {
    const material = make(bg, {}, true)
    if (material) {
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
      quad.frustumCulled = false
      quad.renderOrder = -1000
      stage.scene.add(quad)
    }
  }

  stage.onResize((w, h) => shared.uResolution.value.set(w, h))

  return {
    update(time: number, scroll: number, mouse: THREE.Vector2) {
      shared.uTime.value = time
      shared.uScroll.value = scroll
      shared.uMouse.value.copy(mouse)
      anchors.forEach((update) => update())
    },
  }
}
