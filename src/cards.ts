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
  /** The card's own picture. The 3D canvas renders the object, then the frame is copied here. */
  preview: HTMLCanvasElement
  paint: CanvasRenderingContext2D
  onScreen: boolean
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
 *
 * How it draws: each preview is an ordinary 2D canvas inside its card, so it scrolls with the
 * page like an image and can never lag behind. The single 3D canvas stays hidden, renders the
 * cards that are on screen one after another, and each frame is copied into its preview.
 * Only the full-screen viewer shows the 3D canvas itself.
 */
export function createCards(stage: Stage, shaders: { setResolution(width: number, height: number): void }) {
  const opts = config.cards
  const { renderer, scene } = stage
  const canvas = renderer.domElement
  const list = document.querySelector<HTMLElement>('#scroll')!
  const camera = new THREE.PerspectiveCamera(opts.fov, 1, 0.05, 500)
  const start: View = { yaw: 0, pitch: THREE.MathUtils.degToRad(opts.pitch), zoom: 1 }
  const [minZoom, maxZoom] = opts.zoom
  const halfFov = THREE.MathUtils.degToRad(opts.fov) / 2
  document.body.classList.add('cards')
  stage.followWindow(false) // this module sizes the 3D canvas: preview size in the list, full screen in the viewer

  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag)
    node.className = className
    node.textContent = text
    return node
  }

  if (opts.hint) list.append(element('p', 'cards-hint', opts.hint))

  // ---- The list of cards -------------------------------------------------
  const cards: Card[] = []
  const byPreview = new Map<Element, Card>()
  const visibility = new IntersectionObserver((entries) => {
    for (const entry of entries) byPreview.get(entry.target)!.onScreen = entry.isIntersecting
  })

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
      if (o instanceof THREE.Mesh && !o.userData.underlay) box.expandByObject(o)
    })
    const sphere = box.getBoundingSphere(new THREE.Sphere())

    const title = object.name.replace(/_/g, ' ')
    const article = element('article', 'card')
    article.tabIndex = 0
    article.setAttribute('role', 'button')
    article.setAttribute('aria-label', `Open ${title}`)
    const preview = element('canvas', 'card-view')
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
    article.append(preview, text)
    list.append(article)

    const card: Card = {
      object,
      title,
      preview,
      paint: preview.getContext('2d', { alpha: false })!,
      onScreen: false,
      center: sphere.center,
      radius: sphere.radius,
      target: { ...start },
      shown: { ...start },
    }
    cards.push(card)
    byPreview.set(preview, card)
    visibility.observe(preview)
    article.addEventListener('click', () => open(card))
    article.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        open(card)
      }
    })
  }

  // Sizes are measured here, on resize, never inside the frame loop.
  const size = { preview: 1, width: 1, height: 1 }
  function measure() {
    size.width = window.innerWidth
    size.height = window.innerHeight
    size.preview = cards[0]?.preview.clientWidth || 1
    const pixels = Math.round(size.preview * renderer.getPixelRatio())
    for (const { preview } of cards) preview.width = preview.height = pixels // previews are square
  }
  stage.onResize(measure)

  /** Resizes the 3D canvas only when the size really changes. */
  const drawingSize = new THREE.Vector2()
  function setDrawingSize(width: number, height: number) {
    renderer.getSize(drawingSize)
    if (drawingSize.x !== width || drawingSize.y !== height) renderer.setSize(width, height)
  }

  // ---- The full-screen viewer --------------------------------------------
  const viewer = element('div', 'viewer')
  viewer.hidden = true
  const back = element('button', 'viewer-back', '← Back')
  back.type = 'button'
  const heading = element('h2', 'viewer-title')
  viewer.append(back, heading, element('p', 'viewer-hint', opts.viewerHint))
  document.body.append(viewer)

  let active: Card | null = null
  let opening = false // true while a card is (or is becoming) full screen
  let grow = 0 // 0 = card size, 1 = full screen
  let from = new DOMRect() // where the opened card sits on screen

  function open(card: Card) {
    if (active) return
    active = card
    opening = true
    from = card.preview.getBoundingClientRect()
    heading.textContent = card.title
    viewer.hidden = false
    document.body.classList.add('viewing') // locks page scroll and shows the 3D canvas
    history.pushState({ viewer: true }, '') // so the phone's own Back button closes the viewer
  }
  function close() {
    if (!active || !opening) return
    opening = false
    pressed = false
    pointers.clear()
    viewer.hidden = true
    Object.assign(active.target, start)
  }
  back.addEventListener('click', () => history.back())
  window.addEventListener('popstate', close)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && opening) history.back()
  })

  // Controls exist only on the viewer: one finger rotates, two fingers zoom.
  // Handlers only record what the user wants; the frame loop eases toward it.
  const pointers = new Map<number, { x: number; y: number }>()
  let spread = 0 // distance between two fingers at the last move
  let pressed = false // a finger is down: the object counts as "hovered" for its shader

  function setZoom(zoom: number) {
    if (active) active.target.zoom = THREE.MathUtils.clamp(zoom, minZoom, maxZoom)
  }
  viewer.addEventListener('pointerdown', (e) => {
    if (e.target === back) return
    viewer.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    pressed = true
    spread = 0
  })
  viewer.addEventListener('pointermove', (e) => {
    const last = pointers.get(e.pointerId)
    if (!last || !active) return
    const dx = e.clientX - last.x
    const dy = e.clientY - last.y
    last.x = e.clientX
    last.y = e.clientY
    if (pointers.size === 1) {
      const turn = (opts.dragTurn * Math.PI) / size.width // radians per pixel
      active.target.yaw -= dx * turn
      active.target.pitch = THREE.MathUtils.clamp(active.target.pitch + dy * turn, -1.2, 1.4)
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const now = Math.hypot(a.x - b.x, a.y - b.y)
      if (spread > 0) setZoom((active.target.zoom * now) / spread)
      spread = now
    }
  })
  function release(e: PointerEvent) {
    pointers.delete(e.pointerId)
    pressed = pointers.size > 0
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

  /** Feeds "is being pressed" to the object's shaders as uHover. */
  function excite(card: Card, amount: number) {
    card.object.traverse((o) => {
      const hover = o.userData.hoverAmount as { value: number } | undefined
      if (hover) hover.value += (amount - hover.value) * opts.ease
    })
  }

  // ---- Drawing -------------------------------------------------------------
  const offset = new THREE.Vector3()
  const lerp = THREE.MathUtils.lerp
  let shownCard: Card | null = null // the only card whose object is currently visible

  /** Points the camera at a card's object and makes it the only one drawn. */
  function frame(card: Card, aspect: number) {
    const { shown, target } = card
    shown.yaw += (target.yaw - shown.yaw) * opts.ease
    shown.pitch += (target.pitch - shown.pitch) * opts.ease
    shown.zoom += (target.zoom - shown.zoom) * opts.ease

    if (camera.aspect !== aspect) {
      camera.aspect = aspect
      camera.updateProjectionMatrix()
    }
    // Far enough to fit the whole object in the narrower direction of the picture.
    const fit = Math.min(halfFov, Math.atan(Math.tan(halfFov) * aspect))
    const distance = ((card.radius / Math.sin(fit)) * opts.margin) / shown.zoom
    offset.set(Math.sin(shown.yaw) * Math.cos(shown.pitch), Math.sin(shown.pitch), Math.cos(shown.yaw) * Math.cos(shown.pitch))
    camera.position.copy(card.center).addScaledVector(offset, distance)
    camera.lookAt(card.center)

    if (shownCard !== card) {
      for (const other of cards) other.object.visible = other === card
      shownCard = card
    }
  }

  function drawViewer(card: Card) {
    // Grow from the card's own rectangle to the whole screen (and back when closing).
    grow = lerp(grow, opening ? 1 : 0, opts.ease)
    const left = lerp(from.left, 0, grow)
    const top = lerp(from.top, 0, grow)
    const width = lerp(from.width, size.width, grow)
    const height = lerp(from.height, size.height, grow)

    setDrawingSize(size.width, size.height)
    excite(card, pressed ? 1 : 0)
    frame(card, width / height)
    shaders.setResolution(width, height)
    renderer.setScissorTest(false)
    renderer.clear()
    renderer.setScissorTest(true)
    const bottom = size.height - top - height
    renderer.setViewport(left, bottom, width, height)
    renderer.setScissor(left, bottom, width, height)
    renderer.render(scene, camera)

    if (!opening && grow < 0.01) {
      grow = 0
      active = null
      excite(card, 0)
      document.body.classList.remove('viewing')
    }
  }

  function drawPreviews() {
    setDrawingSize(size.preview, size.preview)
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, size.preview, size.preview)
    shaders.setResolution(size.preview, size.preview)
    for (const card of cards) {
      if (!card.onScreen) continue
      frame(card, 1)
      renderer.render(scene, camera)
      card.paint.drawImage(canvas, 0, 0) // must happen right after render, before the browser presents the frame
    }
  }

  return {
    /** Draws the open card, or the previews that are on screen. Call once per frame instead of renderer.render. */
    render() {
      if (active) drawViewer(active)
      else drawPreviews()
    },
  }
}
