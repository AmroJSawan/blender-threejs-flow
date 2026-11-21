// title: Satin
// note: A smooth satin finish, between matte and gloss: the highlight is wide and gentle and melts into the colour without a hard spot.
// order: 4
#define BASE vec3(0.06, 0.3, 0.25)   // colour of the card
#define BEVEL 12.0                   // width of the rounded edge, px
#define SHARP 45.0                   // how tight the sheen is (low = wide)
#define SHINE 0.34                   // how bright it is

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, BEVEL);
  vec3 normal = normalOf(-edge.yz * edge.x * edge.x * 1.2);
  look.milk = 1.0;
  look.shine = 0.0;
  look.grain = 0.012;
  look.tint = BASE * (0.32 + 0.75 * diffuse(normal, p, 0.4));
  look.light = vec3(0.8, 1.0, 0.94) * gleam(normal, p, SHARP) * SHINE;
}
