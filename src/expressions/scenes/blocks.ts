import * as THREE from 'three'
import { clay, shadowed, type Expression } from '../kit'

/**
 * The slabs, seen from above: centre x, y; size x, y; height; and the direction and distance each slides.
 * Together they leave a small square court in the middle, where the sphere sits.
 */
const SLABS: [number, number, number, number, number, [number, number], number][] = [
  [-1.5, 4.4, 9.0, 3.2, 1.3, [1, 0], 0.7],   // across the top
  [3.1, 2.1, 4.2, 1.9, 1.7, [0, 1], 0.35],   // upper right
  [4.0, -0.4, 3.2, 2.9, 1.1, [1, 0], 0.45],  // right
  [-4.0, 0.5, 4.6, 2.6, 1.5, [1, 0], 0.3],   // left …
  [-2.15, -0.45, 1.5, 1.6, 1.5, [1, 0], 0.3], // … and its step toward the court
  [0.9, -3.0, 9.5, 2.2, 0.9, [-1, 0], 0.9],  // below
  [-0.5, -5.9, 12.0, 3.2, 1.6, [1, 0], 0.5], // across the bottom
]
const blocks: Expression = {
  title: 'Blocks',
  note: 'A close view down onto great slabs set round a small square court with a sphere in it. The slabs slide past each other, opening and narrowing the court, as the whole view slowly turns.',
  order: 9,
  stage: 'clay',
  build() {
    const object = new THREE.Group()
    object.rotation.x = -0.32 // not quite straight down, so the slabs' sides show
    const yard = new THREE.Group()
    object.add(yard)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), clay(0.4))
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 64, 48), clay(0.86))
    const slabs = SLABS.map(([x, y, wide, deep, tall, slide, far], index) => {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(wide, deep, tall), clay(0.7 + 0.05 * (index % 3)))
      return { slab, x, y, tall, slide, far, index }
    })
    shadowed(yard.add(floor, ball, ...slabs.map(({ slab }) => slab)))
    return {
      object,
      update(time) {
        for (const { slab, x, y, tall, slide, far, index } of slabs) {
          const along = Math.sin(time * 0.45 + index * 1.3) * far
          slab.position.set(x + slide[0] * along, y + slide[1] * along, tall / 2)
        }
        ball.position.set(0.25, 0.1, 0.55 + 0.12 * Math.sin(time * 0.8))
        yard.rotation.z = -0.42 + 0.14 * Math.sin(time * 0.22)
      },
    }
  },
}
export default blocks
