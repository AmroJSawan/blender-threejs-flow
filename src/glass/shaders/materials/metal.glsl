// title: Brushed metal
// note: Brushed aluminium. Thousands of fine scratches run across it, so the lamp does not make a spot: its highlight is pulled into a tall streak that travels with the pointer.
// order: 6
#define BASE vec3(0.52, 0.54, 0.58)  // colour of the metal
#define BEVEL 8.0                    // width of the rounded edge, px
#define SCRATCH 2.4                  // how fine the brushing is
#define ALONG 0.07                   // width of the highlight along the scratches
#define ACROSS 0.55                  // its length across them

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, BEVEL);
  float scratch = noise(vec2(p.x * 0.035, p.y * SCRATCH)) + 0.5 * noise(vec2(p.x * 0.09 + 7.0, p.y * SCRATCH * 2.3)) - 0.75;
  vec3 normal = normalOf(-edge.yz * edge.x * edge.x * 1.3);
  vec3 half_ = normalize(toLamp(p) + vec3(0.0, 0.0, 1.0));
  vec2 off = half_.xy - normal.xy;
  float streak = exp(-(off.x * off.x) / (ALONG * ALONG) - (off.y * off.y) / (ACROSS * ACROSS));
  look.milk = 1.0;
  look.shine = 0.0;
  look.tint = BASE * (0.3 + 0.45 * diffuse(normal, p, 0.3)) * (1.0 + 0.22 * scratch);
  look.light = vec3(1.0, 0.99, 0.96) * streak * (0.6 + 0.5 * scratch);
}
