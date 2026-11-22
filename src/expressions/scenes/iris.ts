import * as THREE from 'three'
import { band, type Expression } from '../kit'

/** How many arcs, and the colours they run between (innermost to outermost). */
const ARCS = 16
const VIOLET = new THREE.Color('#6a1cff')
const PEACH = new THREE.Color('#ffb48a')

const iris: Expression = {
  title: 'Iris',
  note: 'Arcs of violet light circling a dark disc, each on its own slightly tilted orbit, warming to peach where they bunch together.',
  order: 1,
  stage: 'light',
  build() {
    const object = new THREE.Group()
    const arcs = Array.from({ length: ARCS }, (_, index) => {
      const share = index / (ARCS - 1)
      const inner = 1.25 + share * 2.3
      const colour = VIOLET.clone().lerp(PEACH, Math.pow(share, 1.3))
      const arc = band({ inner: inner - 0.1, outer: inner + 0.5, length: Math.PI * (1.15 + 0.5 * Math.sin(index * 2.1)), bright: colour, faint: VIOLET, power: 0.6 })
      arc.rotation.set(0.22 * Math.sin(index * 1.7), 0.22 * Math.cos(index * 2.3), 0)
      object.add(arc)
      return arc
    })
    // The dark disc in the middle hides the arcs' inner ends.
    const disc = new THREE.Mesh(new THREE.SphereGeometry(1.32, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }))
    object.add(disc)
    return {
      object,
      update(time) {
        arcs.forEach((arc, index) => (arc.rotation.z = time * (0.35 + 0.05 * (index % 4)) * (index % 2 ? 1 : 0.8) + index * 0.9))
      },
    }
  },
}
export default iris
