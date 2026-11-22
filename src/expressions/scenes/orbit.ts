import * as THREE from 'three'
import { ember, keyed, type Expression } from '../kit'

/**
 * The motion below is read off the reference clip frame by frame (it lasts 1.36 s there).
 * Every list is [seconds, value]. The clip then cuts away; here it rests for REST seconds and starts again.
 */
const PACE = 1            // 1 = the reference's own speed; 0.5 = half speed
const REST = 0.65         // seconds held on the last pose before it starts again
const LENGTH = 1.36
const PLANET = 6.2        // radius of the dark planet; only its top shows

/** The view draws back the whole time: the planet's size, and how high its top edge sits in the view. */
const SIZE: [number, number][] = [[0, 1], [0.48, 0.9], [0.72, 0.8], [1.04, 0.68], [1.36, 0.58], [2.01, 0.54]]
const HORIZON: [number, number][] = [[0, -1.1], [0.48, -1.35], [0.72, -1.7], [1.04, -2.15], [1.36, -2.55], [2.01, -2.7]]
/** The band: smoulders, flares white-hot by 0.6 s, then cools to a thin red line. */
const HEAT: [number, number][] = [[0, 0.1], [0.16, 0.14], [0.32, 0.5], [0.48, 0.9], [0.6, 1], [0.72, 0.95], [0.88, 0.7], [1.04, 0.45], [1.2, 0.3], [1.36, 0.2], [2.01, 0.14]]
/** The large moon above: its size, its height, and its glow (which lags the band a little and fades sooner). */
const HIGH_SIZE: [number, number][] = [[0, 1], [0.48, 0.89], [1.04, 0.67], [1.36, 0.5], [2.01, 0.46]]
const HIGH_AT: [number, number][] = [[0, 0], [1.36, 0.45], [2.01, 0.5]]
const HIGH_GLOW: [number, number][] = [[0, 0], [0.24, 0.1], [0.4, 0.55], [0.56, 0.95], [0.72, 1], [0.88, 0.75], [1.04, 0.4], [1.2, 0.15], [1.36, 0.05]]
/**
 * The three small moons: size, how high each hovers, and where along the band it is (radians from where
 * the band comes over the left horizon). The right-hand one travels in to meet the middle one.
 */
const MOONS: { size: number; hover: number; along: [number, number][]; glow: [number, number][] }[] = [
  { size: 0.1, hover: 0.3, along: [[0, 0.2], [1.36, 0.36], [2.01, 0.4]], glow: [[0, 0], [0.56, 0.5], [1.36, 0.2]] },
  { size: 0.19, hover: 0.8, along: [[0, 0.84], [1.36, 0.8]], glow: [[0, 0], [0.56, 0.7], [1.04, 0.5], [1.36, 0.3]] },
  { size: 0.17, hover: 0.32, along: [[0, 1.2], [0.48, 1.12], [0.8, 1.04], [1.04, 0.96], [1.36, 0.88], [2.01, 0.85]], glow: [[0, 0], [0.4, 0.3], [0.64, 1], [0.8, 1], [1.04, 0.8], [1.36, 0.75]] },
]
/** The band is the great circle through these two directions from the planet's centre. */
const ENTERS = new THREE.Vector3(-0.62, 0.74, 0.25).normalize()
const LEAVES = new THREE.Vector3(0.5, 0.66, 0.56).normalize()

const orbit: Expression = {
  title: 'Orbit',
  note: 'The top of a dark planet with a band of fire across its surface. The band smoulders, flares white-hot and cools while the view draws steadily back; a moon rides in along the band, and the large one above catches the glow.',
  order: 10,
  stage: 'ember',
  build() {
    const axis = new THREE.Vector3().crossVectors(ENTERS, LEAVES).normalize() // the band circles this
    const across = new THREE.Vector3().crossVectors(axis, ENTERS).normalize()
    const onBand = (angle: number) => ENTERS.clone().multiplyScalar(Math.cos(angle)).addScaledVector(across, Math.sin(angle))
    const uniforms = {
      uAxis: { value: axis },
      uAlong: { value: ENTERS },
      uAcross: { value: across },
      uHeat: { value: 0 },
      uSpin: { value: 0 },
      uShadows: { value: MOONS.map(() => new THREE.Vector3()) },
      uShadowWay: { value: new THREE.Vector3(-0.95, -0.1, 0.3).normalize() }, // the light is low on the right, so shadows run left
    }
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(PLANET, 192, 128),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          varying vec3 vOut;    // direction from the planet's centre
          varying vec3 vNormal;
          varying vec3 vToEye;
          void main() {
            vOut = normalize(position);
            vec4 seen = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalMatrix * normal;
            vToEye = -seen.xyz;
            gl_Position = projectionMatrix * seen;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vOut;
          varying vec3 vNormal;
          varying vec3 vToEye;
          uniform vec3 uAxis, uAlong, uAcross, uShadowWay;
          uniform vec3 uShadows[${MOONS.length}];
          uniform float uHeat, uSpin;
          #define WIDE 0.085 // half the band's width, as a share of the planet's radius
          void main() {
            vec3 n = normalize(vNormal);
            // The planet itself: nearly black, with a soft grey sheen where it turns toward the light behind it.
            float sheen = pow(clamp(dot(n, normalize(vec3(0.35, 0.8, -0.2))), 0.0, 1.0), 1.5);
            float rim = pow(1.0 - clamp(dot(n, normalize(vToEye)), 0.0, 1.0), 4.0);
            vec3 colour = vec3(0.01) + vec3(0.05) * sheen * sheen + vec3(0.05) * rim;

            // The band: streaks running along it. Cool, only the thinnest streaks show; hot, it fills in and widens.
            float over = dot(vOut, uAxis) / (WIDE * (0.8 + 0.35 * uHeat));        // -1 … 1 across the band
            float along = atan(dot(vOut, uAcross), dot(vOut, uAlong)) + uSpin;
            float inside = smoothstep(1.0, 0.72, abs(over));
            float lines = 0.5 + 0.5 * sin(over * 11.0 + 1.6 * sin(along * 2.0) + 2.0);
            lines = mix(lines, 0.5 + 0.5 * sin(over * 27.0 - 2.0 * sin(along * 3.0 + 1.0)), 0.35);
            float lit = inside * mix(pow(lines, 5.0) * 0.55, 0.45 + 0.55 * lines, uHeat);
            vec3 fire = mix(vec3(1.0, 0.07, 0.03), vec3(1.0, 0.42, 0.1), smoothstep(0.25, 0.7, uHeat * lit));
            fire = mix(fire, vec3(1.0, 0.93, 0.74), smoothstep(0.62, 1.0, uHeat * lit));
            colour += fire * lit * (0.5 + 1.3 * uHeat);
            colour += vec3(1.0, 0.16, 0.05) * 0.3 * uHeat * exp(-max(abs(over) - 1.0, 0.0) * 2.2); // its light on the ground beside it

            // The moons' long shadows, which the band's own light washes out as it flares.
            float shade = 0.0;
            for (int i = 0; i < ${MOONS.length}; i++) {
              vec3 from = vOut - uShadows[i];
              float away = dot(from, uShadowWay);
              float aside = length(from - away * uShadowWay);
              shade = max(shade, smoothstep(0.028, 0.008, aside) * smoothstep(0.2, 0.0, away) * smoothstep(-0.02, 0.0, away));
            }
            colour *= 1.0 - 0.85 * shade * (1.0 - 0.75 * uHeat);
            gl_FragColor = vec4(colour, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    )
    const world = new THREE.Group().add(planet)
    const moons = MOONS.map(({ size }) => {
      const material = ember({ hot: '#ffd9a0', warm: '#ff2a12', from: -size, to: size * 0.9, body: 0.05 })
      const moon = new THREE.Mesh(new THREE.SphereGeometry(size, 32, 24), material)
      world.add(moon)
      return { moon, material }
    })
    const high = ember({ hot: '#ff6a30', warm: '#8a1206', from: -0.52, to: 0.5, body: 0.06 })
    const highMoon = new THREE.Mesh(new THREE.SphereGeometry(0.52, 64, 48), high)
    const object = new THREE.Group().add(world, highMoon)
    return {
      object,
      update(time) {
        const at = (time * PACE) % (LENGTH + REST)
        const size = keyed(at, SIZE)
        world.scale.setScalar(size)
        world.position.set(0.3, keyed(at, HORIZON) - PLANET * size, 0)
        const heat = keyed(at, HEAT)
        uniforms.uHeat.value = heat
        uniforms.uSpin.value = at * 0.25
        MOONS.forEach(({ hover, along, glow }, index) => {
          const place = onBand(keyed(at, along))
          moons[index].moon.position.copy(place).multiplyScalar(PLANET + hover)
          moons[index].material.uniforms.uHeat.value = keyed(at, glow)
          uniforms.uShadows.value[index].copy(place)
        })
        high.uniforms.uHeat.value = keyed(at, HIGH_GLOW)
        highMoon.scale.setScalar(keyed(at, HIGH_SIZE))
        highMoon.position.set(0, keyed(at, HIGH_AT), 0.5)
      },
    }
  },
}
export default orbit
