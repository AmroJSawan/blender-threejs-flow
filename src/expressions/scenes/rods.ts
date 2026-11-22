import * as THREE from 'three'
import { ember, keyed, type Expression } from '../kit'

/**
 * The motion below is read off the reference clip frame by frame (it lasts 1.52 s there).
 * Every list is [seconds, value]. The clip then cuts away; here it rests for REST seconds and starts again.
 */
const PACE = 1            // 1 = the reference's own speed; 0.5 = half speed
const REST = 0.5          // seconds it carries on turning after the last pose before it starts again
const LENGTH = 1.52
const LONG = 5.0
const THICK = 0.56
const TILT = 0.28          // how far a rod leans back from the way the ring is turning: radians of lean per radian-a-second of turning
const LEAN_MOST = 0.6      // the most it may lean, radians
const SPRING = 8           // how quickly a rod leans over and stands straight again: higher = quicker
const GAP = 1.75          // how far each rod's near end stands from the middle: wide enough that the seven ends do not touch
const RED = new THREE.Color('#ff1a12')
const AMBER = new THREE.Color('#ff8a22')
const GOLD = new THREE.Color('#ffd66a')

/** The ring's turn, degrees: it swings quickly clockwise into place, holds, then winds slowly back the other way. */
const TURN: [number, number][] = [[0, 20], [0.08, 9], [0.16, 3], [0.24, 0], [0.9, 0], [1.04, 4], [1.2, 12], [1.36, 22], [1.52, 32], [2.02, 62]]
/** The view starts close and settles back within the first third of a second. */
const ZOOM: [number, number][] = [[0, 1.28], [0.16, 1.08], [0.3, 1], [1.52, 0.96], [2.02, 0.95]]
/** How settled the rods are: at the start each is a few degrees out of place (0), then they fall into even spacing (1). */
const SETTLE: [number, number][] = [[0, 0], [0.3, 1]]
/** The glow of the whole ring: red, warming to gold at about 0.8 s, and back to red. */
const WARMTH: [number, number][] = [[-0.5, 0], [0, 0.15], [0.3, 0.45], [0.6, 0.85], [0.8, 1], [1, 0.9], [1.2, 0.6], [1.52, 0.15], [2.1, 0]]
/**
 * Each rod, anticlockwise from the one pointing right: how many seconds ahead of the ring its glow runs,
 * how far along itself the glow reaches (0 = just the near end, 1 = all of it), and how far out of place
 * it starts, degrees.
 */
const RODS: { lead: number; reach: number; astray: number }[] = [
  { lead: 0, reach: 0.8, astray: 11 },
  { lead: 0.05, reach: 1, astray: -5 },
  { lead: -0.05, reach: 0.3, astray: -6 },
  { lead: 0.2, reach: 0.85, astray: 2 },
  { lead: 0.45, reach: 1, astray: 1 },
  { lead: 0.25, reach: 0.75, astray: 4 },
  { lead: -0.15, reach: 0.3, astray: -2 },
]
const FIRST = 15 // where the first rod points once settled, degrees

const rods: Expression = {
  title: 'Rods',
  note: 'Seven rods pointing in at an empty middle, their near ends tipped toward you. The ring swings into place, holds, and winds slowly back, each rod leaning away from the turn and standing straight when it holds, while the glow warms from red to gold and cools again, some rods ahead of the others.',
  order: 11,
  stage: 'ember',
  build() {
    const object = new THREE.Group()
    const shape = new THREE.CylinderGeometry(THICK, THICK, LONG, 64).rotateZ(-Math.PI / 2) // lying along its arm, pointing outward
    const made = RODS.map((rod) => {
      const arm = new THREE.Group()
      const material = ember({ hot: AMBER, warm: RED, axis: 'x', from: -LONG / 2, to: LONG * 0.3, body: 0.014 })
      const mesh = new THREE.Mesh(shape, material)
      mesh.position.x = LONG / 2
      const hinge = new THREE.Group() // at the rod's near end: the rod stays straight and leans about this point
      hinge.position.x = GAP
      hinge.add(mesh)
      const lift = new THREE.Group() // tips the near end toward the viewer, so its round face shows
      lift.rotation.y = 0.62
      lift.add(hinge)
      arm.add(lift)
      object.add(arm)
      return { arm, hinge, material, lean: 0, ...rod }
    })
    const colour = new THREE.Color()
    let before = { time: 0, at: 0 }
    return {
      object,
      update(time) {
        const at = (time * PACE) % (LENGTH + REST)
        const turn = keyed(at, TURN)
        const loose = 1 - keyed(at, SETTLE)
        const dt = Math.min(Math.max(time - before.time, 0), 0.05)
        const restarted = at < before.at // the clip has started again: the jump back is a cut, not a movement
        before = { time, at }
        object.scale.setScalar(keyed(at, ZOOM))
        const spin = THREE.MathUtils.degToRad(keyed(at + 0.02, TURN) - keyed(at - 0.02, TURN)) / 0.04 // how fast the ring is turning, radians a second
        const settling = (keyed(at - 0.02, SETTLE) - keyed(at + 0.02, SETTLE)) / 0.04
        made.forEach((rod, index) => {
          const { arm, hinge, material, lead, reach, astray } = rod
          arm.rotation.z = THREE.MathUtils.degToRad(FIRST + (index * 360) / RODS.length + turn + astray * loose)
          // A rod leans back from the way it is being carried, its far end trailing, and stands straight when the ring holds.
          const speed = spin + THREE.MathUtils.degToRad(astray) * settling
          const wanted = THREE.MathUtils.clamp(-speed * TILT, -LEAN_MOST, LEAN_MOST)
          rod.lean = restarted || dt === 0 ? wanted : rod.lean + (wanted - rod.lean) * Math.min(dt * SPRING, 1)
          hinge.rotation.z = rod.lean
          const warmth = keyed(at + lead, WARMTH) // 0 red … 1 gold
          colour.copy(RED).lerp(AMBER, Math.min(warmth * 2, 1)).lerp(GOLD, Math.max(warmth * 2 - 1, 0))
          material.uniforms.uHot.value.copy(colour)
          material.uniforms.uWarm.value.copy(RED).lerp(AMBER, warmth * 0.7)
          material.uniforms.uTo.value = -LONG / 2 + LONG * reach * (0.75 + 0.35 * warmth) // the hotter, the further the glow reaches
        })
      },
    }
  },
}
export default rods
