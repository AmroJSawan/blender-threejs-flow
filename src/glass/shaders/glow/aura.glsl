// title: Aura
// note: Violet light soaking in from the edges round a deep blue middle, where fine rings breathe round a small moon. The rings lean toward the pointer; a tap sends one bright ring outward.
// order: 14
// springs: 0.7
// radius: 58
#define GLOW vec3(0.44, 0.28, 1.0)
#define BODY vec3(0.012, 0.03, 0.085)
#define RING vec3(0.3, 0.78, 1.0)
#define MOON vec3(0.8, 0.76, 1.0)
#define REACH 0.44
#define POWER 0.48
#define GAP 7.0       // distance between rings, px
#define RINGS 5.0     // how many
#define SWELL 0.9

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = inset(p, min(uSize.x, uSize.y) * REACH);
  float toward = max(1.0 + 0.35 * dot(edge.yz, uFollow / (uSize * 0.5)), 0.2);
  float soak = (pow(edge.x, 1.9) + 0.2 * pow(edge.x, 9.0)) * toward * (1.0 + 0.5 * exp(-uAge / SWELL));

  float moon = uSize.x * 0.12;
  vec2 from = p - uFollow * 0.06;
  float r = length(from) - moon - 4.0 - 1.5 * sin(uTime * 0.9); // the rings breathe in and out together
  float nearest = clamp(floor(r / GAP + 0.5), 0.0, RINGS - 1.0);
  float ring = smoothstep(1.1, 0.2, abs(r - nearest * GAP)) * (1.0 - nearest / RINGS);
  float wave = smoothstep(5.0, 0.0, abs(length(from) - moon - uAge * 160.0)) * exp(-uAge / SWELL); // a tap's ring, travelling out
  float disc = smoothstep(1.0, -1.0, length(from) - moon);
  float lit = 0.55 + 0.45 * clamp(dot(from / moon, vec2(-0.5, 0.7)) * 0.7 + 0.5, 0.0, 1.0); // lit from the upper left

  look.blur = 20.0;
  look.milk = 0.96;
  look.shine = 0.0;
  look.edge = 0.0;
  look.tint = BODY * (1.0 - 0.5 * edge.x);
  look.light = GLOW * POWER * soak + RING * (0.5 * ring + 0.6 * wave) * (1.0 - disc) + MOON * 0.75 * lit * disc;
  look.light += GLOW * 0.4 * smoothstep(1.4, 0.0, (1.0 - inset(p, 3.0).x) * 3.0);
}
