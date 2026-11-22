import * as THREE from 'three'

/**
 * What every expression is made from. An expression is one small animated 3D scene
 * (src/expressions/scenes/*.ts): it says which stage it plays on and builds its objects.
 */
export type Stage = 'light' | 'clay' | 'ember'
export type Expression = {
  title: string
  note: string
  order: number
  /** light = glowing shapes on black; clay = matt grey shapes in a soft studio; ember = shapes glowing orange and red in the dark. */
  stage: Stage
  /** Builds the scene. `update` is called every frame with the time in seconds. */
  build(): { object: THREE.Object3D; update(time: number): void }
}

// ---- Light: a glowing arc -----------------------------------------------------------------------
type Band = {
  inner: number
  outer: number
  /** Where the arc starts and how far round it runs, radians. */
  start?: number
  length?: number
  /** Colour at the bright edge and at the faint one. */
  bright: THREE.ColorRepresentation
  faint: THREE.ColorRepresentation
  power?: number
  /** Which edge is the bright one: 1 = the outer edge, -1 = the inner. */
  side?: 1 | -1
}
/** A flat arc of light: one edge crisp and bright, fading to nothing toward the other edge and toward both ends. */
export function band({ inner, outer, start = 0, length = Math.PI * 2, bright, faint, power = 1, side = 1 }: Band): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uInner: { value: inner },
      uOuter: { value: outer },
      uStart: { value: start },
      uLength: { value: length },
      uBright: { value: new THREE.Color(bright) },
      uFaint: { value: new THREE.Color(faint) },
      uPower: { value: power },
      uSide: { value: side },
    },
    vertexShader: /* glsl */ `
      varying vec2 vAt;
      void main() {
        vAt = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vAt;
      uniform float uInner, uOuter, uStart, uLength, uPower, uSide;
      uniform vec3 uBright, uFaint;
      void main() {
        float across = clamp((length(vAt) - uInner) / (uOuter - uInner), 0.0, 1.0);
        if (uSide < 0.0) across = 1.0 - across;
        float along = mod(atan(vAt.y, vAt.x) - uStart, 6.2831853) / uLength;
        float ends = uLength > 6.2 ? 1.0 : pow(sin(3.14159 * clamp(along, 0.0, 1.0)), 0.9);
        float glow = pow(across, 2.2) * smoothstep(1.0, 0.9, across); // rises to the bright edge, then stops cleanly
        gl_FragColor = vec4(mix(uFaint, uBright, pow(across, 3.0)) * glow * ends * uPower, 1.0);
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    transparent: true,
  })
  return new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128, 1, start, length), material)
}

// ---- Light: a field of concentric rings ------------------------------------------------------------
type Rings = {
  /** Radius of the dark middle, and the distance from one ring to the next. */
  hole: number
  gap: number
  /** How many lit zones go round the field (1 = one sweep, 2 = two opposite ones). */
  lobes: 1 | 2
  /** 0 = true circles. A whole number turns them into that many spiral arms. */
  arms?: number
  /** Colour between rings, on a ring's bright edge, and where the light is strongest far from the middle. */
  deep: THREE.ColorRepresentation
  bright: THREE.ColorRepresentation
  hot: THREE.ColorRepresentation
}
/**
 * One flat field of rings that all share exactly one centre. Only part of the field is lit: a zone
 * that can be turned round the centre (`uTurn`), sheared so outer rings lag behind inner ones
 * (`uTwist`), made narrower (`uNarrow`) and dimmed (`uPower`). The mesh's material holds those.
 */
export function rings({ hole, gap, lobes, arms = 0, deep, bright, hot }: Rings): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uHole: { value: hole },
      uGap: { value: gap },
      uLobes: { value: lobes },
      uArms: { value: arms },
      uDeep: { value: new THREE.Color(deep) },
      uBright: { value: new THREE.Color(bright) },
      uHot: { value: new THREE.Color(hot) },
      uTurn: { value: 0 },
      uTwist: { value: 0 },
      uNarrow: { value: 1.5 },
      uPower: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vAt;
      void main() {
        vAt = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vAt;
      uniform float uHole, uGap, uLobes, uArms, uTurn, uTwist, uNarrow, uPower;
      uniform vec3 uDeep, uBright, uHot;
      void main() {
        float r = length(vAt);
        float a = atan(vAt.y, vAt.x);
        float out_ = max(r - uHole, 0.0);
        float lane = fract(out_ / uGap - uArms * a / 6.2831853);          // 0 … 1 from one ring to the next
        float ring = pow(lane, 2.4) * smoothstep(1.0, 0.86, lane);         // rises to a bright edge, then stops cleanly
        float zone = pow(0.5 + 0.5 * cos(uLobes * (a - uTurn - uTwist * out_)), uNarrow);
        float edge = smoothstep(0.0, 0.5, out_) * smoothstep(7.0, 3.6, r); // out of the dark middle, and away at the far edge
        float far = smoothstep(1.2, 4.2, out_);
        vec3 colour = mix(uDeep, uBright, ring) * (0.42 + 0.9 * ring) + uHot * far * zone * (0.25 + 0.75 * ring);
        gl_FragColor = vec4(colour * zone * edge * uPower, 1.0);
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
  return new THREE.Mesh(new THREE.PlaneGeometry(15, 15), material)
}

/**
 * Time that moves in eased steps, for motion that goes pose to pose: it counts up by 1 every
 * `every` seconds, spending the first `hold` share of each step at rest.
 */
export function stepped(time: number, every: number, hold = 0.35): number {
  const count = Math.floor(time / every)
  const moving = Math.min(Math.max((time / every - count - hold) / (1 - hold), 0), 1)
  return count + moving * moving * (3 - 2 * moving)
}

/**
 * A value read off a list of keyframes, [seconds, value], in order: straight lines between them,
 * held before the first and after the last. For motion copied from a reference, frame by frame.
 */
export function keyed(time: number, keys: [number, number][]): number {
  if (time <= keys[0][0]) return keys[0][1]
  for (let index = 1; index < keys.length; index++) {
    const [at, value] = keys[index]
    if (time <= at) {
      const [before, from] = keys[index - 1]
      return from + ((value - from) * (time - before)) / (at - before)
    }
  }
  return keys[keys.length - 1][1]
}

// ---- Clay: matt grey, lit by the stage's soft light ---------------------------------------------
export function clay(shade = 0.72): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(shade, shade, shade), roughness: 0.82, metalness: 0 })
}
/** Marks everything in a group as casting and receiving shadows. */
export function shadowed<T extends THREE.Object3D>(object: T): T {
  object.traverse((part) => {
    part.castShadow = true
    part.receiveShadow = true
  })
  return object
}
/** A thick slice of a ring: a curved slab `tall` high, from radius `inner` to `outer`, `angle` radians round. */
export function arcSlab(inner: number, outer: number, angle: number, tall: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  shape.absarc(0, 0, outer, 0, angle, false)
  shape.absarc(0, 0, inner, angle, 0, true)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: tall, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 64 })
  geometry.translate(0, 0, -tall / 2)
  return geometry
}

// ---- Ember: a shape that glows hot at one end and cools to dark at the other ---------------------
type Ember = {
  hot: THREE.ColorRepresentation
  warm?: THREE.ColorRepresentation
  /** The local axis the heat runs along, and where along it the shape is hottest and where it has gone dark. */
  axis?: 'x' | 'y' | 'z'
  from: number
  to: number
  /** How bright the unheated body is. */
  body?: number
}
export function ember({ hot, warm = hot, axis = 'y', from, to, body = 0.016 }: Ember): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uHot: { value: new THREE.Color(hot) },
      uWarm: { value: new THREE.Color(warm) },
      uAxis: { value: new THREE.Vector3(Number(axis === 'x'), Number(axis === 'y'), Number(axis === 'z')) },
      uFrom: { value: from },
      uTo: { value: to },
      uBody: { value: body },
      uHeat: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPlace;
      varying vec3 vNormal;
      varying vec3 vToEye;
      void main() {
        vPlace = position;
        vec4 seen = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalMatrix * normal;
        vToEye = -seen.xyz;
        gl_Position = projectionMatrix * seen;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vPlace;
      varying vec3 vNormal;
      varying vec3 vToEye;
      uniform vec3 uHot, uWarm, uAxis;
      uniform float uFrom, uTo, uBody, uHeat;
      void main() {
        vec3 n = normalize(vNormal);
        float along = clamp((dot(vPlace, uAxis) - uTo) / (uFrom - uTo), 0.0, 1.0); // 0 where it has gone dark … 1 where it is hottest
        float heat = along * along * (3.0 - 2.0 * along) * uHeat;
        float facing = 0.62 + 0.38 * clamp(dot(n, normalize(vec3(-0.4, 0.75, 0.55))), 0.0, 1.0); // faces differ a little, so the shape reads
        float rim = pow(1.0 - clamp(dot(n, normalize(vToEye)), 0.0, 1.0), 3.0);
        vec3 glow = mix(uWarm, uHot, heat) * heat * heat * facing;
        vec3 colour = (vec3(uBody) * (0.5 + facing) + vec3(0.035) * rim) * (1.0 - 0.8 * heat) + glow;
        gl_FragColor = vec4(colour, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}
