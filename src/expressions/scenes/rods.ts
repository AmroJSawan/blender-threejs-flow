import * as THREE from 'three'
import { ember, type Expression } from '../kit'

const RODS = 7
const LONG = 5.0
const RED = new THREE.Color('#ff1a12')
const AMBER = new THREE.Color('#ff9a2e')
const GOLD = new THREE.Color('#ffd070')
const rods: Expression = {
  title: 'Rods',
  note: 'Seven thick rods pointing in at an empty middle, their near ends tipped toward you. The ring turns in slow surges; the rods breathe in and out one after another, and their glow warms from red through amber to gold and cools again, travelling round the ring.',
  order: 11,
  stage: 'ember',
  build() {
    const object = new THREE.Group()
    const shape = new THREE.CylinderGeometry(0.68, 0.68, LONG, 64).rotateZ(-Math.PI / 2) // lying along its arm, pointing outward
    const made = Array.from({ length: RODS }, (_, index) => {
      const arm = new THREE.Group()
      arm.rotation.z = (index / RODS) * Math.PI * 2
      const material = ember({ hot: AMBER, warm: RED, axis: 'x', from: -LONG / 2, to: LONG * 0.3, body: 0.014 })
      const rod = new THREE.Mesh(shape, material)
      const lift = new THREE.Group() // tips the near end toward the viewer, so its round face shows
      lift.rotation.y = 0.62
      lift.add(rod)
      arm.add(lift)
      object.add(arm)
      return { rod, material, phase: (index / RODS) * Math.PI * 2 }
    })
    const colour = new THREE.Color()
    return {
      object,
      update(time) {
        object.rotation.z = -(time * 0.16 + 0.22 * Math.sin(time * 0.8)) // clockwise, in slow surges
        for (const { rod, material, phase } of made) {
          rod.position.x = 1.25 + LONG / 2 + 0.38 * Math.sin(time * 1.1 + phase * 2) // in toward the middle and out again, each in turn
          const warmth = 0.5 + 0.5 * Math.sin(time * 0.75 + phase)                   // 0 red … 1 gold, travelling round the ring
          colour.copy(RED).lerp(AMBER, Math.min(warmth * 2, 1)).lerp(GOLD, Math.max(warmth * 2 - 1, 0))
          material.uniforms.uHot.value.copy(colour)
          material.uniforms.uWarm.value.copy(RED).lerp(AMBER, warmth * 0.6)
          material.uniforms.uTo.value = LONG * (0.05 + 0.4 * warmth)                 // the hotter a rod, the further along it the glow reaches
        }
      },
    }
  },
}
export default rods
