import * as THREE from 'three'
import { ember, type Expression } from '../kit'

const PLANET = 7          // radius of the dark planet; only its top shows
const CYCLE = 6           // seconds from one flare of the band to the next
/** The band is the great circle through these two directions from the planet's centre: where it comes over the left horizon, and low on the right, toward the viewer. */
const ENTERS = new THREE.Vector3(-0.62, 0.74, 0.25).normalize()
const LEAVES = new THREE.Vector3(0.5, 0.66, 0.56).normalize()
/** Each moon: its size, how high it hovers, where along the band it starts (radians from ENTERS) and how far it drifts. */
const MOONS = [
  [0.15, 0.3, 0.3, 0.1],
  [0.24, 0.42, 0.78, -0.08],
  [0.2, 0.28, 1.12, 0.12],
]

const orbit: Expression = {
  title: 'Orbit',
  note: 'The top of a dark planet with a band of fire lying across its surface. The band smoulders as thin red streaks, flares white-hot and cools again; small moons hover over it, lit from below when it flares, and a larger one hangs above.',
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
          uniform vec3 uAxis, uAlong, uAcross;
          uniform vec3 uShadows[${MOONS.length}];
          uniform float uHeat, uSpin;
          #define WIDE 0.085 // half the band's width, as a share of the planet's radius
          void main() {
            vec3 n = normalize(vNormal);
            // The planet itself: nearly black, with a soft grey sheen where it turns toward the light behind it.
            float sheen = pow(clamp(dot(n, normalize(vec3(0.35, 0.8, -0.2))), 0.0, 1.0), 1.5);
            float rim = pow(1.0 - clamp(dot(n, normalize(vToEye)), 0.0, 1.0), 4.0);
            vec3 colour = vec3(0.01) + vec3(0.05) * sheen * sheen + vec3(0.05) * rim;

            // The band: streaks running along it. Cool, only the thinnest streaks show; hot, it fills in.
            float over = dot(vOut, uAxis) / WIDE;                                  // -1 … 1 across the band
            float along = atan(dot(vOut, uAcross), dot(vOut, uAlong)) + uSpin;
            float inside = smoothstep(1.0, 0.72, abs(over));
            float lines = 0.5 + 0.5 * sin(over * 11.0 + 1.6 * sin(along * 2.0) + 2.0);
            lines = mix(lines, 0.5 + 0.5 * sin(over * 27.0 - 2.0 * sin(along * 3.0 + 1.0)), 0.35);
            float lit = inside * mix(pow(lines, 5.0) * 0.55, 0.45 + 0.55 * lines, uHeat);
            vec3 fire = mix(vec3(1.0, 0.07, 0.03), vec3(1.0, 0.42, 0.1), smoothstep(0.25, 0.7, uHeat * lit));
            fire = mix(fire, vec3(1.0, 0.93, 0.74), smoothstep(0.62, 1.0, uHeat * lit));
            colour += fire * lit * (0.5 + 1.3 * uHeat);
            colour += vec3(1.0, 0.16, 0.05) * 0.3 * uHeat * exp(-max(abs(over) - 1.0, 0.0) * 2.2); // its light on the ground beside it

            // The moons' shadows.
            float shade = 0.0;
            for (int i = 0; i < ${MOONS.length}; i++) shade = max(shade, smoothstep(0.9994, 0.99985, dot(vOut, uShadows[i])));
            colour *= 1.0 - 0.8 * shade;
            gl_FragColor = vec4(colour, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    )
    const world = new THREE.Group()
    world.position.set(0.7, -PLANET - 0.4, 0)
    world.add(planet)
    const moons = MOONS.map(([size]) => {
      const material = ember({ hot: '#ff3018', warm: '#8a0a04', from: -size, to: size * 0.9, body: 0.05 })
      const moon = new THREE.Mesh(new THREE.SphereGeometry(size, 32, 24), material)
      world.add(moon)
      return { moon, material }
    })
    const high = ember({ hot: '#ff6a30', warm: '#8a1206', from: -0.62, to: 0.55, body: 0.06 })
    const highMoon = new THREE.Mesh(new THREE.SphereGeometry(0.62, 64, 48), high)
    const object = new THREE.Group().add(world, highMoon)
    const lightSide = new THREE.Vector3(0.25, 0.1, -0.1) // shadows fall a little this way from under each moon
    return {
      object,
      update(time) {
        // One cycle: smoulder, flare up quickly, hold, cool slowly.
        const at = (time % CYCLE) / CYCLE
        const rise = THREE.MathUtils.smoothstep(at, 0.08, 0.3)
        const fall = 1 - THREE.MathUtils.smoothstep(at, 0.42, 0.85)
        const heat = 0.08 + 0.92 * rise * fall
        uniforms.uHeat.value = heat
        uniforms.uSpin.value = time * 0.12
        MOONS.forEach(([, hover, start, drift], index) => {
          const place = onBand(start + drift * Math.sin(time * 0.4 + index * 2))
          moons[index].moon.position.copy(place).multiplyScalar(PLANET + hover + 0.05 * Math.sin(time * 0.9 + index))
          moons[index].material.uniforms.uHeat.value = heat
          uniforms.uShadows.value[index].copy(place).addScaledVector(lightSide, 0.03).normalize()
        })
        high.uniforms.uHeat.value = heat * 0.9
        highMoon.position.set(0.15, 1.75 + 0.12 * Math.sin(time * 0.7), 0.5)
        object.scale.setScalar(1.06 + 0.06 * Math.cos(at * Math.PI * 2)) // the view draws back as it cools
      },
    }
  },
}
export default orbit
