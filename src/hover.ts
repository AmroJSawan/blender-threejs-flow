import * as THREE from 'three'
import gsap from 'gsap'
import { config, events } from './config'
import type { Stage } from './stage'

interface Target {
  object: THREE.Object3D
  baseScale: THREE.Vector3
  materials: THREE.MeshStandardMaterial[]
  /** 0 → 1 hover amount, also fed to shaders as uHover. */
  amount: { value: number }
}

/** "Door_*" style wildcard match. */
function matches(name: string, pattern: string): boolean {
  const escaped = pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^${escaped.join('.*')}$`).test(name)
}

/**
 * Hover + click.
 * An object is interactive when it has the custom property `hover` in Blender,
 * or when its name matches config.hover.names.
 */
export function createHover(stage: Stage) {
  const opts = config.hover
  const targets = new Map<THREE.Object3D, Target>()

  stage.root.traverse((object) => {
    const tagged = Boolean(object.userData.hover)
    const named = opts.names.some((p) => matches(object.name, p))
    if (!tagged && !named) return
    const materials: THREE.MeshStandardMaterial[] = []
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      // Clone so the glow does not leak to other objects sharing the material.
      const list = (Array.isArray(child.material) ? child.material : [child.material]).map((m: THREE.Material) => {
        if (!(m instanceof THREE.MeshStandardMaterial)) return m
        const copy = m.clone()
        materials.push(copy)
        return copy
      })
      child.material = Array.isArray(child.material) ? list : list[0]
    })
    const amount = (object.userData.hoverAmount ??= { value: 0 }) as { value: number }
    targets.set(object, { object, baseScale: object.scale.clone(), materials, amount })
  })

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2(2, 2)
  /** Pointer in -1…1, for parallax and shaders. Stays 0,0 until the pointer moves. */
  const mouse = new THREE.Vector2()
  const label = document.querySelector<HTMLElement>('#label')!
  const glow = new THREE.Color(opts.glow)
  let current: Target | null = null
  let dirty = false

  const pick = (): Target | null => {
    if (!targets.size) return null
    raycaster.setFromCamera(pointer, stage.camera)
    const hit = raycaster.intersectObjects([...targets.keys()], true)[0]
    for (let o: THREE.Object3D | null = hit?.object ?? null; o; o = o.parent) {
      const target = targets.get(o)
      if (target) return target
    }
    return null
  }

  const animate = (t: Target, on: boolean) => {
    const s = on ? opts.scale : 1
    gsap.to(t.object.scale, {
      x: t.baseScale.x * s,
      y: t.baseScale.y * s,
      z: t.baseScale.z * s,
      duration: opts.duration,
      ease: 'power2.out',
      overwrite: true,
    })
    gsap.to(t.amount, {
      value: on ? 1 : 0,
      duration: opts.duration,
      overwrite: true,
      onUpdate: () => {
        for (const m of t.materials) {
          m.emissive.copy(glow)
          m.emissiveIntensity = t.amount.value * opts.glowStrength
        }
      },
    })
  }

  const setCurrent = (next: Target | null) => {
    if (next === current) return
    if (current) {
      animate(current, false)
      events.onLeave(current.object)
    }
    current = next
    document.body.style.cursor = next ? 'pointer' : ''
    const text = next?.object.userData.label
    label.hidden = typeof text !== 'string' || !text
    if (!label.hidden) label.textContent = text
    if (next) {
      animate(next, true)
      events.onEnter(next.object)
    }
  }

  const place = (e: PointerEvent | MouseEvent) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    mouse.copy(pointer)
    label.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`
    dirty = true
  }

  window.addEventListener('pointermove', place)
  window.addEventListener('pointerleave', () => setCurrent(null))
  window.addEventListener('click', (e) => {
    place(e) // touch screens have no hover, so pick at the tap position
    const target = pick()
    setCurrent(target)
    if (target) events.onClick(target.object)
  })

  return {
    mouse,
    /** Call once per frame, after the camera is in place. */
    update(cameraMoved: boolean) {
      if (!dirty && !cameraMoved) return
      dirty = false
      if (pointer.x <= 1) setCurrent(pick())
    },
  }
}
