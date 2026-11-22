import * as THREE from 'three'
import { clay, shadowed, type Expression } from '../kit'

const DISCS = 14
const RADIUS = 1.9 // of the curve the discs are threaded on
const coil: Expression = {
  title: 'Coil',
  note: 'A row of discs threaded on a curve, like a spring toy caught mid-step. The curve tightens and relaxes, and the discs fan with it.',
  order: 7,
  stage: 'clay',
  build() {
    const object = new THREE.Group()
    object.rotation.set(-0.5, 0.45, 0)
    const disc = new THREE.CylinderGeometry(0.85, 0.85, 0.05, 64) // its axis runs along the curve
    const arms = Array.from({ length: DISCS }, (_, index) => {
      const arm = new THREE.Group()
      const mesh = new THREE.Mesh(disc, clay(0.74))
      mesh.position.x = RADIUS
      mesh.scale.setScalar(0.62 + 0.38 * (index / (DISCS - 1)))
      arm.add(mesh)
      object.add(arm)
      return arm
    })
    object.position.set(-0.4, -0.3, 0)
    shadowed(object)
    return {
      object,
      update(time) {
        const span = 1.9 + 0.75 * Math.sin(time * 0.8) // how far round the curve the row reaches, radians
        arms.forEach((arm, index) => (arm.rotation.z = 0.9 + time * 0.25 + (index / (DISCS - 1)) * span))
      },
    }
  },
}
export default coil
