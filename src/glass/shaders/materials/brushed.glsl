// title: Brushed
// note: Titanium with a fine linear brush. The grooves run top to bottom, so they smear the studio light sideways into a soft bright field, and each groove still catches its own thin line.
// order: 5
// stage: #1a1a1b
// lights: 0.1
// ink: dark
#define SIDE_COLOUR vec3(0.36, 0.34, 0.31)
#define BASE vec3(0.74, 0.7, 0.64)  // colour of the metal
#define BEVEL 4.0                   // width of the rounded edge, px
#define GROOVE 3.2                  // spacing of the grooves, px
#define SMEAR 0.022                  // how far the grooves spread the light sideways

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, BEVEL);
  vec2 slope = -edge.yz * edge.x * edge.x * 1.2;
  float groove = sin(p.x * 6.2832 / GROOVE);
  float streak = noise(vec2(p.x * 0.9, p.y * 0.012)) - 0.5; // long uneven strokes of the brush
  // Five looks at the studio, fanned sideways across the grooves.
  vec3 seen = vec3(0.0);
  for (int i = -3; i <= 3; i++) seen += studio(p, normalOf(slope + vec2(float(i) * SMEAR + streak * 0.02, 0.0)), 0.22);
  seen /= 7.0;
  look.milk = 1.0;
  look.shine = 0.0;
  look.edge = 0.0;
  look.tint = BASE * (0.12 + 0.16 * shade(p, normalOf(slope)));
  look.light = BASE * seen * (1.5 + 0.14 * groove + 0.12 * streak);
}
