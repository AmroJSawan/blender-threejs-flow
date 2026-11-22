// title: Horizon
// note: Blue light soaking in from the edges, turning teal toward the bottom, round a sun half risen over a horizon. The sun rises and sinks a little with the pointer; a tap makes the light swell.
// order: 11
// springs: 0.7
#define SKY vec3(0.4, 0.5, 1.0)       // edge light at the top
#define SEA vec3(0.16, 0.66, 0.7)     // … and at the bottom
#define BODY vec3(0.012, 0.02, 0.04)
#define SUN_TOP vec3(0.42, 0.74, 1.0)
#define SUN_LOW vec3(0.62, 0.45, 1.0)
#define REACH 0.46
#define POWER 0.5
#define SUN 0.2       // the sun's radius, as a share of the card's width
#define SWELL 0.5

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = inset(p, min(uSize.x, uSize.y) * REACH);
  float toward = max(1.0 + 0.35 * dot(edge.yz, uFollow / (uSize * 0.5)), 0.2);
  float soak = (pow(edge.x, 1.9) + 0.2 * pow(edge.x, 9.0)) * toward * (1.0 + 0.7 * exp(-uAge / SWELL));
  vec3 glow = mix(SEA, SKY, smoothstep(0.1, 0.9, uv.y));

  // The sun: a disc cut by the horizon, with its glow above and its reflection below.
  float horizon = uSize.y * 0.03;
  float radius = uSize.x * SUN;
  vec2 fromSun = p - vec2(0.0, horizon + uFollow.y * 0.05 + 2.0 * sin(uTime * 0.6));
  float d = length(fromSun) - radius;
  float above = smoothstep(-0.7, 0.7, p.y - horizon);
  vec3 sun = mix(SUN_LOW, SUN_TOP, clamp(fromSun.y / radius, 0.0, 1.0));
  vec3 light = sun * smoothstep(1.0, -1.0, d) * above;
  light += sun * 0.3 * exp(-max(d, 0.0) / (radius * 0.4)) * above * step(0.0, d);
  light += sun * 0.22 * exp(-length(fromSun * vec2(1.0, 1.9)) / (radius * 0.9)) * (1.0 - above);
  light += vec3(0.5, 0.62, 0.85) * 0.16 * smoothstep(1.3, 0.0, abs(p.y - horizon)); // the horizon line

  look.blur = 20.0;
  look.milk = 0.96;
  look.shine = 0.0;
  look.edge = 0.0;
  look.tint = BODY + vec3(0.02, 0.035, 0.06) * (1.0 - above); // the sea is a shade lighter than the sky
  look.light = glow * POWER * soak + light;
  look.light += glow * 0.35 * smoothstep(1.4, 0.0, (1.0 - inset(p, 3.0).x) * 3.0);
}
