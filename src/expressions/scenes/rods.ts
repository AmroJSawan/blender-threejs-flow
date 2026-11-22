import * as THREE from 'three'
import { keyed, type Expression } from '../kit'

/**
 * The motion below is read off the reference clip frame by frame (it lasts 1.52 s there).
 * Every list is [seconds, value]. The clip then cuts away; here it rests for REST seconds and starts again.
 */
const PACE = 1            // 1 = the reference's own speed; 0.5 = half speed
const REST = 0.5          // seconds it carries on turning after the last pose before it starts again
const LENGTH = 1.52
const LONG = 7.0          // long enough to run out of the picture
const SHOWN = 3.4         // about how much of a rod's length is in the picture: where a rod goes dark is measured along this
const THICK = 0.5         // a rod's radius
const GAP = 1.9           // how far each rod's near end stands from the middle
const SCALE = 1.35        // size of the whole ring in the view
const LIFT = 0.64         // how far the near ends are tipped toward the viewer, radians
const TILT = 0.28         // how far a rod leans back from the way the ring is turning: radians of lean per radian-a-second of turning
const LEAN_MOST = 0.6     // the most it may lean, radians
const SPRING = 8          // how quickly a rod leans over and stands straight again: higher = quicker
const FADE = 0.2          // how gradually a rod's glow gives way to its dark part, as a share of its length
const RED = new THREE.Color('#f5221a')
const AMBER = new THREE.Color('#ff7a1a')
const GOLD = new THREE.Color('#ffd25c')

/** The ring's turn, degrees: it swings quickly clockwise into place, holds, then winds slowly back the other way. */
const TURN: [number, number][] = [[0, 20], [0.08, 9], [0.16, 3], [0.24, 0], [0.9, 0], [1.04, 4], [1.2, 12], [1.36, 22], [1.52, 32], [2.02, 62]]
/** The view starts close and settles back within the first third of a second. */
const ZOOM: [number, number][] = [[0, 1.28], [0.16, 1.08], [0.3, 1], [1.52, 0.96], [2.02, 0.95]]
/** How settled the rods are: at the start each is a few degrees out of place (0), then they fall into even spacing (1). */
const SETTLE: [number, number][] = [[0, 0], [0.3, 1]]
/**
 * Each rod, anticlockwise from the one pointing right, as seen in the reference at 0 s, 0.8 s and 1.44 s:
 * its colour (0 = red, 0.5 = amber, 1 = gold), how far along itself it glows before going dark
 * (1 = as far as the picture's edge), and how many degrees out of place it starts.
 */
const MOMENTS = [0, 0.8, 1.44, 2.02]
const RODS: { warmth: number[]; glows: number[]; astray: number }[] = [
  { warmth: [0, 0.55, 0.45, 0.35], glows: [1, 1, 1, 1], astray: 11 },
  { warmth: [0, 1, 0.38, 0.2], glows: [0.6, 1, 0.7, 0.6], astray: -5 },
  { warmth: [0, 0.5, 0.05, 0], glows: [0.5, 0.45, 0.3, 0.25], astray: -6 },
  { warmth: [0.45, 0.5, 0, 0], glows: [1, 1, 1, 1], astray: 2 },
  { warmth: [0.7, 1, 0.05, 0], glows: [1, 1, 1, 1], astray: 1 },
  { warmth: [0.25, 0.85, 0.1, 0], glows: [0.35, 0.6, 0.35, 0.3], astray: 4 },
  { warmth: [0, 0.5, 0.1, 0], glows: [1, 0.3, 0.5, 0.55], astray: -2 },
]
const FIRST = 15 // where the first rod points once settled, degrees

/** A rod's surface: an even, saturated glow with a paler near face, giving way along its length to near-black with a faint outline. */
function glowing(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColour: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uGlows: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vPlace;
      varying vec3 vFacing; // the surface's direction, in the rod's own space
      varying vec3 vNormal;
      varying vec3 vToEye;
      void main() {
        vPlace = position;
        vFacing = normal;
        vec4 seen = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalMatrix * normal;
        vToEye = -seen.xyz;
        gl_Position = projectionMatrix * seen;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vPlace;
      varying vec3 vFacing;
      varying vec3 vNormal;
      varying vec3 vToEye;
      uniform vec3 uColour, uDeep;
      uniform float uGlows;
      void main() {
        float along = (vPlace.x + ${(LONG / 2).toFixed(2)}) / ${SHOWN.toFixed(2)};          // 0 at the near end … 1 where it leaves the picture
        float lit = smoothstep(uGlows + ${FADE}, uGlows - ${FADE}, along);      // 1 where it glows, 0 where it has gone dark
        float edge = 1.0 - clamp(dot(normalize(vNormal), normalize(vToEye)), 0.0, 1.0); // 0 facing the viewer … 1 at the outline
        float face = step(0.5, -vFacing.x);                                    // the flat near end
        vec3 side = mix(uColour, uDeep, smoothstep(0.0, 0.9, along)) * (0.9 + 0.22 * edge * edge); // deeper toward the far end, a touch lighter at the outline
        vec3 pale = mix(uColour, vec3(1.0), 0.34) * (0.86 + 0.14 * clamp(0.5 + vPlace.y / ${(THICK * 2).toFixed(2)}, 0.0, 1.0));
        vec3 glow = mix(side, pale, face);
        vec3 dark = vec3(0.011) + vec3(0.055) * pow(edge, 2.5);
        gl_FragColor = vec4(mix(dark, glow, lit), 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

const rods: Expression = {
  title: 'Rods',
  note: 'Seven rods pointing in at an empty middle, their paler near ends tipped toward you. The ring swings into place, holds, and winds slowly back, each rod leaning away from the turn, while they warm from red to gold and cool again, each in its own time.',
  order: 11,
  stage: 'ember',
  build() {
    const object = new THREE.Group()
    const shape = new THREE.CylinderGeometry(THICK, THICK, LONG, 96).rotateZ(-Math.PI / 2) // lying along its arm, pointing outward
    const made = RODS.map((rod) => {
      const arm = new THREE.Group()
      const material = glowing()
      const mesh = new THREE.Mesh(shape, material)
      mesh.position.x = LONG / 2
      const hinge = new THREE.Group() // at the rod's near end: the rod stays straight and leans about this point
      hinge.position.x = GAP
      hinge.add(mesh)
      const lift = new THREE.Group() // tips the near end toward the viewer, so its round face shows
      lift.rotation.y = LIFT
      lift.add(hinge)
      arm.add(lift)
      object.add(arm)
      const keys = (values: number[]) => values.map((value, index): [number, number] => [MOMENTS[index], value])
      return { arm, hinge, material, lean: 0, astray: rod.astray, warmth: keys(rod.warmth), glows: keys(rod.glows) }
    })
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
        object.scale.setScalar(keyed(at, ZOOM) * SCALE)
        const spin = THREE.MathUtils.degToRad(keyed(at + 0.02, TURN) - keyed(at - 0.02, TURN)) / 0.04 // how fast the ring is turning, radians a second
        const settling = (keyed(at - 0.02, SETTLE) - keyed(at + 0.02, SETTLE)) / 0.04
        made.forEach((rod, index) => {
          const { arm, hinge, material, astray } = rod
          arm.rotation.z = THREE.MathUtils.degToRad(FIRST + (index * 360) / RODS.length + turn + astray * loose)
          // A rod leans back from the way it is being carried, its far end trailing, and stands straight when the ring holds.
          const speed = spin + THREE.MathUtils.degToRad(astray) * settling
          const wanted = THREE.MathUtils.clamp(-speed * TILT, -LEAN_MOST, LEAN_MOST)
          rod.lean = restarted || dt === 0 ? wanted : rod.lean + (wanted - rod.lean) * Math.min(dt * SPRING, 1)
          hinge.rotation.z = rod.lean
          const warmth = keyed(at, rod.warmth) // 0 red … 1 gold
          const colour = material.uniforms.uColour.value as THREE.Color
          colour.copy(RED).lerp(AMBER, Math.min(warmth * 2, 1)).lerp(GOLD, Math.max(warmth * 2 - 1, 0))
          ;(material.uniforms.uDeep.value as THREE.Color).copy(colour).lerp(RED, 0.45) // redder toward the far end
          const glows = keyed(at, rod.glows)
          material.uniforms.uGlows.value = glows + 1.2 * THREE.MathUtils.smoothstep(glows, 0.7, 1) // pushed past the far end when it glows all the way, so no dark tip is left
        })
      },
    }
  },
}
export default rods
