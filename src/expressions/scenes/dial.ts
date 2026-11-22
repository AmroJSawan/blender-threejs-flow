import * as THREE from 'three'
import { flowing, plate, steel, type Expression } from '../kit'

/**
 * A study after "Semantic Restructuring" by Reijo Palmiste, worked out from the clip frame by frame.
 *
 * The mechanism, as read from the reference:
 * - A dial of wedge-shaped flaps between a hub (with a four-pointed star cut through it) and a notched rim.
 * - Every flap turns on its own axle: the line down its middle, from the hub out to the rim. The axles are
 *   not modelled; nothing is seen but the flaps turning. A flap that has turned half way round lies flat
 *   again and looks as it did.
 * - The ring of flaps turns clockwise the whole time, exactly once per loop (LOOP seconds).
 * - The hub is a plate like the rest, on a level axle of its own. Once a second it turns half way over.
 * - The lamp hangs above. The dial rests tipped back toward it; whatever turns upright goes dark, and a
 *   flap brightens and dims as it turns.
 * - Event one (0.3–1.4 s): the flaps turn over in a wave. The narrow ones go first and wait part way;
 *   the wide ones follow in one slow turn, catching the lamp as they pass.
 * - Event two (3.3–4.5 s), the tumble: the dial nods forward until it stands upright and dark, then back
 *   to edge-on, twice. Through the first nod the flaps open to different angles, so edge-on they stand
 *   above and below the dial; they come up on edge together (a dark wheel of lit spokes) and go on over.
 *   The narrow ones stop short, each a little further round than the last, like a staircase, then drop
 *   flat one after another.
 * Every list below is [seconds, value].
 */
const LOOP = 6
const RIM = 2.45          // radius of the dial
const HUB = 0.8           // radius of the hub
const THICK = 0.06        // thickness of a flap

/** The flaps, as the angles (degrees, anticlockwise from the right) each one runs between at the start of the loop. */
const EDGES = [5, 75, 100, 120, 200, 265, 285, 300, 330, 350, 365]

/**
 * Event one. How far each flap has turned on its axle, degrees, by its place in the list above.
 * 180 is right over and flat again.
 */
const FIRST_TURN: [number, number][][] = [
  [[0.45, 0], [0.8, 95], [1.15, 180]],                 // wide, top right: one slow turn
  [[0.25, 0], [0.5, 40], [1.1, 44], [1.4, 180]],       // narrow: opens, waits, goes over
  [[0.3, 0], [0.55, 26], [1.0, 28], [1.3, 0]],         // narrow: opens a little, waits, closes again
  [[0.6, 0], [0.9, 90], [1.2, 180]],                   // wide, left
  [[0.5, 0], [0.75, 80], [1.05, 180]],                 // wide, lower left: the bright streak
  [[0.55, 0], [0.9, 100], [1.25, 180]],
  [[0.3, 0], [0.46, 62], [0.92, 68], [1.2, 180]],      // the three narrow ones: open one after another, wait, go over
  [[0.34, 0], [0.5, 66], [0.97, 72], [1.26, 180]],
  [[0.38, 0], [0.54, 60], [1.02, 66], [1.32, 180]],
  [[0.45, 0], [0.7, 118], [0.85, 122], [1.1, 180]],
]
/**
 * Event two. Where each flap stands through the first nod (so that, edge-on, they are at different heights),
 * then all together: on edge, and on over to flat.
 */
const OPEN_TO = [35, 60, 25, 50, 30, 65, 40, 55, 30, 45] // degrees, by 3.84 s
const OPENS = 3.74
const ON_EDGE = [4.04, 4.11]  // every flap is at 90° between these
const FLAT_BY = 4.18
/** The staircase: the last five flaps stop short of flat, each STEP degrees further from it than the one before, until … */
const STEP = 15
const STAIRS_HOLD = 4.27
/** … they drop flat one after another, LANDS seconds apart, each taking DROP seconds. */
const LANDS = 0.035
const DROP = 0.16

/**
 * How far the whole dial is tipped back about its level axis, degrees, on top of its resting attitude:
 * read from how flattened its outline is, and how brightly its face is lit, in each frame of the reference.
 */
const TIPPED: [number, number][] = [
  [3.2, 0], [3.45, 23], [3.56, 17],                         // leans back
  [3.6, -3], [3.64, -11], [3.68, -17], [3.72, -20],         // nods forward until it stands upright: the lamp no longer reaches its face
  [3.76, 5], [3.8, 43], [3.84, 61], [3.87, 65],             // back, right over to edge-on
  [3.92, 46], [3.96, 24], [4.0, -9], [4.04, -17],           // forward again, upright and dark
  [4.08, 8], [4.12, 28], [4.16, 46], [4.2, 60], [4.22, 63], // back to edge-on a second time
  [4.24, 43], [4.28, 24], [4.32, 13], [4.4, 3], [4.5, 0],   // and home
]
/** The hub's flip: once a second, starting at this moment in the second and taking this long. Not while the dial is tumbling. */
const FLIP_AT = 0.05
const FLIP_TAKES = 0.55
const TUMBLING = [3.55, 4.45]

const ease = (t: number) => t * t * (3 - 2 * t)

const dial: Expression = {
  title: 'Dial',
  note: 'After “Semantic Restructuring” by Reijo Palmiste. A steel dial whose wedge-shaped flaps each turn on their own axle. They turn over in a wave; then the dial nods twice while the flaps open, stand on edge like spokes, and settle like stairs. The hub, a plate too, turns over every second.',
  order: 14,
  stage: 'steel',
  build() {
    const metal = steel()
    const object = new THREE.Group()
    const body = new THREE.Group() // the dial: wobbles and nods as one
    object.add(body)
    const ring = new THREE.Group() // the flaps and the rim: turns steadily
    body.add(ring)

    const flaps = FIRST_TURN.map((first, index) => {
      const wide = THREE.MathUtils.degToRad(EDGES[index + 1] - EDGES[index])
      const arm = new THREE.Group() // points along the flap's centre line, which is its axle
      arm.rotation.z = THREE.MathUtils.degToRad(EDGES[index]) + wide / 2
      const flap = new THREE.Mesh(plate(HUB + 0.16, RIM - 0.07, wide - 0.012, THICK), metal)
      arm.add(flap)
      ring.add(arm)

      // The whole of this flap's second turn, as one list: open, on edge, over, and (for the last five) the stair.
      const stair = index >= 5 ? index - 4 : 0
      const second: [number, number][] = [[OPENS, 0], [3.84, OPEN_TO[index]], [ON_EDGE[0], 90], [ON_EDGE[1], 90]]
      if (stair) {
        const lands = STAIRS_HOLD + (stair - 1) * LANDS
        second.push([FLAT_BY + 0.01, 180 - stair * STEP], [lands, 180 - stair * STEP], [lands + DROP, 180])
      } else second.push([FLAT_BY, 180])
      return { flap, first, second }
    })

    // The rim: eight arcs with small gaps between them.
    for (let index = 0; index < 8; index++) {
      const arc = new THREE.Mesh(plate(RIM, RIM + 0.07, Math.PI / 4 - 0.07, 0.16), metal)
      arc.rotation.z = (index * Math.PI) / 4
      ring.add(arc)
    }

    // The hub: a plate with a four-pointed star cut through it and a raised lip on each face.
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
    disc.position.z = -0.035 // centred on its axle, so it looks the same from either side
    const lip = new THREE.Mesh(new THREE.TorusGeometry(HUB + 0.05, 0.045, 12, 96), metal)
    hub.add(disc, lip)
    const hubTurn = new THREE.Group() // carries the hub's axle round, so the plate looks the same after each half turn
    hubTurn.add(hub)
    body.add(hubTurn)

    return {
      object,
      update(time) {
        const at = time % LOOP
        // The dial's attitude: a slow wobble, plus however far the tumble has tipped it.
        const swing = (at / LOOP) * Math.PI * 2
        body.rotation.x = -0.36 - 0.08 * Math.sin(swing) - THREE.MathUtils.degToRad(flowing(at, TIPPED))
        body.rotation.y = 0.16 * Math.sin(swing + 1)
        ring.rotation.z = -swing // clockwise, once per loop

        // Each flap only ever turns on its axle.
        for (const { flap, first, second } of flaps) flap.rotation.x = THREE.MathUtils.degToRad(flowing(at, first) + flowing(at, second))

        // The hub turns half way over once a second, and turns slowly in its own plane between flips.
        const beat = (at % 1) - FLIP_AT
        const tumbling = at > TUMBLING[0] && at < TUMBLING[1]
        const flip = !tumbling && beat > 0 && beat < FLIP_TAKES ? ease(beat / FLIP_TAKES) : 0
        hub.rotation.x = flip * Math.PI
        hubTurn.rotation.z = (at / LOOP) * (Math.PI / 2)
      },
    }
  },
}
export default dial
