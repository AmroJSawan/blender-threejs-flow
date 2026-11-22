import * as THREE from 'three'
import { band, type Expression } from '../kit'

const ARCS = 16
const crest: Expression = {
  title: 'Crest',
  note: 'A feathered sweep of blue light, like the crest of a wave seen from inside, turning slowly round the dark.',
  order: 2,
  stage: 'light',
  build() {
    const object = new THREE.Group()
    const sweep = new THREE.Group()
    object.add(sweep)
    const arcs = Array.from({ length: ARCS }, (_, index) => {
      const share = index / (ARCS - 1)
      const inner = 1.7 + share * 2.4
      // Each arc starts a little later than the one inside it, so the ends fan out like feathers.
      const arc = band({ inner, outer: inner + 0.6, start: index * 0.07, length: Math.PI * (0.95 - 0.35 * share), bright: '#9db2ff', faint: '#0a14ff', power: 0.6 })
      arc.rotation.set(0.12 * Math.sin(index * 1.3), 0.12 * Math.cos(index * 1.9), 0)
      sweep.add(arc)
      return arc
    })
    return {
      object,
      update(time) {
        sweep.rotation.z = time * 0.45
        arcs.forEach((arc, index) => (arc.rotation.z = 0.25 * Math.sin(time * 0.7 + index * 0.35))) // the feathers spread and close
      },
    }
  },
}
export default crest
