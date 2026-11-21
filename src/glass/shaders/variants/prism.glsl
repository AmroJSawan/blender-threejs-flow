// title: Prism
// note: A wedge of glass. The picture slides sideways and its colours pull apart, more and more toward the lower right corner.
// order: 5
#define WEDGE vec2(0.62, -0.34)  // lean of the wedge
#define SPLIT 0.5                // colour split, as a share of the slide

void glass(vec2 p, vec2 uv, inout Look look) {
  float grow = smoothstep(0.1, 1.0, (uv.x + 1.0 - uv.y) * 0.5);
  vec3 edge = rim(p, 16.0);
  look.slope = WEDGE * grow - edge.yz * 0.6 * edge.x;
  look.depth = 60.0;
  look.split = SPLIT;
}
