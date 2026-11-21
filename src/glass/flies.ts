import * as THREE from 'three'
import type { Spot } from './field'

/** Tuning of the fireflies. Lengths are px, time is seconds. */
export const swarm = {
  count: 24, // must match  uniform vec3 uFlies[24]  in shaders/card.frag
  /** Strength of the aimless wandering. */
  wander: 420,
  /** Pull toward the pointer while it is on the card, and toward each fly's own patch otherwise. */
  chase: 9,
  home: 2.2,
  /** Air resistance: higher = they stop sooner. */
  drag: 1.8,
  /** Each fly keeps this far from the pointer instead of piling onto it. */
  ring: 46,
}

/** Points of light that wander on their own and gather around the pointer. `values` is xy = px from the card centre, z = brightness. */
export function createFlies() {
  const flies = Array.from({ length: swarm.count }, (_, i) => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    homeX: Math.random() * 0.84 - 0.42,
    homeY: Math.random() * 0.84 - 0.42,
    phase: Math.random() * 6.28,
    rate: 0.8 + Math.random() * 1.4,
    angle: (i / swarm.count) * 6.28,
    placed: false,
  }))
  const values = flies.map(() => new THREE.Vector3())

  return {
    values,
    update(dt: number, time: number, pointer: Spot | null, half: Spot) {
      flies.forEach((fly, i) => {
        if (!fly.placed) {
          fly.x = fly.homeX * half[0] * 2
          fly.y = fly.homeY * half[1] * 2
          fly.placed = true
        }
        // Toward a place on a ring around the pointer, or back to its own patch.
        const goalX = pointer ? pointer[0] + Math.cos(fly.angle + time * 0.6) * swarm.ring : fly.homeX * half[0] * 2
        const goalY = pointer ? pointer[1] + Math.sin(fly.angle + time * 0.6) * swarm.ring : fly.homeY * half[1] * 2
        const pull = pointer ? swarm.chase : swarm.home
        const wanderX = Math.sin(time * fly.rate * 1.7 + fly.phase * 3) + Math.sin(time * 0.53 + i)
        const wanderY = Math.cos(time * fly.rate * 1.3 + fly.phase * 5) + Math.sin(time * 0.71 + i * 2)
        fly.vx += ((goalX - fly.x) * pull + wanderX * swarm.wander - fly.vx * swarm.drag) * dt
        fly.vy += ((goalY - fly.y) * pull + wanderY * swarm.wander - fly.vy * swarm.drag) * dt
        fly.x = Math.max(-half[0] + 8, Math.min(half[0] - 8, fly.x + fly.vx * dt))
        fly.y = Math.max(-half[1] + 8, Math.min(half[1] - 8, fly.y + fly.vy * dt))
        const blink = Math.max(0, Math.sin(time * fly.rate + fly.phase))
        values[i].set(fly.x, fly.y, 0.2 + 0.8 * blink * blink)
      })
    },
  }
}
