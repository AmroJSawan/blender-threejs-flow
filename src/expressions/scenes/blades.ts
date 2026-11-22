import * as THREE from 'three'
import { arcSlab, clay, shadowed, type Expression } from '../kit'

const blades: Expression = {
  title: 'Blades',
  note: 'Three thin curved plates turning round a sphere, drifting in and out as they go, like a slow turbine.',
  order: 8,
  stage: 'clay',
  build() {
    const object = new THREE.Group()
    object.rotation.set(-0.75, 0.25, 0)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 32), clay(0.62))
    const plate = arcSlab(2.0, 2.09, 0.85, 1.25)
    const plates = [0, 1, 2].map((index) => {
      const arm = new THREE.Group()
      const mesh = new THREE.Mesh(plate, clay(0.78))
      arm.add(mesh)
      object.add(arm)
      return { arm, mesh, index }
    })
    shadowed(object.add(ball))
    return {
      object,
      update(time) {
        for (const { arm, mesh, index } of plates) {
          arm.rotation.z = time * 0.6 + (index * Math.PI * 2) / 3
          mesh.position.x = -0.35 + 0.45 * Math.sin(time * 0.9 + index * 2.1) // in toward the sphere and out again
          mesh.rotation.x = 0.25 * Math.sin(time * 0.7 + index)
        }
      },
    }
  },
}
export default blades
