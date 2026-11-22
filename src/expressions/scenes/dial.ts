import * as THREE from 'three'
import { keyed, plate, steel, type Expression } from '../kit'

/**
 * A study after "Semantic Restructuring" by Reijo Palmiste, worked out from the clip frame by frame.
 *
 * The mechanism, as read from the reference:
 * - A dial of wedge plates between a hub (with a four-pointed star cut through it) and a notched rim.
 * - The ring of plates turns clockwise the whole time, exactly once per loop (LOOP seconds).
 * - The hub flips right over once a second, showing the black ball it sits on.
 * - Event one (0.3–1.4 s): the plates restructure in place. Narrow ones dip toward the hub, wide ones
 *   roll toward the lamp, one lifts and slides out over the rim, one slides out underneath.
 * - Event two (3.3–4.5 s): the dial leans back, then tumbles right over. Mid-tumble the plates come
 *   apart along its axis and some swing outward; they re-seat one after another like stairs settling.
 * Every list below is [seconds, value].
 */
const LOOP = 6
const RIM = 2.45          // radius of the dial
const HUB = 0.8           // radius of the hub
const THICK = 0.075       // thickness of a plate

/** The plates, as the angles (degrees, anticlockwise from the right) each one runs between at the start of the loop. */
const EDGES = [5, 75, 100, 120, 200, 265, 285, 300, 330, 350, 365]
/**
 * What each plate does, by its place in the list above. dip = tips its inner end down (radians);
 * roll = rolls about its own length; lift = rises off the dial; out = slides outward.
 */
type Move = { dip?: [number, number][]; roll?: [number, number][]; lift?: [number, number][]; out?: [number, number][] }
const MOVES: Move[] = [
  { roll: [[0.45, 0], [0.62, 0.26], [0.85, 0.2], [1.15, 0]] },                                              // wide, top right: rolls toward the lamp
  { lift: [[0.25, 0], [0.5, 0.24], [1.1, 0.24], [1.4, 0]], out: [[0.25, 0], [0.5, 0.3], [1.1, 0.3], [1.4, 0]] }, // narrow: lifts and slides out over the rim
  { lift: [[0.3, 0], [0.55, 0.1], [1.0, 0.1], [1.3, 0]] },
  { roll: [[0.6, 0], [0.78, -0.22], [0.95, -0.14], [1.2, 0]] },                                             // wide, left
  { roll: [[0.52, 0], [0.7, 0.3], [0.9, 0.12], [1.05, 0]] },                                                // wide, lower left: the bright streak
  { lift: [[0.55, 0], [0.7, -0.12], [1.05, -0.12], [1.25, 0]] },
  { dip: [[0.3, 0], [0.46, 0.34], [0.95, 0.3], [1.2, 0]] },                                                 // the three narrow ones dip, one after another
  { dip: [[0.34, 0], [0.5, 0.4], [1.0, 0.34], [1.26, 0]] },
  { dip: [[0.38, 0], [0.54, 0.34], [1.05, 0.28], [1.32, 0]] },
  { out: [[0.45, 0], [0.68, 0.38], [0.85, 0.38], [1.1, 0]], lift: [[0.45, 0], [0.68, -0.14], [0.85, -0.14], [1.1, 0]] }, // slides out under the rim
]
/** Event two. How far the dial leans back before it goes, and its tumble (turns about its level axis). */
const LEAN: [number, number][] = [[3.1, 0], [3.45, 0.42], [3.6, 0.1], [4.4, 0], [6, 0]]
const TUMBLE: [number, number][] = [[3.58, 0], [3.68, 0.07], [3.82, 0.25], [4.0, 0.5], [4.18, 0.75], [4.32, 0.93], [4.42, 1]]
/** How far apart the plates stand along the dial's axis mid-tumble (0 = seated), and how far the outer ones swing out. */
const APART: [number, number][] = [[3.6, 0], [3.84, 1], [4.2, 1], [4.3, 0.75]]
const SWING: [number, number][] = [[3.72, 0], [3.92, 1], [4.12, 1], [4.3, 0]]
const SEATED_BY = 4.3     // the first plate is home by now; each one after lands STAIR seconds later
const STAIR = 0.035
/** The hub's flip: once a second, at this moment in the second, taking this long. */
const FLIP_AT = 0.14
const FLIP_TAKES = 0.14

const ease = (t: number) => t * t * (3 - 2 * t)

const dial: Expression = {
  title: 'Dial',
  note: 'After “Semantic Restructuring” by Reijo Palmiste. A steel dial of wedge plates that turns once per loop. Its hub flips over every second; the plates restructure in place, then the whole dial tumbles, comes apart and re-seats like stairs settling.',
  order: 14,
  stage: 'steel',
  build() {
    const metal = steel()
    const object = new THREE.Group()
    const body = new THREE.Group() // the dial: leans, wobbles and tumbles as one
    object.add(body)
    const ring = new THREE.Group() // the plates and the rim: turns steadily
    body.add(ring)

    // The plates. Each hangs from a chain of joints: turn to its place → slide and lift → dip about its outer edge → roll about its length.
    const plates = MOVES.map((move, index) => {
      const from = THREE.MathUtils.degToRad(EDGES[index])
      const wide = THREE.MathUtils.degToRad(EDGES[index + 1] - EDGES[index])
      const arm = new THREE.Group()
      arm.rotation.z = from + wide / 2
      const slide = new THREE.Group()
      const hinge = new THREE.Group()
      hinge.position.x = RIM - 0.07
      const roll = new THREE.Group()
      roll.position.x = -(RIM - 0.07)
      const mesh = new THREE.Mesh(plate(HUB + 0.16, RIM - 0.07, wide - 0.012, THICK), metal)
      roll.add(mesh)
      hinge.add(roll)
      slide.add(hinge)
      arm.add(slide)
      ring.add(arm)
      // Where it stands mid-tumble: plates alternate above and below, further out the later they are in the list.
      const level = (index % 2 ? 1 : -1) * (0.25 + 0.11 * index)
      return { move, slide, hinge, roll, level, swings: index >= 5 }
    })

    // The rim: eight arcs with small gaps between them.
    for (let index = 0; index < 8; index++) {
      const arc = new THREE.Mesh(plate(RIM, RIM + 0.07, Math.PI / 4 - 0.07, 0.16), metal)
      arc.rotation.z = (index * Math.PI) / 4
      ring.add(arc)
    }

    // The hub: a disc with a four-pointed star cut through it, a raised lip, and the black ball it rides on.
    const face = new THREE.Shape()
    face.absarc(0, 0, HUB, 0, Math.PI * 2, false)
    const star = new THREE.Path()
    const point = 0.52
    const waist = 0.17
    star.moveTo(point, 0)
    for (let corner = 1; corner <= 4; corner++) {
      const a = (corner * Math.PI) / 2
      const between = a - Math.PI / 4
      star.quadraticCurveTo(Math.cos(between) * waist, Math.sin(between) * waist, Math.cos(a) * point, Math.sin(a) * point)
    }
    face.holes.push(star)
    const hub = new THREE.Group()
    const disc = new THREE.Mesh(new THREE.ExtrudeGeometry(face, { depth: 0.07, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 48 }), metal)
    disc.position.z = -0.02
    const lip = new THREE.Mesh(new THREE.TorusGeometry(HUB + 0.05, 0.045, 12, 96), metal)
    lip.position.z = 0.03
    const ball = new THREE.Mesh(new THREE.SphereGeometry(HUB * 0.93, 64, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).rotateX(Math.PI / 2), steel({ body: 0.02, glint: 1.1, tight: 90, grain: 0 }))
    ball.position.z = -0.03
    hub.add(disc, lip, ball)
    body.add(hub)

    return {
      object,
      update(time) {
        const at = time % LOOP
        // The dial's attitude: a slow wobble, the lean back before the tumble, and the tumble itself.
        const swing = (at / LOOP) * Math.PI * 2
        body.rotation.x = -0.3 - 0.1 * Math.sin(swing) - keyed(at, LEAN) - keyed(at, TUMBLE) * Math.PI * 2
        body.rotation.y = 0.16 * Math.sin(swing + 1)
        ring.rotation.z = -swing // clockwise, once per loop

        const apart = ease(keyed(at, APART))
        const swung = ease(keyed(at, SWING))
        plates.forEach(({ move, slide, hinge, roll, level, swings }, index) => {
          // Coming home after the tumble, each plate lands a moment after the one before it.
          const landing = 1 - ease(THREE.MathUtils.clamp((at - SEATED_BY - index * STAIR) / 0.16, 0, 1))
          const stand = at < SEATED_BY ? apart * level : ease(keyed(SEATED_BY, APART)) * level * landing
          slide.position.z = (move.lift ? keyed(at, move.lift) : 0) + stand
          slide.position.x = (move.out ? keyed(at, move.out) : 0) + (swings ? swung * 0.7 : 0)
          hinge.rotation.y = (move.dip ? keyed(at, move.dip) : 0) + (swings ? swung * 0.5 : 0)
          roll.rotation.x = move.roll ? keyed(at, move.roll) : 0
        })

        // The hub flips right over once a second, and turns slowly between flips.
        const beat = (at % 1) - FLIP_AT
        const flip = beat > 0 && beat < FLIP_TAKES ? ease(beat / FLIP_TAKES) : 0
        hub.rotation.x = flip * Math.PI * 2
        hub.rotation.z = (at / LOOP) * (Math.PI / 2)
      },
    }
  },
}
export default dial
