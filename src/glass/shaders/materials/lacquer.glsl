// title: Lacquer
// note: High-gloss black lacquer, polished like a piano. A small hard glint of the lamp, and a soft reflection of a window that slides across as the pointer moves or the card leans.
// order: 5
#define BASE vec3(0.018, 0.02, 0.028)  // colour of the card
#define BEVEL 10.0                     // width of the rounded edge, px
#define WINDOW 0.1                     // brightness of the reflected window

/** The reflected window: a slanted band with a soft upper side and a crisp lower one. */
float window(vec2 p) {
  float across = dot(p / uSize, vec2(0.62, 0.78)) - uFollow.x / uSize.x * 0.5 - dot(uTilt, vec2(260.0, 260.0));
  return smoothstep(-0.28, 0.02, across) * smoothstep(0.06, 0.045, across);
}

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, BEVEL);
  vec3 normal = normalOf(-edge.yz * edge.x * edge.x * 1.6);
  look.milk = 1.0;
  look.shine = 0.0;
  look.tint = BASE * (0.6 + 0.6 * diffuse(normal, p, 0.2));
  look.light = vec3(0.86, 0.92, 1.0) * (window(p) * WINDOW + edge.x * 0.05) + vec3(gleam(normal, p, 1500.0) * 1.1 + gleam(normal, p, 40.0) * 0.06);
}
