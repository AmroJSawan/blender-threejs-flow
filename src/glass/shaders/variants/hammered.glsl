// title: Hammered
// note: Dimpled bathroom glass. Random soft dents each bend the picture their own way.
// order: 7
#define DENT 34.0    // size of a dent, px
#define DEPTH 0.55   // how steep the dents are

float dents(vec2 q) { return noise(q) + 0.45 * noise(q * 2.3 + 7.0); }

void glass(vec2 p, vec2 uv, inout Look look) {
  vec2 q = p / DENT;
  float e = 0.12;
  vec2 lean = vec2(dents(q + vec2(e, 0.0)) - dents(q - vec2(e, 0.0)), dents(q + vec2(0.0, e)) - dents(q - vec2(0.0, e))) / (2.0 * e);
  vec3 edge = rim(p, 12.0);
  look.slope = lean * DEPTH - edge.yz * 0.7 * edge.x;
  look.depth = 44.0;
  look.blur = 1.5;
  look.split = 0.1;
}
