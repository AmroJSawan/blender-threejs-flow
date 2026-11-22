import * as THREE from 'three'
import { arcSlab, clay, shadowed, type Expression } from '../kit'

/** Each ribbon: inner and outer radius, how far round it runs (radians), its height, and its turning speed. */
const RIBBONS = [
  [0.78, 1.0, 1.25, 0.34, 0.9],
  [1.55, 1.95, 2.5, 0.5, -0.55],
  [2.7, 3.2, 2.1, 0.7, 0.35],
]
const ribbons: Expression = {
  title: 'Ribbons',
  note: 'Curved walls of matt clay circling a small sphere at different distances and speeds, throwing soft shadows on each other.',
  order: 5,
  stage: 'clay',
  build() {
    const object = new THREE.Group()
    object.rotation.set(-0.95, 0.2, 0) // seen from above, at an angle
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 48, 32), clay(0.42))
    const walls = RIBBONS.map(([inner, outer, angle, tall], index) => {
      const wall = new THREE.Mesh(arcSlab(inner, outer, angle, tall), clay(0.74))
      wall.rotation.z = index * 2.2
      return wall
    })
    shadowed(object.add(ball, ...walls))
    return {
      object,
      update(time) {
        walls.forEach((wall, index) => (wall.rotation.z = index * 2.2 + time * RIBBONS[index][4]))
        object.rotation.y = 0.2 + 0.12 * Math.sin(time * 0.4)
      },
    }
  },
}
export default ribbons
