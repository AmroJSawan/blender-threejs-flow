import * as THREE from 'three'
import { config } from './config'
import { matches } from './hover'
import type { Stage } from './stage'

interface Card {
  object: THREE.Object3D
  view: HTMLElement
  center: THREE.Vector3
  radius: number
  /** Where the user dragged to, and the eased values actually drawn. */
  target: { yaw: number; pitch: number; zoom: number }
  shown: { yaw: number; pitch: number; zoom: number }
}

/**
 * Card view for small screens.
 * Every object with a `label` (or listed in config.cards.names) gets its own card,
 * stacked vertically. Each card has its own orbit camera: drag to rotate, pinch to zoom.
 * All cards are drawn by the one canvas, each into its own rectangle.
 */
export function createCards(stage: Stage) {
  const opts = config.cards
  const { renderer, scene } = stage
  const canvas = renderer.domElement
  const list = document.querySelector<HTMLElement>('#scroll')!
  const camera = new THREE.PerspectiveCamera(opts.fov, 1, 0.05, 500)
  const startPitch = THREE.MathUtils.degToRad(opts.pitch)
  const [minZoom, maxZoom] = opts.zoom
  document.body.classList.add('cards')

  if (opts.hint) {
    const hint = document.createElement('p')
    hint.className = 'cards-hint'
    hint.textContent = opts.hint
    list.append(hint)
  }

  const cards: Card[] = []
  stage.root.updateWorldMatrix(true, true)
  for (const object of stage.root.children) {
    const picked = opts.names.length ? opts.names.some((p) => matches(object.name, p)) : typeof object.userData.label === 'string'
    if (!picked) {
      // Floors and other set dressing are left out; lights stay on.
      let hasMesh = false
      object.traverse((o) => (hasMesh ||= o instanceof THREE.Mesh))
      if (hasMesh) object.visible = false
      continue
    }

    // Frame the object itself, ignoring ground sheets drawn underneath it.
    const box = new THREE.Box3()
    object.traverse((o) => {
      if (o instanceof THREE.Mesh && o.renderOrder >= 0) box.expandByObject(o)
    })
    const sphere = box.getBoundingSphere(new THREE.Sphere())

    const article = document.createElement('article')
    article.className = 'card'
    const view = document.createElement('div')
    view.className = 'card-view'
    const text = document.createElement('div')
    text.className = 'card-text'
    const title = document.createElement('h2')
    title.textContent = object.name.replace(/_/g, ' ')
    text.append(title)
    if (typeof object.userData.label === 'string') {
      const caption = document.createElement('p')
      caption.textContent = object.userData.label
      text.append(caption)
    }
    if (typeof object.userData.link === 'string' && object.userData.link) {
      const link = document.createElement('a')
      link.href = object.userData.link
      link.target = '_blank'
      link.rel = 'noopener'
      link.textContent = 'Open link'
      text.append(link)
    }
    article.append(view, text)
    list.append(article)

    const start = { yaw: 0, pitch: startPitch, zoom: 1 }
    const card: Card = { object, view, center: sphere.center, radius: sphere.radius, target: { ...start }, shown: { ...start } }
    cards.push(card)
    control(card, start)
  }

  /** Pointer handling for one card: one finger rotates, two fingers zoom. */
  function control(card: Card, start: Card['target']) {
    const { view, target } = card
    const pointers = new Map<number, { x: number; y: number }>()
    let spread = 0
    const setZoom = (zoom: number) => (target.zoom = THREE.MathUtils.clamp(zoom, minZoom, maxZoom))

    view.addEventListener('pointerdown', (e) => {
      view.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      spread = 0
    })
    view.addEventListener('pointermove', (e) => {
      const last = pointers.get(e.pointerId)
      if (!last) return
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 1) {
        const turn = (opts.dragTurn * Math.PI) / view.clientWidth // radians per pixel
        target.yaw -= dx * turn
        target.pitch = THREE.MathUtils.clamp(target.pitch + dy * turn, -1.2, 1.4)
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const now = Math.hypot(a.x - b.x, a.y - b.y)
        if (spread > 0) setZoom((target.zoom * now) / spread)
        spread = now
      }
    })
    const release = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      spread = 0
    }
    view.addEventListener('pointerup', release)
    view.addEventListener('pointercancel', release)
    // Trackpad pinch (and Ctrl + wheel) on laptops.
    view.addEventListener(
      'wheel',
      (e) => {
        if (!e.ctrlKey) return
        e.preventDefault()
        setZoom(target.zoom * Math.exp(-e.deltaY * 0.01))
      },
      { passive: false },
    )
    view.addEventListener('dblclick', () => Object.assign(target, start))
  }

  const offset = new THREE.Vector3()

  return {
    /** Draws every card that is on screen. Call once per frame instead of renderer.render. */
    render() {
      // The canvas travels with the page, so cards never lag behind while scrolling.
      canvas.style.transform = `translateY(${window.scrollY}px)`
      const screen = window.innerHeight
      renderer.setScissorTest(false)
      renderer.clear()
      renderer.setScissorTest(true)

      for (const card of cards) {
        const rect = card.view.getBoundingClientRect()
        if (rect.bottom <= 0 || rect.top >= screen || rect.width === 0) continue
        const { shown, target } = card
        shown.yaw += (target.yaw - shown.yaw) * opts.ease
        shown.pitch += (target.pitch - shown.pitch) * opts.ease
        shown.zoom += (target.zoom - shown.zoom) * opts.ease

        camera.aspect = rect.width / rect.height
        camera.updateProjectionMatrix()
        // Far enough to fit the whole object in the narrower direction of the card.
        const half = THREE.MathUtils.degToRad(opts.fov) / 2
        const fit = Math.min(half, Math.atan(Math.tan(half) * camera.aspect))
        const distance = (card.radius / Math.sin(fit)) * opts.margin / shown.zoom
        offset.set(Math.sin(shown.yaw) * Math.cos(shown.pitch), Math.sin(shown.pitch), Math.cos(shown.yaw) * Math.cos(shown.pitch))
        camera.position.copy(card.center).addScaledVector(offset, distance)
        camera.lookAt(card.center)
        camera.updateMatrixWorld()

        for (const other of cards) other.object.visible = other === card
        const bottom = screen - rect.bottom
        renderer.setViewport(rect.left, bottom, rect.width, rect.height)
        renderer.setScissor(rect.left, bottom, rect.width, rect.height)
        renderer.render(scene, camera)
      }
    },
  }
}
