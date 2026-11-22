// title: Ceramic
// note: Glazed porcelain, off-white and softly rounded at the edge. The glaze is glassy, so the studio panels reflect in it clearly but faintly, and they waver a little where the glaze lies uneven.
// order: 8
// stage: #24231f
// lights: 0.12
// ink: dark
#define SIDE_COLOUR vec3(0.6, 0.59, 0.56)
#define BASE vec3(0.9, 0.885, 0.86)  // colour of the porcelain
#define BEVEL 16.0                   // width of the rounded edge, px
#define UNEVEN 0.35                  // how wavy the glaze is
#define GLAZE 0.11                   // how much of the studio the glaze reflects

float glaze(vec2 p) { return noise(p / 80.0); }

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, BEVEL);
  vec2 wave = vec2(glaze(p + vec2(3.0, 0.0)) - glaze(p - vec2(3.0, 0.0)), glaze(p + vec2(0.0, 3.0)) - glaze(p - vec2(0.0, 3.0)));
  vec3 normal = normalOf(-edge.yz * edge.x * edge.x * 1.3 + wave * UNEVEN);
  look.milk = 1.0;
  look.shine = 0.0;
  look.edge = 0.0;
  look.tint = BASE * (0.6 + 0.42 * shade(p, normal));
  look.light = studio(p, normal, 0.03) * GLAZE;
}
