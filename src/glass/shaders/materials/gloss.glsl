// title: Gloss
// note: Deep gloss under a clear coat. The studio's light panels show in it as crisp-edged reflections that slide across when the card leans or the pointer moves, over a colour that stays dark and rich.
// order: 4
// stage: #101319
// lights: 0.2
#define SIDE_COLOUR vec3(0.02, 0.03, 0.07)
#define BASE vec3(0.02, 0.045, 0.14)  // colour under the clear coat
#define BEVEL 7.0                     // width of the rounded edge, px
#define COAT 0.2                      // how much of the studio the clear coat reflects

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, BEVEL);
  vec3 normal = normalOf(-edge.yz * edge.x * edge.x * 1.4);
  look.milk = 1.0;
  look.shine = 0.0;
  look.edge = 0.0;
  look.tint = BASE * (0.5 + 0.9 * shade(p, normal));
  // The coat reflects more at a glancing angle, which is what the rounded edge is.
  look.light = studio(p, normal, 0.012) * (COAT + 0.7 * edge.x * edge.x);
}
