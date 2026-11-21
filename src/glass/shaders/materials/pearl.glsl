// title: Pearl
// note: Pearl finish: a satin surface whose colour depends on the angle of the light. Move the pointer and bands of rose, green and blue travel across it.
// order: 8
#define BASE vec3(0.4, 0.4, 0.46)  // colour of the card under the sheen
#define BEVEL 12.0                 // width of the rounded edge, px
#define BANDS 1.2                  // how many colour bands show at once
#define COLOUR 0.3                 // how strong the colours are

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, BEVEL);
  vec3 normal = normalOf(-edge.yz * edge.x * edge.x * 1.2);
  float angle = dot(normal, toLamp(p)) * BANDS + 0.25 * noise(p / 90.0);
  vec3 sheen = 0.6 + 0.4 * cos(6.2832 * (angle + vec3(0.0, 0.33, 0.67)));
  look.milk = 1.0;
  look.shine = 0.0;
  look.tint = mix(BASE, BASE * 2.0 * sheen, COLOUR) * (0.4 + 0.7 * diffuse(normal, p, 0.5));
  look.light = sheen * gleam(normal, p, 12.0) * 0.22 + vec3(gleam(normal, p, 160.0) * 0.45);
}
