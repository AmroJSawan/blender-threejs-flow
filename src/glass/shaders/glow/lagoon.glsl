// title: Lagoon
// note: Teal light soaking in from the edges of a dark card. A brighter stretch drifts slowly round the rim, and jumps to wherever the pointer is nearest; a tap makes the light swell.
// order: 13
// springs: 0.7
#define GLOW vec3(0.2, 0.82, 0.72)
#define BODY vec3(0.008, 0.02, 0.03)
#define REACH 0.46
#define POWER 0.4
#define DRIFT 0.25    // how fast the brighter stretch travels round the rim
#define SWELL 0.5

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, min(uSize.x, uSize.y) * REACH);
  // The brighter stretch: where the rim faces a slowly turning direction, or the pointer when it is on the card.
  vec2 facing = vec2(cos(uTime * DRIFT), sin(uTime * DRIFT));
  vec2 pointer = uFollow / (uSize * 0.5);
  facing = normalize(mix(facing, pointer, clamp(length(pointer) * 1.5, 0.0, 1.0)) + 1e-4);
  float stretch = 0.8 + 0.4 * smoothstep(-0.2, 1.0, dot(edge.yz, facing));
  float soak = (pow(edge.x, 1.9) + 0.2 * pow(edge.x, 9.0)) * stretch * (1.0 + 0.7 * exp(-uAge / SWELL));
  look.blur = 20.0;
  look.milk = 0.96;
  look.shine = 0.0;
  look.edge = 0.0;
  look.tint = BODY;
  look.light = GLOW * POWER * soak;
  look.light += GLOW * 0.35 * smoothstep(1.4, 0.0, (1.0 - rim(p, 3.0).x) * 3.0);
}
