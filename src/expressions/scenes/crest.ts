import { rings, stepped, type Expression } from '../kit'

const crest: Expression = {
  title: 'Crest',
  note: 'Concentric rings of blue light with a single lit sweep. It swings round the centre a quarter turn at a time, its trailing end feathering out, dimming as it passes underneath.',
  order: 2,
  stage: 'light',
  build() {
    const field = rings({ hole: 1.9, gap: 0.36, lobes: 1, deep: '#0a10e8', bright: '#93a8ff', hot: '#aebcff' })
    const look = field.material.uniforms
    return {
      object: field,
      update(time) {
        const turn = Math.PI * 0.62 - stepped(time, 1.3) * (Math.PI / 2) // clockwise: top, right, bottom, left
        look.uTurn.value = turn
        look.uTwist.value = 0.2 + 0.1 * Math.sin(time * 0.8)              // outer rings trail behind: the feathered end
        look.uNarrow.value = 4.5
        look.uPower.value = 0.72 + 0.4 * Math.sin(turn)                    // brightest overhead, dim underneath
      },
    }
  },
}
export default crest
