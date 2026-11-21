import * as THREE from 'three'
import { config } from './config'
import { matches } from './hover'
import type { Stage } from './stage'

interface View {
  yaw: number
  pitch: number
  zoom: number
}

interface Card {
  object: THREE.Object3D
  title: string
  view: HTMLElement
  center: THREE.Vector3
  radius: number
  /** Where the user dragged to, and the eased values actually drawn. */
  target: View
  shown: View
}

/**
 * Card view for small screens.
 * Every object with a `label` (or listed in config.cards.names) gets its own card,
 * stacked vertically. In the list the cards are only previews, so the page scrolls freely.
 * Tapping a card opens it full screen; there, drag rotates and pinch zooms, and Back returns.
 * All of it is drawn by the one canvas, each object into its own rectangle.
 */
export function createCards(stage: Stage) {
  const opts = config.cards
  const { renderer, scene } = stage
  const canvas = renderer.domElement
  const list = document.querySelector<HTMLElement>('#scroll')!
  const camera = new THREE.PerspectiveCamera(opts.fov, 1, 0.05, 500)
  const start: View = { yaw: 0, pitch: THREE.MathUtils.degToRad(opts.pitch), zoom: 1 }
  const [minZoom, maxZoom] = opts.zoom
  document.body.classList.add('cards')

  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') => {
    const node = document.createElement(tag)
    node.className = className
    node.textContent = text
    return node
  }

  if (opts.hint) list.append(element('p', 'cards-hint', opts.hint))

  // ---- The list of cards -------------------------------------------------
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

    const title = object.name.replace(/_/g, ' ')
    const article = element('article', 'card')
    article.tabIndex = 0
    article.setAttribute('role', 'button')
    article.setAttribute('aria-label', `Open ${title}`)
    const view = element('div', 'card-view')
    const text = element('div', 'card-text')
    text.append(element('h2', '', title))
    if (typeof object.userData.label === 'string') text.append(element('p', '', object.userData.label))
    if (typeof object.userData.link === 'string' && object.userData.link) {
      const link = element('a', '', 'Open link')
      link.href = object.userData.link
      link.target = '_blank'
      link.rel = 'noopener'
      link.addEventListener('click', (e) => e.stopPropagation())
      text.append(link)
    }
    article.append(view, text)
    list.append(article)

    const card: Card = { object, title, view, center: sphere.center, radius: sphere.radius, target: { ...start }, shown: { ...start } }
    cards.push(card)
    article.addEventListener('click', () => open(card))
    article.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        open(card)
      }
    })
  }

  // ---- The full-screen viewer --------------------------------------------
  const viewer = element('div', 'viewer')
  viewer.hidden = true
  const back = element('button', 'viewer-back', '← Back')
  back.type = 'button'
  const heading = element('h2', 'viewer-title')
  const tip = element('p', 'viewer-hint', opts.viewerHint)
  viewer.append(back, heading, tip)
  document.body.append(viewer)

  let active: Card | null = null
  let opening = false // true while a card is (or is becoming) full screen
  let grow = 0 // 0 = card size, 1 = full screen

  function open(card: Card) {
    if (active) return
    active = card
    opening = true
    heading.textContent = card.title
    viewer.hidden = false
    document.body.classList.add('viewing') // locks page scroll, lifts the canvas above the list
    history.pushState({ viewer: true }, '') // so the phone's own Back button closes the viewer
  }
  function close() {
    if (!active || !opening) return
    opening = false
    pressed = 0
    viewer.hidden = true
    Object.assign(active.target, start)
  }
  back.addEventListener('click', () => history.back())
  window.addEventListener('popstate', close)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && opening) history.back()
  })

  // Controls exist only on the viewer: one finger rotates, two fingers zoom.
  const pointers = new Map<number, { x: number; y: number }>()
  let spread = 0
  const setZoom = (zoom: number) => {
    if (active) active.target.zoom = THREE.MathUtils.clamp(zoom, minZoom, maxZoom)
  }
  // While a finger is down the object counts as "hovered", so shaders can react (uHover).
  let pressed = 0
  const excite = (card: Card, amount: number) =>
    card.object.traverse((o) => {
      const hover = o.userData.hoverAmount as { value: number } | undefined
      if (hover) hover.value += (amount - hover.value) * opts.ease
    })
  viewer.addEventListener('pointerdown', (e) => {
    if (e.target === back) return
    pressed = 1
    viewer.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    spread = 0
  })
  viewer.addEventListener('pointermove', (e) => {
    const last = pointers.get(e.pointerId)
    if (!last || !active) return
    const dx = e.clientX - last.x
    const dy = e.clientY - last.y
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 1) {
      const turn = (opts.dragTurn * Math.PI) / viewer.clientWidth // radians per pixel
      active.target.yaw -= dx * turn
      active.target.pitch = THREE.MathUtils.clamp(active.target.pitch + dy * turn, -1.2, 1.4)
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const now = Math.hypot(a.x - b.x, a.y - b.y)
      if (spread > 0) setZoom((active.target.zoom * now) / spread)
      spread = now
    }
  })
  const release = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    if (pointers.size === 0) pressed = 0
    spread = 0
  }
  viewer.addEventListener('pointerup', release)
  viewer.addEventListener('pointercancel', release)
  // Mouse wheel and trackpad pinch on laptops.
  viewer.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      if (active) setZoom(active.target.zoom * Math.exp(-e.deltaY * 0.01))
    },
    { passive: false },
  )
  viewer.addEventListener('dblclick', (e) => {
    if (active && e.target !== back) Object.assign(active.target, start)
  })

  // ---- Drawing -------------------------------------------------------------
  const offset = new THREE.Vector3()
  const lerp = THREE.MathUtils.lerp

  function draw(card: Card, left: number, top: number, width: number, height: number) {
    const { shown, target } = card
    shown.yaw += (target.yaw - shown.yaw) * opts.ease
    shown.pitch += (target.pitch - shown.pitch) * opts.ease
    shown.zoom += (target.zoom - shown.zoom) * opts.ease

    camera.aspect = width / height
    camera.updateProjectionMatrix()
    // Far enough to fit the whole object in the narrower direction of the rectangle.
    const half = THREE.MathUtils.degToRad(opts.fov) / 2
    const fit = Math.min(half, Math.atan(Math.tan(half) * camera.aspect))
    const distance = ((card.radius / Math.sin(fit)) * opts.margin) / shown.zoom
    offset.set(Math.sin(shown.yaw) * Math.cos(shown.pitch), Math.sin(shown.pitch), Math.cos(shown.yaw) * Math.cos(shown.pitch))
    camera.position.copy(card.center).addScaledVector(offset, distance)
    camera.lookAt(card.center)
    camera.updateMatrixWorld()

    for (const other of cards) other.object.visible = other === card
    const bottom = window.innerHeight - top - height
    renderer.setViewport(left, bottom, width, height)
    renderer.setScissor(left, bottom, width, height)
    renderer.render(scene, camera)
  }

  return {
    /** Draws the cards on screen, or the open one. Call once per frame instead of renderer.render. */
    render() {
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      renderer.setScissorTest(false)
      renderer.clear()
      renderer.setScissorTest(true)

      if (active) {
        // Grow from the card's own rectangle to the whole screen (and back when closing).
        grow = lerp(grow, opening ? 1 : 0, opts.ease)
        canvas.style.transform = ''
        excite(active, opening ? pressed : 0)
        const rect = active.view.getBoundingClientRect()
        draw(active, lerp(rect.left, 0, grow), lerp(rect.top, 0, grow), lerp(rect.width, screenWidth, grow), lerp(rect.height, screenHeight, grow))
        if (!opening && grow < 0.01) {
          grow = 0
          active = null
          document.body.classList.remove('viewing')
        }
        return
      }

      // The canvas travels with the page, so cards never lag behind while scrolling.
      canvas.style.transform = `translateY(${window.scrollY}px)`
      for (const card of cards) {
        const rect = card.view.getBoundingClientRect()
        if (rect.bottom <= 0 || rect.top >= screenHeight || rect.width === 0) continue
        draw(card, rect.left, rect.top, rect.width, rect.height)
      }
    },
  }
}
