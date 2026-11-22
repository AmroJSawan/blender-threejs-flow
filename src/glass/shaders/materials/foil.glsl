// title: Foil
// note: Holographic foil on silver. Where the studio light lands it breaks into a smooth run of spectrum colours, which travels across the card as it leans or the pointer moves.
// order: 7
// stage: #14141a
// lights: 0.2
// ink: dark
#define SIDE_COLOUR vec3(0.4, 0.4, 0.46)
#define SILVER vec3(0.66, 0.68, 0.74)  // colour of the foil away from the light
#define BEVEL 4.0                      // width of the rounded edge, px
#define BANDS 2.2                      // how many runs of the spectrum cross the card
#define COLOUR 0.85                    // how strong the colours are

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, BEVEL);
  vec3 normal = normalOf(-edge.yz * edge.x * edge.x * 1.2);
  // Where on the studio this point looks: the same measure the light panels use, so the colours move with them.
  vec3 eye = normalize(vec3(-p / EYE, 1.0));
  float at = dot(reflect(-eye, normal).xy - uFollow / uSize * 0.22, KEY);
  vec3 spectrum = 0.62 + 0.38 * cos(6.2832 * (at * BANDS + vec3(0.0, 0.33, 0.67)));
  vec3 seen = studio(p, normal, 0.3);
  look.milk = 1.0;
  look.shine = 0.0;
  look.edge = 0.0;
  look.grain = 0.02;
  look.tint = SILVER * mix(vec3(1.0), spectrum * 1.25, 0.5) * (0.62 + 0.4 * shade(p, normal));
  look.light = seen * mix(vec3(1.0), spectrum * 1.3, COLOUR) * 0.55;
}
