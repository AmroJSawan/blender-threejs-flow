// title: Satin
// note: Anodised satin with colour running from amber through rose to violet. The studio light lies on it as a wide, gentle band with no hard edge, and takes on the colour underneath.
// order: 3
// stage: #17151c
// lights: 0.25
#define SIDE_COLOUR vec3(0.3, 0.12, 0.2)
#define FROM vec3(1.0, 0.56, 0.2)    // colour at the upper left
#define MID vec3(0.92, 0.26, 0.42)   // colour in the middle
#define TO vec3(0.36, 0.2, 0.86)     // colour at the lower right
#define BEVEL 6.0                    // width of the rounded edge, px
#define ROUGH 0.42                   // how soft the reflections are

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, BEVEL);
  vec3 normal = normalOf(-edge.yz * edge.x * edge.x * 1.1);
  float across = clamp(0.5 - dot(p / uSize, normalize(KEY)) * 0.95, 0.0, 1.0);
  vec3 colour = mix(mix(FROM, MID, smoothstep(0.0, 0.55, across)), TO, smoothstep(0.45, 1.0, across));
  look.milk = 1.0;
  look.shine = 0.0;
  look.edge = 0.0;
  look.grain = 0.014;
  look.tint = colour * (0.42 + 0.62 * shade(p, normal));
  look.light = studio(p, normal, ROUGH) * mix(vec3(1.0), colour, 0.6) * 0.42;
}
