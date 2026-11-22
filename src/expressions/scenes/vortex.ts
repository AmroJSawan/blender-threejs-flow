import { rings, stepped, type Expression } from '../kit'

const vortex: Expression = {
  title: 'Vortex',
  note: 'Concentric violet crescents with peach edges, lit in two opposite zones that bend into an S. They turn a quarter at a time, flaring bright at each pose and fading almost to nothing between.',
  order: 3,
  stage: 'light',
  build() {
    const field = rings({ hole: 0.45, gap: 0.6, lobes: 2, deep: '#5a0cd8', bright: '#c66cff', hot: '#ffa07a' })
    const look = field.material.uniforms
    return {
      object: field,
      update(time) {
        const pose = stepped(time, 1.6, 0.2)
        look.uTurn.value = pose * (Math.PI / 2)
        look.uTwist.value = 0.55 * Math.sin(time * 0.55 + 0.9) // outer rings lag one way, then the other: the two lit zones bend into an S and back
        look.uNarrow.value = 3.6
        look.uPower.value = 0.1 + 0.9 * (0.5 + 0.5 * Math.cos((time / 1.6) * Math.PI * 2)) // flares at each pose, fades between
      },
    }
  },
}
export default vortex
