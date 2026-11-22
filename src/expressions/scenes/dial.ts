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
 * - Event two (3.3–4.5 s), the tumble: the dial leans back and rights itself; the lamp cuts out, leaving an
 *   edge-lit silhouette; it comes back on as the dial snaps over to edge-on with the plates thrown apart
 *   above and below it; the dial rocks back up to face front while two plates swing out and drop; the lamp
 *   cuts out again and every plate rolls up on edge, so the dial is a wheel of thin spokes; it rocks over
 *   to edge-on a second time as the plates lie flat and the narrow ones rise as a staircase; then it comes
 *   home and the steps land one after another. Its back is never shown.
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
/**
 * Event two. How far the dial is tipped back about its level axis, degrees, on top of its resting attitude:
 * read from how flattened its outline is in each frame of the reference.
 */
const TURNED: [number, number][] = [
  [3.3, 0], [3.45, 23], [3.56, 17], [3.6, -3], [3.64, -7], [3.76, -5], // leans back, rights itself, holds
  [3.8, 46], [3.84, 61], [3.86, 68], [3.88, 66],                         // snaps over to edge-on
  [3.92, 46], [3.96, 24], [4.0, -15], [4.04, -12],                       // and back up to face front
  [4.08, 8], [4.12, 28], [4.16, 46], [4.2, 60], [4.22, 66],              // over to edge-on a second time
  [4.24, 43], [4.28, 24], [4.32, 9], [4.4, -6], [4.5, 0],                // and home
]
/** The lamp: it cuts out twice, and a light from behind takes over, picking out edges only. */
const LAMP: [number, number][] = [[3.58, 1], [3.66, 0.05], [3.76, 0.08], [3.8, 1], [4.0, 1], [4.03, 0.06], [4.1, 0.12], [4.15, 1]]
/** How far apart the plates are thrown along the dial's axis (0 = seated). */
const APART: [number, number][] = [[3.74, 0], [3.84, 1], [3.92, 0.55], [4.0, 0]]
/** Every plate rolls up on edge about its own length, degrees: at 90 the dial is a wheel of spokes. */
const ON_EDGE: [number, number][] = [[3.9, 0], [4.0, 38], [4.04, 88], [4.11, 88], [4.16, 14], [4.19, 0]]
/** Two plates swing out past the rim and drop while the dial shows its back. */
const SWING: [number, number][] = [[3.86, 0], [3.93, 1], [3.98, 1], [4.04, 0]]
/** The staircase: the narrow plates rise in steps of STEP, then land one after another, LANDS seconds apart. */
const STAIRS: [number, number][] = [[4.12, 0], [4.19, 1], [4.27, 1]]
const STEP = 0.2
const LANDS = 0.035
const TUMBLING = [3.55, 4.45] // the hub does not flip while the dial is tumbling
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
      // Thrown apart mid-tumble, plates alternate above and below the dial, further the later they are in the list.
      const level = (index % 2 ? 1 : -1) * (0.2 + 0.09 * index)
      // The narrow plates (the last five) form the staircase, the first of them the lowest step.
      const step = index >= 5 ? index - 4 : 0
      return { move, slide, hinge, roll, level, step, swings: index >= 8 }
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
    const dark = steel({ body: 0.02, glint: 1.1, tight: 90, grain: 0 })
    const ball = new THREE.Mesh(new THREE.SphereGeometry(HUB * 0.93, 64, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).rotateX(Math.PI / 2), dark)
    ball.position.z = -0.03
    hub.add(disc, lip, ball)
    body.add(hub)

    return {
      object,
      update(time) {
        const at = time % LOOP
        // The dial's attitude: a slow wobble, plus however far the tumble has turned it.
        const swing = (at / LOOP) * Math.PI * 2
        body.rotation.x = -0.3 - 0.1 * Math.sin(swing) - THREE.MathUtils.degToRad(keyed(at, TURNED))
        body.rotation.y = 0.16 * Math.sin(swing + 1)
        ring.rotation.z = -swing // clockwise, once per loop
        const lamp = keyed(at, LAMP)
        for (const material of [metal, dark]) {
          material.uniforms.uLamp.value = lamp
          material.uniforms.uBack.value = (1 - lamp) * 0.9
        }

        const apart = ease(keyed(at, APART))
        const onEdge = THREE.MathUtils.degToRad(keyed(at, ON_EDGE))
        const swung = ease(keyed(at, SWING))
        const risen = ease(keyed(at, STAIRS))
        plates.forEach(({ move, slide, hinge, roll, level, step, swings }) => {
          // Each step of the staircase lands a moment after the one below it.
          const landed = ease(THREE.MathUtils.clamp((at - 4.27 - step * LANDS) / 0.15, 0, 1))
          slide.position.z = (move.lift ? keyed(at, move.lift) : 0) + apart * level + step * STEP * risen * (1 - landed)
          slide.position.x = (move.out ? keyed(at, move.out) : 0) + (swings ? swung * 0.7 : 0)
          hinge.rotation.y = (move.dip ? keyed(at, move.dip) : 0) + (swings ? swung * 0.55 : 0)
          roll.rotation.x = (move.roll ? keyed(at, move.roll) : 0) + onEdge
        })

        // The hub flips right over once a second, and turns slowly between flips.
        const beat = (at % 1) - FLIP_AT
        const tumbling = at > TUMBLING[0] && at < TUMBLING[1]
        const flip = !tumbling && beat > 0 && beat < FLIP_TAKES ? ease(beat / FLIP_TAKES) : 0
        hub.rotation.x = flip * Math.PI * 2
        hub.rotation.z = (at / LOOP) * (Math.PI / 2)
      },
    }
  },
}
export default dial
