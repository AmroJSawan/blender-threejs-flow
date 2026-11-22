import * as THREE from 'three'
import { ember, type Expression } from '../kit'

const monolith: Expression = {
  title: 'Monolith',
  note: 'The corner of a great block, red hot along its top edge and cooling to black below, under a dark moon. The heat breathes.',
  order: 12,
  stage: 'ember',
  build() {
    const object = new THREE.Group()
    const material = ember({ hot: '#ff1626', warm: '#5a0408', from: 3.0, to: -0.4, body: 0.012 })
    const block = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), material)
    block.position.y = -3.4
    block.rotation.y = Math.PI / 4 // one corner faces the viewer
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.85, 64, 48), ember({ hot: '#000', from: 1e3, to: 1e4, body: 0.03 }))
    object.add(block, moon)
    object.rotation.x = -0.1 // seen from slightly below, so the top edges slope down and away to each side
    return {
      object,
      update(time) {
        material.uniforms.uHeat.value = 0.86 + 0.14 * Math.sin(time * 0.9)
        block.rotation.y = Math.PI / 4 + 0.1 * Math.sin(time * 0.3)
        moon.position.set(0.25 * Math.sin(time * 0.35), 2.2 + 0.1 * Math.sin(time * 0.6), 0)
      },
    }
  },
}
export default monolith
