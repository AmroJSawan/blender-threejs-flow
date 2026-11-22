import * as THREE from 'three'
import { ember, type Expression } from '../kit'

const SLABS = 4
const zigzag: Expression = {
  title: 'Zigzag',
  note: 'Four slabs stacked like a folding rule, each glowing from one end and dark at the other. The stack folds and unfolds.',
  order: 13,
  stage: 'ember',
  build() {
    const object = new THREE.Group()
    object.rotation.set(0.55, -0.5, 0)
    const shape = new THREE.BoxGeometry(4.0, 0.62, 1.25)
    const hot = ['#ffc04d', '#ff8a2a', '#ff4a1e', '#e0201a']
    const slabs = Array.from({ length: SLABS }, (_, index) => {
      const side = index % 2 ? -1 : 1
      const slab = new THREE.Mesh(shape, ember({ hot: hot[index], warm: '#a01208', axis: 'x', from: 2.0 * side, to: -1.4 * side, body: 0.02 }))
      slab.position.y = 1.35 - index * 0.9
      object.add(slab)
      return { slab, side }
    })
    return {
      object,
      update(time) {
        const fold = 0.62 + 0.3 * Math.sin(time * 0.7) // half the angle between neighbouring slabs, radians
        for (const { slab, side } of slabs) slab.rotation.y = fold * side
        object.rotation.y = -0.5 + 0.25 * Math.sin(time * 0.35)
      },
    }
  },
}
export default zigzag
