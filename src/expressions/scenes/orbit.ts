import * as THREE from 'three'
import { band, ember, type Expression } from '../kit'

const PLANET = 4.2
const orbit: Expression = {
  title: 'Orbit',
  note: 'A ring of molten light round a dark planet, with small dark moons riding it and one glowing red moon above.',
  order: 10,
  stage: 'ember',
  build() {
    const object = new THREE.Group()
    const system = new THREE.Group()
    system.position.set(0, -4.9, 0)
    const dark = () => ember({ hot: '#000', from: 1e3, to: 1e4, body: 0.012 })
    const planet = new THREE.Mesh(new THREE.SphereGeometry(PLANET, 96, 64), dark())
    // The ring: three bands of light lying in the planet's equator plane.
    // Its plane leans toward the viewer, so the ring's top crosses in front of the planet just under the horizon.
    const plane = new THREE.Group()
    plane.rotation.set(0.5, 0, -0.14)
    const ring = new THREE.Group()
    ring.add(
      band({ inner: PLANET + 0.05, outer: PLANET + 0.55, bright: '#ffb26b', faint: '#ff3a1a', power: 1.3 }),
      band({ inner: PLANET + 0.5, outer: PLANET + 0.9, bright: '#ff6a3a', faint: '#c01008', power: 1.0, side: -1 }),
      band({ inner: PLANET + 0.95, outer: PLANET + 1.15, bright: '#ffd9a0', faint: '#ff5a1a', power: 0.7 }),
    )
    const moons = [0.2, 0.14, 0.24].map((size, index) => {
      const arm = new THREE.Group()
      const moon = new THREE.Mesh(new THREE.SphereGeometry(size, 32, 24), dark())
      moon.position.set(PLANET + 0.3 + index * 0.33, 0, size * 0.9)
      arm.add(moon)
      plane.add(arm)
      return arm
    })
    plane.add(ring)
    system.add(planet, plane)
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.55, 48, 32), ember({ hot: '#ff3a2a', warm: '#7a0c08', from: -0.55, to: 0.9, body: 0.03 }))
    object.add(system, sun)
    return {
      object,
      update(time) {
        ring.rotation.z = time * 0.2
        moons.forEach((arm, index) => (arm.rotation.z = 1.2 + index * 0.45 + 0.35 * Math.sin(time * (0.22 + index * 0.06) + index))) // they ride back and forth over the top
        sun.position.set(0.1 * Math.sin(time * 0.5), 1.5 + 0.12 * Math.sin(time * 0.8), 0.4)
      },
    }
  },
}
export default orbit
