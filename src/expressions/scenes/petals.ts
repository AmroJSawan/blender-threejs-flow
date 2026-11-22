import * as THREE from 'three'
import { clay, shadowed, type Expression } from '../kit'

const PETALS = 12
const petals: Expression = {
  title: 'Petals',
  note: 'Twelve thin discs in a ring, each leaning on the next like the blades of a camera shutter. They open and close as the ring turns.',
  order: 6,
  stage: 'clay',
  build() {
    const object = new THREE.Group()
    object.rotation.x = -0.35
    const disc = new THREE.CylinderGeometry(0.72, 0.72, 0.05, 64).rotateX(Math.PI / 2) // facing the viewer
    const blades = Array.from({ length: PETALS }, (_, index) => {
      const arm = new THREE.Group()
      arm.rotation.z = (index / PETALS) * Math.PI * 2
      const blade = new THREE.Mesh(disc, clay(0.76))
      blade.position.x = 1.15
      arm.add(blade)
      object.add(arm)
      return blade
    })
    shadowed(object)
    return {
      object,
      update(time) {
        const lean = 0.8 + 0.28 * Math.sin(time * 0.9) // how far each disc leans over its neighbour
        blades.forEach((blade) => (blade.rotation.x = lean))
        object.rotation.z = time * 0.3
      },
    }
  },
}
export default petals
