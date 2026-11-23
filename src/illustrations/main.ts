import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import '../switch/switch.css'
import './illustrations.css'
import scenes from './scenes.json'

/** The control panel of the illustrations page. The geometry itself is set in blender/make_illustration.py. */
const settings = {
  /** Shown first, unless the address says ?variant=name. */
  start: 'plan',
  /** The board the scene sits on, and each part's colour by its material name in Blender. `lit: false` parts glow evenly. */
  backdrop: '#0b0d10',
  parts: {
    Ground: { colour: '#14171b', lit: true },
    Rule: { colour: '#252a31', lit: false },
    Plate: { colour: '#2a2f37', lit: true },
    Solid: { colour: '#c4cad3', lit: true },
    Line: { colour: '#66707d', lit: false },
    Accent: { colour: '#49e6c6', lit: false },
  } as Record<string, { colour: string; lit: boolean }>,
  /** Wire view: surfaces go dark and every edge of the plates and solids is drawn, to show how they are built. */
  wire: { surface: '#101317', edge: '#aab2bd', parts: ['Plate', 'Solid'] },
  /** The view: true isometric, seen from the hub's corner. `margin` is the empty share of the window round the scene. */
  margin: 0.12,
  /** Pixels at the top and bottom of the window kept clear of the scene, for the labels. */
  clear: { top: 60, bottom: 130 },
  /** The lamp: where it stands relative to the scene (x right, y up, z toward the hub), its strength, and the even light from all round. */
  lamp: { from: [-0.9, 1, 0.25] as [number, number, number], power: 3, around: 0.6 },
  /** Milliseconds one variant takes to fade out before the next fades in (matches the CSS). */
  swap: 300,
  maxPixelRatio: 2,
}

const illustration = scenes[0]
type Variant = (typeof illustration.variants)[number]
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const note = document.querySelector<HTMLElement>('#note')!
const values = document.querySelector<HTMLElement>('#values')!
// ?keep leaves the drawn picture readable afterwards, for saving a still of the page.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: new URLSearchParams(location.search).has('keep') })
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
const scene = new THREE.Scene()
scene.background = new THREE.Color(settings.backdrop)
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
const lamp = new THREE.DirectionalLight(0xffffff, settings.lamp.power)
lamp.castShadow = true
lamp.shadow.mapSize.set(2048, 2048)
lamp.shadow.radius = 5
lamp.shadow.bias = -0.0008
scene.add(lamp, lamp.target, new THREE.HemisphereLight(0xffffff, 0x30343a, settings.lamp.around))

// One material per part, shared by every variant.
const materials = new Map<string, THREE.Material>()
for (const [name, part] of Object.entries(settings.parts)) {
  materials.set(name, part.lit ? new THREE.MeshLambertMaterial({ color: part.colour }) : new THREE.MeshBasicMaterial({ color: part.colour }))
}
const wireSurface = new THREE.MeshBasicMaterial({ color: settings.wire.surface, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
const wireEdge = new THREE.LineBasicMaterial({ color: settings.wire.edge })

type Shown = { object: THREE.Group; box: THREE.Box3; solid: () => void; wire: () => void }
const loader = new GLTFLoader()
const loaded = new Map<string, Promise<Shown>>()
function load(variant: Variant): Promise<Shown> {
  let waiting = loaded.get(variant.name)
  if (!waiting) {
    waiting = loader.loadAsync(`${import.meta.env.BASE_URL}illustrations/${illustration.name}/${variant.name}.glb?v=${variant.version}`).then((file) => {
      const object = file.scene
      const meshes: { mesh: THREE.Mesh; part: string; edges?: THREE.LineSegments }[] = []
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const part = (child.material as THREE.Material).name
        child.material = materials.get(part) ?? materials.get('Solid')!
        child.castShadow = part === 'Plate' || part === 'Solid'
        child.receiveShadow = part === 'Ground' || part === 'Plate' || part === 'Solid'
        meshes.push({ mesh: child, part })
      })
      for (const entry of meshes) {
        if (!settings.wire.parts.includes(entry.part)) continue
        entry.edges = new THREE.LineSegments(new THREE.EdgesGeometry(entry.mesh.geometry, 1), wireEdge)
        entry.edges.visible = false
        entry.mesh.add(entry.edges)
      }
      const set = (wire: boolean) => {
        for (const { mesh, part, edges } of meshes) {
          if (edges) edges.visible = wire
          if (settings.wire.parts.includes(part)) mesh.material = wire ? wireSurface : materials.get(part)!
        }
      }
      return { object, box: new THREE.Box3().setFromObject(object), solid: () => set(false), wire: () => set(true) }
    })
    loaded.set(variant.name, waiting)
  }
  return waiting
}

// ---- The view ---------------------------------------------------------------
/** Points the camera at the scene from the hub's corner at the isometric angle, and sizes the view to hold all of it. */
function frameScene(box: THREE.Box3) {
  const centre = box.getCenter(new THREE.Vector3())
  const reach = box.getSize(new THREE.Vector3()).length()
  camera.position.copy(centre).add(new THREE.Vector3(-1, 1, 1).normalize().multiplyScalar(reach))
  camera.lookAt(centre)
  camera.updateMatrixWorld()
  // Measure the scene as the camera sees it: its eight corners, in the camera's own space.
  const seen = new THREE.Box3()
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) seen.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse))
  const aspect = innerWidth / innerHeight
  const room = Math.max(innerHeight - settings.clear.top - settings.clear.bottom, 100) / innerHeight // the share of the window's height the scene may use
  const half = Math.max((seen.max.x - seen.min.x) / 2 / aspect, (seen.max.y - seen.min.y) / 2 / room) / (1 - settings.margin)
  const middle = (seen.max.y + seen.min.y) / 2 - ((settings.clear.bottom - settings.clear.top) / innerHeight) * half
  Object.assign(camera, { left: -half * aspect, right: half * aspect, top: middle + half, bottom: middle - half, near: 0.1, far: reach * 3 })
  camera.updateProjectionMatrix()
  // The lamp, and the square of ground its shadows cover.
  lamp.target.position.copy(centre)
  lamp.position.copy(centre).add(new THREE.Vector3(...settings.lamp.from).normalize().multiplyScalar(reach))
  Object.assign(lamp.shadow.camera, { left: -reach / 2, right: reach / 2, top: reach / 2, bottom: -reach / 2, near: 0.1, far: reach * 2 })
  lamp.shadow.camera.updateProjectionMatrix()
}

// ---- Choosing a variant and a view ------------------------------------------
const first = illustration.variants[0]
const tabs = new Map<string, HTMLButtonElement>()
let current: Shown | undefined
let wanted = first
let wire = new URLSearchParams(location.search).get('view') === 'wire'

function draw() {
  if (!current) return
  if (wire) current.wire()
  else current.solid()
  renderer.render(scene, camera)
}
async function show(name: string) {
  const variant = illustration.variants.find((entry) => entry.name === name) ?? first
  wanted = variant
  for (const [key, tab] of tabs) tab.setAttribute('aria-pressed', String(key === variant.name))
  // The numbers this variant was made from; the ones that differ from the first variant are marked.
  values.replaceChildren(
    ...illustration.parameters.flatMap(({ name: key, about }) => {
      const value = (variant.values as Record<string, number>)[key]
      const term = document.createElement('dt')
      const figure = document.createElement('dd')
      term.textContent = key
      term.title = figure.title = about
      figure.textContent = String(value)
      if (value !== (first.values as Record<string, number>)[key]) term.className = figure.className = 'changed'
      return [term, figure]
    }),
  )
  const address = new URL(location.href)
  address.searchParams.set('variant', variant.name)
  history.replaceState(null, '', address)

  canvas.classList.remove('ready')
  const [shown] = await Promise.all([load(variant), current ? new Promise((done) => setTimeout(done, settings.swap)) : null])
  if (wanted !== variant) return // another one was chosen meanwhile
  if (current) scene.remove(current.object)
  current = shown
  scene.add(shown.object)
  frameScene(shown.box)
  draw()
  canvas.classList.add('ready')
}
function setWire(on: boolean) {
  wire = on
  solidTab.setAttribute('aria-pressed', String(!on))
  wireTab.setAttribute('aria-pressed', String(on))
  const address = new URL(location.href)
  if (on) address.searchParams.set('view', 'wire')
  else address.searchParams.delete('view')
  history.replaceState(null, '', address)
  draw()
}

function button(label: string, act: () => void): HTMLButtonElement {
  const made = document.createElement('button')
  made.type = 'button'
  made.textContent = label
  made.addEventListener('click', act)
  return made
}
const bar = document.createElement('div')
bar.className = 'styles'
bar.setAttribute('role', 'group')
bar.setAttribute('aria-label', 'Variant and view')
for (const variant of illustration.variants) {
  const tab = button(variant.title, () => show(variant.name))
  tabs.set(variant.name, tab)
  bar.append(tab)
}
const rule = document.createElement('span')
rule.className = 'rule'
const solidTab = button('Solid', () => setWire(false))
const wireTab = button('Wire', () => setWire(true))
bar.append(rule, solidTab, wireTab)
document.body.append(bar)
note.textContent = illustration.note
setWire(wire)

function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, settings.maxPixelRatio))
  renderer.setSize(innerWidth, innerHeight, false)
  if (current) frameScene(current.box)
  draw()
}
addEventListener('resize', resize)
resize()
show(new URLSearchParams(location.search).get('variant') ?? settings.start)
