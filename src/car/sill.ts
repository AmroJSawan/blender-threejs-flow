import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

/**
 * The sill: the lower part of the car screen, drawn as one slab of dark machined metal seen from a little above, in real 3D
 * and lit by a soft room. Nothing on it is a picture of an old control. Its settings are shapes cut into the slab, and they move:
 * - temperature is a knurled roller lying in a slot, turning one ridge per notch, its end bands coloured like heated metal;
 * - the fan is a field of waves milled across the surface, taller and faster with every notch;
 * - volume is rings turned into the metal round a point, spreading further the louder it is;
 * - the track is a row of dimples with a polished ball resting in the one that is playing;
 * - seat heat is three slots that glow from inside, one more with each level.
 * The slab itself is a single flat sheet: its relief is worked out for every pixel from one height function (below), which gives
 * the light its direction, darkens the hollows, and dips under a finger. The roller and the ball are real shapes standing in it.
 */
export const kinds = { column: 0, rings: 1, air: 0, points: 1, element: 2 } as const
export type Rising = 'column' | 'rings'
export type Crossing = 'air' | 'points' | 'element'

export const look = {
  /** The camera: lens angle, and how steeply it looks down on the slab (degrees from level). */
  lens: 14,
  down: 56,
  /** The slab: its colour, how rough, how brushed (0–1, the grain runs across the screen), and how brightly the room lights it. */
  metal: '#262a2f',
  rough: 0.4,
  brushed: 0.6,
  room: 1.0,
  lamp: 1.6,
  /** How much darker the hollows are, and how far everything away from the setting being changed dims (0 = not at all). */
  hollows: 1.7,
  aside: 0.62,
  /** The roller, the ball, the colours of heat from cold to hot, and the glow in the seat's slots. */
  roller: { colour: '#30353b', rough: 0.34, ridges: 36, knurl: 2.2 },
  ball: { colour: '#e3e8ec', rough: 0.07 },
  heat: ['#3f9dff', '#f0a94e', '#ff5236'],
  glow: '#ff6a3c',
  exposure: 1.05,
}

/** What the page tells the sill each frame. Places are in px from the screen's top left. */
export type Bay = {
  left: number
  right: number
  on: number // 0–1: how much the bay is switched on
  rise: { kind: Rising; part: number; turned: number; busy: number } // part: how full (0–1); turned: notches turned in all
  cross: { kind: Crossing; place: number; busy: number; flow: number }
}
export type Frame = { wide: number; tall: number; top: number; bottom: number; bays: Bay[]; fingers: { x: number; y: number; press: number }[]; clock: number; focus: { x: number; y: number; amount: number } }

const relief = /* glsl */ `
  uniform vec4 uRise[3], uRiseMore[3], uCross[3], uCrossMore[3], uFinger[2], uFocus;
  uniform float uUnit, uTime, uHollows;
  uniform vec3 uGlow;
  varying vec3 vSill;
  float hill(vec2 away, float wide) { return exp(-dot(away, away) / (wide * wide)); }
  float slab(vec2 away, vec2 half_, float corner) {
    vec2 d = abs(away) - half_ + corner;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - corner;
  }
  // How far the metal stands above (+) or is cut below (−) the slab's face at a point, in the slab's own units.
  float sillHeight(vec2 p) {
    float U = uUnit;
    float h = 0.0;
    for (int i = 0; i < 3; i++) {
      vec2 a = p - uRise[i].xy;
      float on = uRiseMore[i].y;
      if (uRise[i].w < 0.5) {
        // The slot the roller lies in.
        h -= 0.5 * U * smoothstep(0.05 * U, -0.1 * U, slab(a, vec2(0.66, 0.37) * U, 0.12 * U));
      } else {
        // Rings turned round a point: they reach further the louder it is, and drift outward while it plays.
        float far = length(a);
        float reach = (0.3 + 0.75 * uRise[i].z) * U;
        float rings = cos(6.2831853 * far / (0.15 * U) - uTime * 1.3 * on);
        h += 0.022 * U * (0.45 + 0.55 * uRise[i].z) * rings * smoothstep(reach + 0.08 * U, reach - 0.22 * U, far) * smoothstep(0.06 * U, 0.2 * U, far);
        h -= 0.05 * U * hill(a, 0.1 * U);
      }
      vec2 b = p - uCross[i].xy;
      if (uCross[i].w < 0.5) {
        // Air: waves milled across the bay, taller with every notch, moving the way the air goes.
        float bed = smoothstep(1.3 * U, 0.85 * U, abs(b.x)) * smoothstep(0.82 * U, 0.42 * U, abs(b.y));
        float level = clamp(uCross[i].z / 7.0, 0.0, 1.0);
        float wave = sin(6.2831853 * (b.x / (0.46 * U) - uCrossMore[i].y) + sin(b.y * 5.0 / U + b.x * 1.3 / U) * 1.25);
        h += 0.052 * U * (0.14 + 0.86 * level * on) * wave * bed;
      } else if (uCross[i].w < 1.5) {
        // A dimple for each track.
        for (int k = 0; k < 5; k++) h -= 0.085 * U * hill(b - vec2((float(k) - 2.0) * 0.42 * U, 0.0), 0.14 * U);
      } else {
        // Three slots for the seat's heat.
        for (int j = 0; j < 3; j++)
          h -= 0.075 * U * smoothstep(0.065 * U, 0.02 * U, abs(b.y - (float(j) - 1.0) * 0.3 * U)) * smoothstep(0.78 * U, 0.68 * U, abs(b.x));
      }
    }
    // The slab gives a little under a finger.
    for (int f = 0; f < 2; f++) h -= 0.035 * U * uFinger[f].z * hill(p - uFinger[f].xy, 0.42 * U);
    return h;
  }
  // Light from inside the metal: the seat's slots glow, one more with each level.
  vec3 sillGlow(vec2 p) {
    float U = uUnit;
    vec3 glow = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      if (uCross[i].w < 1.5) continue;
      vec2 b = p - uCross[i].xy;
      for (int j = 0; j < 3; j++) {
        float lit = smoothstep(float(j) + 0.3, float(j) + 0.95, uCross[i].z) * uRiseMore[i].y;
        glow += uGlow * lit * smoothstep(0.05 * U, 0.0, abs(b.y - (float(j) - 1.0) * 0.3 * U)) * smoothstep(0.74 * U, 0.62 * U, abs(b.x)) * 1.6;
      }
    }
    return glow;
  }
  // While one setting is being changed, the slab away from it falls back.
  float sillFocus(vec2 p) { return mix(1.0, mix(1.0 - uFocus.w, 1.0, hill(p - uFocus.xy, 1.9 * uUnit)), uFocus.z); }
`

export function makeSill(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = look.exposure
  renderer.autoClear = false
  const scene = new THREE.Scene()
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.03).texture
  scene.environmentIntensity = look.room
  const lamp = new THREE.DirectionalLight('#ffffff', look.lamp) // a long soft lamp to the left and behind, so the relief reads
  lamp.position.set(-6, 5, -3)
  scene.add(lamp)
  const camera = new THREE.PerspectiveCamera(look.lens, 1, 0.1, 200)
  const tilt = (look.down * Math.PI) / 180
  camera.position.set(0, Math.sin(tilt) * 14, Math.cos(tilt) * 14)
  camera.lookAt(0, 0, 0)

  const three = <T>(make: () => T) => [make(), make(), make()]
  const uniforms = {
    uRise: { value: three(() => new THREE.Vector4()) }, // where the rising setting is on the slab (x, z), how full, which kind
    uRiseMore: { value: three(() => new THREE.Vector4()) }, // how much it is being changed, how much the bay is switched on
    uCross: { value: three(() => new THREE.Vector4()) }, // where the crossing setting is (x, z), its place, which kind
    uCrossMore: { value: three(() => new THREE.Vector4()) }, // how much it is being changed, how far its air has flowed
    uFinger: { value: [0, 1].map(() => new THREE.Vector4()) },
    uFocus: { value: new THREE.Vector4(0, 0, 0, look.aside) },
    uUnit: { value: 1 },
    uTime: { value: 0 },
    uHollows: { value: look.hollows },
    uGlow: { value: new THREE.Color(look.glow) },
  }
  const metal = new THREE.MeshPhysicalMaterial({ color: look.metal, metalness: 1, roughness: look.rough, anisotropy: look.brushed })
  metal.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSill;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSill = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${relief}`)
      // The hollows are darker, and the slab away from what is being changed falls back.
      .replace('#include <color_fragment>', `#include <color_fragment>\nfloat sillAt = sillHeight(vSill.xz);\ndiffuseColor.rgb *= (1.0 + clamp(sillAt / uUnit * uHollows, -0.8, 0.12)) * sillFocus(vSill.xz);`)
      // The light falls across the relief: the slab's direction at each pixel comes from the slope of its height.
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>\nfloat sillStep = uUnit * 0.012;\nvec3 sillUp = normalize(vec3(sillAt - sillHeight(vSill.xz + vec2(sillStep, 0.0)), sillStep, sillAt - sillHeight(vSill.xz + vec2(0.0, sillStep))));\nnormal = normalize((viewMatrix * vec4(sillUp, 0.0)).xyz);`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += sillGlow(vSill.xz) * sillFocus(vSill.xz);')
  }
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), metal)
  scene.add(sheet)

  // The roller's knurling: a diamond pattern, used as fine relief on its surface.
  const pattern = document.createElement('canvas')
  pattern.width = pattern.height = 64
  const pen = pattern.getContext('2d')!
  const dots = pen.createImageData(64, 64)
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const diamond = Math.max(Math.abs(((x + y) % 32) / 16 - 1), Math.abs((((x - y) % 32) + 32) % 32 / 16 - 1)) // 0 in a groove … 1 on a crest
      dots.data.set([diamond * 255, diamond * 255, diamond * 255, 255], (y * 64 + x) * 4)
    }
  pen.putImageData(dots, 0, 0)
  const knurl = new THREE.CanvasTexture(pattern)
  knurl.wrapS = knurl.wrapT = THREE.RepeatWrapping
  knurl.repeat.set(look.roller.ridges / 2, 7)
  knurl.anisotropy = 8

  const heat = look.heat.map((colour) => new THREE.Color(colour))
  const parts = three(() => {
    const roller = new THREE.Group()
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true).rotateZ(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: look.roller.colour, metalness: 1, roughness: look.roller.rough, bumpMap: knurl, bumpScale: look.roller.knurl }))
    const band = new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.85, roughness: 0.3 })
    const ends = [-1, 1].map((side) => {
      const end = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.05, 96).rotateZ(Math.PI / 2), band)
      end.position.x = side * 0.525
      return end
    })
    roller.add(barrel, ...ends)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshPhysicalMaterial({ color: look.ball.colour, metalness: 1, roughness: look.ball.rough }))
    scene.add(roller, ball)
    return { roller, barrel, band, ball }
  })

  const ray = new THREE.Raycaster()
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const hit = new THREE.Vector3()
  const tint = new THREE.Color()
  return {
    paint(frame: Frame) {
      const ratio = Math.min(devicePixelRatio, 2)
      if (canvas.width !== Math.round(frame.wide * ratio) || canvas.height !== Math.round(frame.tall * ratio)) {
        renderer.setPixelRatio(ratio)
        renderer.setSize(frame.wide, frame.tall, false)
      }
      const high = frame.bottom - frame.top
      renderer.setScissorTest(false)
      renderer.clear()
      if (high < 8) return
      renderer.setViewport(0, frame.tall - frame.bottom, frame.wide, high)
      renderer.setScissor(0, frame.tall - frame.bottom, frame.wide, high)
      renderer.setScissorTest(true)
      camera.aspect = frame.wide / high
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
      /** Where on the slab a place on the screen is. */
      const at = (x: number, y: number) => {
        ray.setFromCamera(new THREE.Vector2((x / frame.wide) * 2 - 1, 1 - ((y - frame.top) / high) * 2), camera)
        ray.ray.intersectPlane(floor, hit)
        return hit.clone()
      }
      const middle = frame.top + high * 0.46
      const unit = Math.abs(at(frame.wide / 2, frame.top + high * 0.1).z - at(frame.wide / 2, frame.bottom - high * 0.1).z) * 0.36 // the size everything on the slab is measured in
      uniforms.uUnit.value = unit
      uniforms.uTime.value = frame.clock
      frame.bays.forEach((bay, index) => {
        const wide = bay.right - bay.left
        const rise = at(bay.left + wide * 0.26, middle)
        const cross = at(bay.left + wide * 0.72, middle)
        uniforms.uRise.value[index].set(rise.x, rise.z, bay.rise.part, kinds[bay.rise.kind])
        uniforms.uRiseMore.value[index].set(bay.rise.busy, bay.on, 0, 0)
        uniforms.uCross.value[index].set(cross.x, cross.z, bay.cross.place, kinds[bay.cross.kind])
        uniforms.uCrossMore.value[index].set(bay.cross.busy, bay.cross.flow, 0, 0)
        const { roller, barrel, band, ball } = parts[index]
        roller.visible = bay.rise.kind === 'column'
        if (roller.visible) {
          // The roller lies in its slot, a little more than half of it below the slab's face, and turns one ridge per notch.
          roller.position.set(rise.x, -0.05 * unit, rise.z)
          roller.scale.set(1.14 * unit, 0.31 * unit, 0.31 * unit)
          barrel.rotation.x = -bay.rise.turned * ((Math.PI * 2) / look.roller.ridges)
          tint.copy(heat[0]).lerp(heat[1], Math.min(bay.rise.part * 2, 1)).lerp(heat[2], Math.max(bay.rise.part * 2 - 1, 0))
          band.color.copy(tint).lerp(new THREE.Color('#70767c'), 1 - bay.on)
          band.emissive.copy(tint).multiplyScalar(0.22 * bay.on)
        }
        ball.visible = bay.cross.kind === 'points'
        if (ball.visible) {
          ball.position.set(cross.x + (bay.cross.place - 2) * 0.42 * unit, 0.035 * unit, cross.z)
          ball.scale.setScalar(0.105 * unit)
        }
      })
      frame.fingers.forEach((finger, slot) => {
        const where = at(finger.x, finger.y)
        uniforms.uFinger.value[slot].set(where.x, where.z, finger.press, 0)
      })
      for (let slot = frame.fingers.length; slot < 2; slot++) uniforms.uFinger.value[slot].z = 0
      const focus = at(frame.focus.x, frame.focus.y)
      uniforms.uFocus.value.set(focus.x, focus.z, frame.focus.amount, look.aside)
      renderer.render(scene, camera)
    },
  }
}
