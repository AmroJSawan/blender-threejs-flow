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
 *   Other pragmas: `points` (draw the vertices as dots), `outline` (ink outline), `refract` (sees the scene behind it).
 * Uniforms every shader receives: uTime, uScroll, uMouse, uPointer, uResolution, uPixelRatio, uHover, uProgress,
 * uColor, uBoundsMin, uBoundsMax.
 */
export function createShaders(stage: Stage) {
  const shared = {
    uTime: { value: 0 },
    uScroll: { value: 0 },
    /** Eased pointer, -1…1. For slow leaning and light direction. */
    uMouse: { value: new THREE.Vector2() },
    /** Exact pointer (or finger), -1…1 across the picture; far outside when there is none. */
    uPointer: { value: new THREE.Vector2(9, 9) },
    /** Size of the picture in CSS pixels, and device pixels per CSS pixel. */
    uResolution: { value: new THREE.Vector2(1, 1) },
    uPixelRatio: { value: 1 },
    /** Filled by render.ts: a copy of what has been drawn so far, and the size of the canvas in device pixels. */
    uScene: { value: null as THREE.Texture | null },
    uBuffer: { value: new THREE.Vector2(1, 1) },
  }
  /** Objects whose shader has `#pragma refract`: drawn last, with the rest of the scene available as uScene. */
  const refractors: THREE.Mesh[] = []
  /** uProgress of every object: 0 → 1 while the page scrolls from the object's `from` to its `to`. */
  const reveals: { uniform: THREE.IUniform<number>; from: number; to: number }[] = []
  const hidden = new THREE.MeshBasicMaterial({ visible: false })

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

  /** Material of the ink outline: `width` in screen pixels, the same at any distance. */
  const outline = (width: number) =>
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uResolution: shared.uResolution, uWidth: { value: width } },
      vertexShader: /* glsl */ `
        uniform vec2 uResolution;
        uniform float uWidth;
        void main() {
          vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vec4 outward = projectionMatrix * vec4(normalMatrix * normal, 0.0);
          clip.xy += normalize(outward.xy * uResolution + 1e-6) * uWidth * 2.0 / uResolution * clip.w;
          gl_Position = clip;
        }`,
      fragmentShader: /* glsl */ `void main() { gl_FragColor = vec4(0.07, 0.06, 0.12, 1.0); }`,
    })

  stage.root.traverse((object) => {
    const name = object.userData.shader
    if (typeof name !== 'string' || !name || !(object instanceof THREE.Mesh)) return
    const old = Array.isArray(object.material) ? object.material[0] : object.material
    const uColor = { value: old instanceof THREE.MeshStandardMaterial ? old.color.clone() : new THREE.Color('#ffffff') }
    // Shares the hover amount animated in hover.ts (if the object or a parent is hoverable).
    let owner: THREE.Object3D = object
    while (!owner.userData.hoverAmount && owner.parent) owner = owner.parent
    const uHover = (owner.userData.hoverAmount ?? (object.userData.hoverAmount = { value: 0 })) as THREE.IUniform<number>
    // `copies = 140` in Blender: the mesh is drawn that many times in one go, and the vertex
    // shader tells the copies apart with gl_InstanceID (used by echo.vert for its light tail).
    const copies = Number(object.userData.copies)
    if (copies > 1) {
      const instanced = new THREE.InstancedBufferGeometry().copy(object.geometry)
      instanced.instanceCount = Math.round(copies)
      object.geometry = instanced
    }
    if (copies > 1) object.frustumCulled = false // the copies reach beyond the mesh's own box
    // A shape key made in Blender arrives as  attribute vec3 morph  (how far each vertex travels).
    const morph = object.geometry.morphAttributes.position?.[0]
    if (morph) object.geometry.setAttribute('morph', morph)
    // `from = 0.4`, `to = 0.5` in Blender: uProgress runs 0 → 1 between those scroll positions (0 = top of the page, 1 = bottom).
    const uProgress = { value: 0 }
    const from = Number(object.userData.from) || 0
    const to = Number(object.userData.to) || 1
    reveals.push({ uniform: uProgress, from, to: Math.max(to, from + 1e-4) })
    // The object's own size, for shaders that draw relative to its box (e.g. lineart).
    object.geometry.computeBoundingBox()
    const box = object.geometry.boundingBox!
    const uAnchor = { value: new THREE.Vector3() }
    // Number properties set in Blender become uniforms: `floors = 12` → `uniform float uFloors`.
    const numbers: Record<string, THREE.IUniform> = {}
    for (const [key, value] of Object.entries(object.userData)) {
      if (typeof value === 'number') numbers[`u${key[0].toUpperCase()}${key.slice(1)}`] = { value }
    }
    const material = make(name, { ...numbers, uColor, uHover, uProgress, uAnchor, uBoundsMin: { value: box.min }, uBoundsMax: { value: box.max } })
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
      material.blendSrcAlpha = THREE.OneFactor // keeps the canvas itself opaque
      material.depthTest = material.depthWrite = false
      object.renderOrder = 0.5
      object.userData.underlay = true
    }
    if (has('refract')) {
      // Layer 1 is drawn in a second pass, after the scene so far has been copied into uScene.
      object.layers.set(1)
      refractors.push(object)
    }
    if (has('outline')) {
      // Ink outline: the same mesh again, pushed outward and showing only its back faces.
      const hull = new THREE.Mesh(object.geometry, outline(Number(object.userData.outline) || 3))
      hull.renderOrder = 1
      object.add(hull)
    }
    if (has('points')) {
      // The vertices are drawn as dots. The mesh itself stays, invisible, to catch the pointer.
      const dots = new THREE.BufferGeometry()
      dots.setAttribute('position', object.geometry.attributes.position)
      if (morph) dots.setAttribute('morph', morph)
      const points = new THREE.Points(dots, material)
      points.frustumCulled = false
      points.renderOrder = 1
      object.add(points)
      object.material = hidden
      return
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

  /** Size in pixels of the picture being drawn (the window, or one card). */
  const setResolution = (width: number, height: number) => {
    shared.uResolution.value.set(width, height)
    shared.uPixelRatio.value = stage.renderer.getPixelRatio()
  }
  stage.onResize(setResolution)

  return {
    uniforms: shared,
    refractors,
    setResolution,
    /** Where the pointer or finger is, -1…1 across the picture. Call without arguments when there is none. */
    setPointer: (x = 9, y = 9) => shared.uPointer.value.set(x, y),
    /**
     * Call once per frame. `replay` (0–1) replaces the scroll position for every object's uProgress;
     * the card view uses it to play the reveals back and forth, since there is no scroll there.
     */
    update(time: number, scroll: number, mouse: THREE.Vector2, replay?: number) {
      shared.uTime.value = time
      shared.uScroll.value = scroll
      shared.uMouse.value.copy(mouse)
      for (const { uniform, from, to } of reveals) uniform.value = replay ?? THREE.MathUtils.clamp((scroll - from) / (to - from), 0, 1)
      anchors.forEach((update) => update())
    },
  }
}

export type Shaders = ReturnType<typeof createShaders>
