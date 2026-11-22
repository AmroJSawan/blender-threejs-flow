import * as THREE from 'three'
import { band, type Expression } from '../kit'

const ARCS = 8
const vortex: Expression = {
  title: 'Vortex',
  note: 'Two fans of violet crescents with peach edges, turning round each other like the halves of a whirlpool.',
  order: 3,
  stage: 'light',
  build() {
    const object = new THREE.Group()
    const fans = [1, -1].map((side) => {
      const fan = new THREE.Group()
      fan.position.set(-0.85 * side, -1.15 * side, 0)
      const arcs = Array.from({ length: ARCS }, (_, index) => {
        const inner = 0.4 + index * 0.34
        const arc = band({ inner, outer: inner + 0.62, length: Math.PI * 0.95, bright: '#ffb08c', faint: '#8a1cff', power: 0.6, side: -1 })
        fan.add(arc)
        return arc
      })
      object.add(fan)
      return { fan, arcs, side }
    })
    return {
      object,
      update(time) {
        object.rotation.z = time * 0.3
        for (const { arcs, side } of fans) {
          arcs.forEach((arc, index) => (arc.rotation.z = (side > 0 ? 0 : Math.PI) + time * 0.5 + index * 0.16 + 0.3 * Math.sin(time * 0.8 + index * 0.5)))
        }
      },
    }
  },
}
export default vortex
