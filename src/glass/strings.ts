/** Tuning of the ribs of the fluted glass, which ring like the strings of a harp when the pointer crosses them. */
export const harp = {
  /** Width of one rib, px. */
  rib: 22,
  /** How hard a crossing pointer plucks: px/s of string speed per px of pointer travel. */
  pluck: 55,
  /** Pitch (higher = faster ringing) and how quickly a rib falls silent. */
  stiffness: 1500,
  damping: 3.2,
  /** How much a ringing rib drags its neighbours along. */
  coupling: 160,
  /** Furthest a rib can swing, as a share of its width. */
  reach: 0.4,
}

/** A row of strings, each on its own spring. `values` holds how far each is from rest, in px. */
export function createStrings(count: number) {
  const values = new Array<number>(count).fill(0)
  const speeds = new Array<number>(count).fill(0)
  return {
    values,
    pluck(index: number, travel: number) {
      if (index >= 0 && index < count) speeds[index] += travel * harp.pluck
    },
    update(dt: number) {
      const steps = Math.max(1, Math.ceil(dt * 240))
      const h = dt / steps
      const most = harp.rib * harp.reach
      for (let step = 0; step < steps; step++) {
        for (let i = 0; i < count; i++) {
          const neighbours = (values[i - 1] ?? 0) + (values[i + 1] ?? 0) - 2 * values[i]
          speeds[i] += (-values[i] * harp.stiffness + neighbours * harp.coupling - speeds[i] * harp.damping) * h
        }
        for (let i = 0; i < count; i++) values[i] = Math.max(-most, Math.min(most, values[i] + speeds[i] * h))
      }
    },
  }
}
