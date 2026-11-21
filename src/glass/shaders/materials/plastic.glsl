// title: Plastic
// note: Regular moulded plastic: an even colour with one clear, medium-sized highlight and a rounded edge that catches the lamp.
// order: 3
#define BASE vec3(0.82, 0.2, 0.15)   // colour of the card
#define BEVEL 12.0                   // width of the rounded edge, px
#define SHARP 240.0                  // how tight the highlight is
#define SHINE 0.55                   // how bright it is

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, BEVEL);
  vec3 normal = normalOf(-edge.yz * edge.x * edge.x * 1.4);
  look.milk = 1.0;
  look.shine = 0.0;
  look.tint = BASE * (0.3 + 0.75 * diffuse(normal, p, 0.25));
  look.light = vec3(1.0, 0.96, 0.93) * (gleam(normal, p, SHARP) * SHINE + gleam(normal, p, 30.0) * 0.06);
}
