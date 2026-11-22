import * as THREE from 'three'
import { clay, shadowed, type Expression } from '../kit'

const BLOCKS = 6
const blocks: Expression = {
  title: 'Blocks',
  note: 'Six slabs set like a pinwheel round a sphere, sliding in until they almost close over it and out again.',
  order: 9,
  stage: 'clay',
  build() {
    const object = new THREE.Group()
    object.rotation.set(-0.6, 0, 0.45)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 48, 32), clay(0.86))
    const slab = new THREE.BoxGeometry(1.5, 3.6, 1.1)
    const arms = Array.from({ length: BLOCKS }, (_, index) => {
      const arm = new THREE.Group()
      arm.rotation.z = (index / BLOCKS) * Math.PI * 2
      const mesh = new THREE.Mesh(slab, clay(0.7 + 0.04 * (index % 3)))
      mesh.position.y = 1.0 // set off to one side of its arm, which makes the pinwheel
      mesh.position.z = 0.12 * (index % 2) // alternate slabs stand a little higher
      arm.add(mesh)
      object.add(arm)
      return mesh
    })
    shadowed(object.add(ball))
    return {
      object,
      update(time) {
        arms.forEach((mesh, index) => (mesh.position.x = 1.75 + 0.55 * Math.sin(time * 0.8 + index * 0.5)))
        object.rotation.z = 0.45 + time * 0.12
      },
    }
  },
}
export default blocks
