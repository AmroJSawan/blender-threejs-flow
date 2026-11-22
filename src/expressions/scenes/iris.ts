import { rings, stepped, type Expression } from '../kit'

const iris: Expression = {
  title: 'Iris',
  note: 'Concentric rings of violet light round a dark disc. Two opposite lit zones turn round it pose to pose, narrowing to crescents and opening out again, warming to peach at the far edge.',
  order: 1,
  stage: 'light',
  build() {
    const field = rings({ hole: 1.75, gap: 0.42, lobes: 2, deep: '#3a08c8', bright: '#b56cff', hot: '#ff9f7a' })
    const look = field.material.uniforms
    return {
      object: field,
      update(time) {
        look.uTurn.value = 0.9 + stepped(time, 1.5) * (Math.PI / 3)      // a sixth of a turn at a time
        look.uTwist.value = 0.3 * Math.sin(time * 0.7)                     // outer rings lag, then lead: the zones bend into crescents
        look.uNarrow.value = 1.5 + 1.3 * (0.5 + 0.5 * Math.sin(time * 0.9)) // wide wash … narrow crescents
        look.uPower.value = 0.85 + 0.15 * Math.sin(time * 1.3)
      },
    }
  },
}
export default iris
