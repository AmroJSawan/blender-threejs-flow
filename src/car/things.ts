import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

/**
 * The objects on the car screen's rollers. Each is the thing its setting is about, behaving as it does in the world,
 * so the picture says both what the setting is and which way it goes:
 * - temperature is a thermometer: slide up and its column climbs and warms in colour;
 * - fan speed is a fan: swipe across its blades, as you would to spin one by hand, and it turns faster;
 * - volume is a loudspeaker: its cone throws further and the ring of lights round it fills;
 * - the track is a row of record sleeves: flip sideways through them;
 * - seat heat is a seat: its heating bars light one by one.
 * Tall things go up and down; things that spin or flip go sideways.
 *
 * Every maker returns the object and a function that sets it: `at` is the value as a place in its range (0 … count − 1,
 * and it may be between two values while a notch is building), `on` whether its zone is switched on.
 */
export type Thing = { made: THREE.Group; size: [number, number]; set(at: number, on: boolean, passed: number, clock: number): void }
export type Kind = keyof typeof things

const look = {
  plate: { color: '#15181b', roughness: 0.85, metalness: 0 },
  steel: { color: '#aab2b9', roughness: 0.32, metalness: 1 },
  dark: { color: '#2a2f34', roughness: 0.5, metalness: 0.6 },
  rubber: { color: '#0d0f11', roughness: 0.9, metalness: 0 },
  leather: { color: '#30353a', roughness: 0.62, metalness: 0 },
  cold: '#58b4ff',
  mild: '#ffc46b',
  hot: '#ff5a3c',
  lit: '#8fe9c0',
  heat: '#ff6a3c',
  unlit: '#22262a',
}
const solid = (kind: { color: string; roughness: number; metalness: number }) => new THREE.MeshStandardMaterial(kind)
const glowing = (colour: string) => new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.5, roughness: 0.4 })
const share = (at: number, count: number) => THREE.MathUtils.clamp(at / Math.max(count - 1, 1), 0, 1)
const ease = (from: number, to: number, passed: number, speed: number) => from + (to - from) * (1 - Math.exp(-passed * speed))

/** A thermometer on its plate: a glass tube with a bulb, a scale beside it, and a column that climbs and warms. */
function thermometer(count: number): Thing {
  const made = new THREE.Group()
  const plate = new THREE.Mesh(new RoundedBoxGeometry(1.15, 3.1, 0.1, 4, 0.14), solid(look.plate))
  plate.position.z = -0.24
  made.add(plate)
  for (let mark = 0; mark <= 12; mark++) {
    const long = mark % 3 === 0
    const tick = new THREE.Mesh(new THREE.BoxGeometry(long ? 0.26 : 0.15, 0.022, 0.03), solid(look.steel))
    tick.position.set(0.24 + (long ? 0.13 : 0.075), -0.72 + mark * (1.86 / 12), -0.17)
    made.add(tick)
  }
  const liquid = glowing(look.mild)
  const glass = new THREE.MeshPhysicalMaterial({ color: '#e6f0f8', transparent: true, opacity: 0.2, roughness: 0.04, clearcoat: 1, depthWrite: false })
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 1, 20).translate(0, 0.5, 0), liquid)
  column.position.set(-0.14, -0.95, 0)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 24), liquid)
  bulb.position.set(-0.14, -1.08, 0)
  const tube = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 2.0, 8, 24), glass)
  tube.position.set(-0.14, 0.12, 0)
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.31, 32, 24), glass)
  shell.position.copy(bulb.position)
  made.add(column, bulb, tube, shell)
  made.rotation.y = -0.4
  const colour = new THREE.Color()
  return {
    made,
    size: [1.7, 3.3],
    set(at, on) {
      const warm = share(at, count)
      column.scale.y = 0.26 + 1.9 * warm
      colour.set(look.cold).lerp(new THREE.Color(look.mild), Math.min(warm * 2, 1)).lerp(new THREE.Color(look.hot), Math.max(warm * 2 - 1, 0))
      if (!on) colour.lerp(new THREE.Color('#5a6066'), 0.85)
      liquid.color.copy(colour)
      liquid.emissive.copy(colour)
    },
  }
}

/** A fan in its ring. It turns the way it is swiped, and faster with every notch. */
function fan(count: number): Thing {
  const made = new THREE.Group()
  made.add(new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.085, 20, 72), solid(look.dark)))
  const back = new THREE.Mesh(new THREE.CircleGeometry(1.06, 64), solid(look.rubber))
  back.position.z = -0.3
  made.add(back)
  const rotor = new THREE.Group()
  const outline = new THREE.Shape()
  outline.moveTo(0.2, -0.08)
  outline.bezierCurveTo(0.5, -0.36, 0.9, -0.26, 0.95, 0.04)
  outline.bezierCurveTo(0.92, 0.3, 0.5, 0.2, 0.2, 0.08)
  const blade = new THREE.ExtrudeGeometry(outline, { depth: 0.03, bevelEnabled: false, curveSegments: 16 })
  for (let index = 0; index < 7; index++) {
    const arm = new THREE.Group()
    arm.rotation.z = (index * Math.PI * 2) / 7
    const leaf = new THREE.Mesh(blade, solid(look.steel))
    leaf.rotation.x = 0.5 // pitched, as a blade that moves air is
    arm.add(leaf)
    rotor.add(arm)
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.26, 32).rotateX(Math.PI / 2), solid(look.dark))
  rotor.add(hub)
  made.add(rotor)
  made.rotation.set(-0.3, 0.32, 0)
  let speed = 0
  return {
    made,
    size: [2.5, 2.5],
    set(at, on, passed) {
      speed = ease(speed, on ? share(Math.round(at), count) * 15 : 0, passed, 3)
      rotor.rotation.z -= speed * passed
    },
  }
}

/** A loudspeaker. Its cone throws further the louder it is set, and the ring of lights round it fills. */
function speaker(count: number): Thing {
  const made = new THREE.Group()
  made.add(new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 20, 72), solid(look.dark)))
  const moving = new THREE.Group()
  const cone = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.24, -0.42), new THREE.Vector2(0.52, -0.2), new THREE.Vector2(0.84, -0.02)], 64).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#33393f', roughness: 0.7, side: THREE.DoubleSide }))
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), solid(look.dark))
  cap.position.z = -0.44
  moving.add(cone, cap)
  made.add(moving, new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.07, 16, 72), solid(look.rubber)))
  const lights = Array.from({ length: count - 1 }, (_, index) => {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), glowing(look.unlit))
    const angle = Math.PI * 1.25 - (index / (count - 2)) * Math.PI * 1.5 // from lower left, over the top, to lower right
    light.position.set(Math.cos(angle) * 1.24, Math.sin(angle) * 1.24, 0)
    made.add(light)
    return light.material as THREE.MeshStandardMaterial
  })
  made.rotation.set(-0.12, -0.3, 0)
  return {
    made,
    size: [2.8, 2.8],
    set(at, on, _passed, clock) {
      const loud = on ? share(at, count) : 0
      moving.position.z = Math.sin(clock * Math.PI * 2 * 2.4) * 0.09 * loud
      lights.forEach((light, index) => {
        const lit = on && index < Math.round(at)
        light.color.set(lit ? look.lit : look.unlit)
        light.emissive.set(lit ? look.lit : '#000000')
      })
    },
  }
}

/** Record sleeves in a row. The one in front is playing; the others wait at an angle either side, to be flipped to. */
function records(count: number): Thing {
  const made = new THREE.Group()
  const sleeves = Array.from({ length: count }, (_, index) => {
    const paper = document.createElement('canvas')
    paper.width = paper.height = 256
    const pen = paper.getContext('2d')!
    const wash = pen.createLinearGradient(0, 0, 256, 256)
    const hue = (index * 67 + 20) % 360
    wash.addColorStop(0, `hsl(${hue} 62% 62%)`)
    wash.addColorStop(1, `hsl(${(hue + 80) % 360} 55% 28%)`)
    pen.fillStyle = wash
    pen.fillRect(0, 0, 256, 256)
    pen.fillStyle = 'rgba(255,255,255,0.85)'
    pen.beginPath()
    pen.arc(128, 128, 30 + index * 9, 0, Math.PI * 2)
    pen.fill()
    const picture = new THREE.CanvasTexture(paper)
    picture.colorSpace = THREE.SRGBColorSpace
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.05), new THREE.MeshStandardMaterial({ map: picture, roughness: 0.55 }))
    made.add(sleeve)
    return sleeve
  })
  return {
    made,
    size: [3.9, 1.9],
    set(at, on) {
      sleeves.forEach((sleeve, index) => {
        const away = index - at
        const near = THREE.MathUtils.clamp(away, -1, 1)
        sleeve.position.set(near * 1.0 + (away - near) * 0.3, 0, -Math.abs(near) * 0.55 - Math.abs(away - near) * 0.05)
        sleeve.rotation.y = -near * 1.05
        ;(sleeve.material as THREE.MeshStandardMaterial).color.setScalar(on ? 1 - Math.min(Math.abs(away), 1) * 0.5 : 0.35)
      })
    },
  }
}

/** A seat. Its heating bars, across the cushion and up the back, light one by one. */
function seat(count: number): Thing {
  const made = new THREE.Group()
  const cushion = new THREE.Mesh(new RoundedBoxGeometry(1.35, 0.36, 1.25, 5, 0.15), solid(look.leather))
  cushion.position.set(0, -0.72, 0.1)
  const back = new THREE.Group()
  back.add(new THREE.Mesh(new RoundedBoxGeometry(1.35, 1.7, 0.34, 5, 0.15), solid(look.leather)))
  back.position.set(0, 0.2, -0.52)
  back.rotation.x = -0.2
  const rest = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.36, 0.26, 5, 0.12), solid(look.leather))
  rest.position.set(0, 1.28, -0.72)
  made.add(cushion, back, rest)
  const bars = Array.from({ length: count - 1 }, (_, level) => {
    const metal = glowing(look.unlit)
    const onBack = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.09, 0.05, 2, 0.02), metal)
    onBack.position.set(0, -0.5 + level * 0.42, 0.18)
    back.add(onBack)
    const onCushion = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.05, 0.09, 2, 0.02), metal)
    onCushion.position.set(0, 0.19, 0.4 - level * 0.34)
    cushion.add(onCushion)
    return metal
  })
  made.rotation.set(0.12, 0.62, 0)
  return {
    made,
    size: [2.3, 2.9],
    set(at, on) {
      bars.forEach((bar, level) => {
        const lit = on && level < Math.round(at)
        bar.color.set(lit ? look.heat : look.unlit)
        bar.emissive.set(lit ? look.heat : '#000000')
      })
    },
  }
}

export const things = { thermometer, fan, speaker, records, seat }
