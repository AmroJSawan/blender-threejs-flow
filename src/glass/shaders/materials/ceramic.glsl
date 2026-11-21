// title: Ceramic
// note: Glazed ceramic. The glaze is thick and slightly uneven, so the lamp's reflection wobbles as it crosses, and it runs thin and pale along the edges where the clay shows through.
// order: 7
#define GLAZE vec3(0.08, 0.15, 0.42)  // colour where the glaze is thick
#define THIN vec3(0.62, 0.7, 0.78)    // colour where it runs thin, at the edges
#define BEVEL 16.0                    // width of the rounded edge, px
#define UNEVEN 0.5                    // how wavy the glaze is

float glaze(vec2 p) { return noise(p / 70.0); }

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, BEVEL);
  vec2 wave = vec2(glaze(p + vec2(3.0, 0.0)) - glaze(p - vec2(3.0, 0.0)), glaze(p + vec2(0.0, 3.0)) - glaze(p - vec2(0.0, 3.0)));
  vec3 normal = normalOf(-edge.yz * edge.x * edge.x * 1.5 + wave * UNEVEN);
  look.milk = 1.0;
  look.shine = 0.0;
  look.tint = mix(GLAZE, THIN, pow(edge.x, 1.6) * 0.75) * (0.34 + 0.75 * diffuse(normal, p, 0.5));
  look.light = vec3(gleam(normal, p, 220.0) * 0.9 + gleam(normal, p, 14.0) * 0.1);
}
