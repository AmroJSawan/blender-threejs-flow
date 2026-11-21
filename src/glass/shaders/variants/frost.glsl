// title: Frost
// note: Even frosted glass: the same soft blur everywhere, a little milk and speckle, a thin polished rim.
// order: 2
#define BLUR 18.0    // blur radius, px
#define MILK 0.1     // 0 = clear, 1 = white
#define GRAIN 0.04

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, 12.0);
  look.slope = -edge.yz * 0.7 * edge.x;
  look.blur = BLUR;
  look.milk = MILK;
  look.grain = GRAIN;
}
