/**
 * The card as a physical body: it hangs on springs, so it lags behind the finger, leans into
 * its own movement, stretches along its path and wobbles back to rest.
 * Everything here is tuning; lengths are CSS pixels, time is seconds.
 */
export const feel = {
  /** Pull back to the resting place, and how quickly the swing dies out (lower = bouncier). */
  home: { stiffness: 110, damping: 12 },
  /** The same while the card is held by the pointer. */
  held: { stiffness: 380, damping: 26 },
  /** Lean against sideways movement: radians per px/s, and the largest lean. */
  swing: { amount: 0.0004, max: 0.4, stiffness: 90, damping: 9 },
  /** Squash and stretch along the path: stretch per px/s, and the largest stretch. */
  stretch: { amount: 0.00013, max: 0.22, stiffness: 170, damping: 8 },
  /** Lean toward the viewer under the pointer. */
  tilt: { amount: 0.0003, stiffness: 70, damping: 10 },
  /** Slow drift while nothing touches the card: px and radians. */
  idle: { x: 5, y: 8, turn: 0.012, tilt: 0.00007 },
}

class Spring {
  value = 0
  speed = 0
  step(target: number, stiffness: number, damping: number, dt: number) {
    this.speed += ((target - this.value) * stiffness - this.speed * damping) * dt
    this.value += this.speed * dt
  }
}

export function createBody() {
  const x = new Spring()
  const y = new Spring()
  const turn = new Spring()
  const stretchX = new Spring()
  const stretchY = new Spring()
  const tiltX = new Spring()
  const tiltY = new Spring()
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  let held = false
  let grabX = 0
  let grabY = 0

  const body = {
    /** 1 = normal. Higher = looser springs: more overshoot, more stretch (set per variant with `// springs:`). */
    loose: 1,
    /** 0 = rigid, 1 = squashes and stretches along its path (set per variant with `// stretch:`). */
    soft: 0,
    /** Offset of the card from its resting place. */
    x: 0,
    y: 0,
    tilt: [0, 0] as [number, number],
    /** 2×2 matrices as [column 1, column 2]: card → screen and back. */
    toScreen: [1, 0, 0, 1] as [number, number, number, number],
    toCard: [1, 0, 0, 1] as [number, number, number, number],
    /** The card's acceleration in its own frame, px/s²: what makes the liquid slosh. */
    push: [0, 0] as [number, number],
    get held() {
      return held
    },
    /** A screen offset from the card's centre, in the card's own frame. */
    local(dx: number, dy: number): [number, number] {
      const m = body.toCard
      return [m[0] * dx + m[2] * dy, m[1] * dx + m[3] * dy]
    },
    /** Take hold of the card; `dx`, `dy` is the pointer's offset from the resting place. */
    grab(dx: number, dy: number) {
      held = true
      grabX = dx - x.value
      grabY = dy - y.value
    },
    release() {
      held = false
    },
    /**
     * Advance by `dt` seconds. `pointer` is the pointer's offset from the resting place (null when
     * it is away), `over` whether it is on the card, `half` half the card's size.
     */
    update(dt: number, time: number, pointer: [number, number] | null, over: boolean, half: [number, number]) {
      const { home, held: hold, swing, stretch, tilt, idle } = feel
      const drift = still ? 0 : 1
      const speedX = x.speed
      const speedY = y.speed
      const steps = Math.max(1, Math.ceil(dt * 120))
      const h = dt / steps
      for (let i = 0; i < steps; i++) {
        const spring = held ? hold : home
        const targetX = held && pointer ? pointer[0] - grabX : Math.sin(time * 0.6) * idle.x * drift
        const targetY = held && pointer ? pointer[1] - grabY : Math.sin(time * 0.8 + 1) * idle.y * drift
        x.step(targetX, spring.stiffness, spring.damping / body.loose, h)
        y.step(targetY, spring.stiffness, spring.damping / body.loose, h)

        const lean = Math.max(-swing.max, Math.min(swing.max, -x.speed * swing.amount))
        turn.step(lean + Math.sin(time * 0.5) * idle.turn * drift, swing.stiffness, swing.damping / body.loose, h)

        const gain = stretch.amount * Math.sqrt(body.loose) * body.soft
        stretchX.step(x.speed * gain, stretch.stiffness, stretch.damping / body.loose, h)
        stretchY.step(y.speed * gain, stretch.stiffness, stretch.damping / body.loose, h)

        // Under the pointer the near side dips away; otherwise a slow rocking.
        let leanX = Math.sin(time * 0.7) * idle.tilt * drift
        let leanY = Math.cos(time * 0.55) * idle.tilt * drift
        if (pointer && over && !held) {
          const [px, py] = body.local(pointer[0] - x.value, pointer[1] - y.value)
          leanX = (-px / half[0]) * tilt.amount
          leanY = (-py / half[1]) * tilt.amount
        }
        tiltX.step(leanX, tilt.stiffness, tilt.damping, h)
        tiltY.step(leanY, tilt.stiffness, tilt.damping, h)
      }

      body.x = x.value
      body.y = y.value
      body.tilt = [tiltX.value, tiltY.value]

      // Turn, then stretch along the direction of travel (and thin across it, so the area stays).
      const cos = Math.cos(turn.value)
      const sin = Math.sin(turn.value)
      const amount = Math.min(Math.hypot(stretchX.value, stretchY.value), feel.stretch.max)
      const ux = amount > 1e-5 ? stretchX.value / Math.hypot(stretchX.value, stretchY.value) : 1
      const uy = amount > 1e-5 ? stretchY.value / Math.hypot(stretchX.value, stretchY.value) : 0
      const long = 1 + amount
      const thin = 1 / long
      const s00 = thin + (long - thin) * ux * ux
      const s01 = (long - thin) * ux * uy
      const s11 = thin + (long - thin) * uy * uy
      const m00 = s00 * cos + s01 * sin
      const m01 = -s00 * sin + s01 * cos
      const m10 = s01 * cos + s11 * sin
      const m11 = -s01 * sin + s11 * cos
      const det = m00 * m11 - m01 * m10
      body.toScreen = [m00, m10, m01, m11]
      body.toCard = [m11 / det, -m10 / det, -m01 / det, m00 / det]
      body.push = dt > 0 ? body.local((x.speed - speedX) / dt, (y.speed - speedY) / dt) : [0, 0]
    },
  }
  return body
}
