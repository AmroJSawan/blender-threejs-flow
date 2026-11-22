// title: Matte
// note: Soft-touch matte black. It gives no reflection back, only a slow fall of light from the upper left and a fine grain, so its shape reads from the thin lit edge alone.
// order: 2
// stage: #1b1c20
// lights: 0.12
#define SIDE_COLOUR vec3(0.05, 0.052, 0.058)
#define BASE vec3(0.085, 0.088, 0.096)  // colour of the card
#define BEVEL 5.0                       // width of the rounded edge, px
#define GRAIN 0.03                      // fine surface speckle

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, BEVEL);
  vec3 normal = normalOf(-edge.yz * edge.x * edge.x * 0.9);
  look.milk = 1.0;
  look.shine = 0.0;
  look.edge = 0.0;
  look.grain = GRAIN;
  look.tint = BASE * (0.5 + 1.5 * shade(p, normal));
  look.light = studio(p, normal, 1.0) * 0.06 + studio(p, normal, 0.2) * edge.x * 0.12;
}
