import * as THREE from 'three'
import { ember, type Expression } from '../kit'

const RODS = 7
const LONG = 4.2
const RED = new THREE.Color('#ff2218')
const AMBER = new THREE.Color('#ffb04a')
const rods: Expression = {
  title: 'Rods',
  note: 'Seven rods pointing in at an empty middle, their near ends glowing from red through to amber and cooling to black along their length. The ring turns and the colours travel round it.',
  order: 11,
  stage: 'ember',
  build() {
    const object = new THREE.Group()
    const shape = new THREE.CylinderGeometry(0.52, 0.52, LONG, 64).rotateZ(-Math.PI / 2) // lying along its arm, pointing outward
    const made = Array.from({ length: RODS }, (_, index) => {
      const arm = new THREE.Group()
      arm.rotation.z = (index / RODS) * Math.PI * 2
      const material = ember({ hot: AMBER, warm: RED, axis: 'x', from: -LONG / 2, to: LONG * 0.28, body: 0.014 })
      const rod = new THREE.Mesh(shape, material)
      rod.position.set(1.15 + LONG / 2, 0, 0)
      const lift = new THREE.Group() // tips the near end toward the viewer
      lift.rotation.y = 0.5
      lift.add(rod)
      arm.add(lift)
      object.add(arm)
      return material
    })
    return {
      object,
      update(time) {
        object.rotation.z = time * 0.22
        made.forEach((material, index) => {
          const warmth = 0.5 + 0.5 * Math.sin(time * 0.6 + (index / RODS) * Math.PI * 2) // red … amber, travelling round the ring
          material.uniforms.uHot.value.copy(RED).lerp(AMBER, warmth)
        })
      },
    }
  },
}
export default rods
