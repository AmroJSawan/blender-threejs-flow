import * as THREE from 'three'
import { clay, shadowed, type Expression } from '../kit'

const DISCS = 12
const coil: Expression = {
  title: 'Coil',
  note: 'The same twelve discs as Petals. The ring breaks at one point and gathers into a tight fan, like a hand of cards being closed, then spreads back into a ring.',
  order: 7,
  stage: 'clay',
  build() {
    const object = new THREE.Group()
    object.rotation.x = -0.35
    const disc = new THREE.CylinderGeometry(0.78, 0.78, 0.05, 64).rotateX(Math.PI / 2) // facing the viewer
    const made = Array.from({ length: DISCS }, () => {
      const arm = new THREE.Group()
      const blade = new THREE.Mesh(disc, clay(0.76))
      arm.add(blade)
      object.add(arm)
      return { arm, blade }
    })
    shadowed(object)
    return {
      object,
      update(time) {
        const cycle = 0.5 - 0.5 * Math.cos(time * 0.9)         // 0 = open ring … 1 = gathered fan
        const gather = cycle * cycle * (3 - 2 * cycle)
        const span = THREE.MathUtils.lerp(Math.PI * 2 * (1 - 1 / DISCS), 2.7, gather) // how far round the discs reach, radians
        const radius = THREE.MathUtils.lerp(1.2, 1.75, gather)   // the fan sits on a wider curve than the ring
        const lean = THREE.MathUtils.lerp(0.85, 1.08, gather)    // and its discs lean further over
        made.forEach(({ arm, blade }, index) => {
          arm.rotation.z = 2.6 + (index / (DISCS - 1) - 0.5) * span + time * 0.18
          blade.position.x = radius
          blade.rotation.x = lean
        })
        object.position.set(0.5 * gather, 0.2 * gather, 0)       // keeps the fan in the middle of the view
      },
    }
  },
}
export default coil
