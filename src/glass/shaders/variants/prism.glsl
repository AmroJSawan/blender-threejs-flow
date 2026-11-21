// title: Prism
// note: A rigid wedge of glass. The picture slides and its colours pull apart, growing toward the lower right. Lean it with the pointer and the angle changes, so the spectrum swings.
// order: 5
// springs: 0.7
#define WEDGE vec2(0.62, -0.34)  // lean of the wedge
#define SPLIT 0.5                // colour split, as a share of the slide
#define SWING 2200.0             // how much leaning the card turns the wedge

void glass(vec2 p, vec2 uv, inout Look look) {
  float grow = smoothstep(0.1, 1.0, (uv.x + 1.0 - uv.y) * 0.5);
  vec3 edge = rim(p, 16.0);
  look.slope = (WEDGE + uTilt * SWING) * grow - edge.yz * 0.6 * edge.x;
  look.depth = 60.0;
  look.split = SPLIT;
}
