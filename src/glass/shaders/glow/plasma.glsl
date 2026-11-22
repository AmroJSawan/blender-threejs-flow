// title: Plasma
// note: A plasma globe pressed flat. Arcs wander from the electrode to the rim; put the pointer on the glass and they all snap to it and follow.
// order: 6
// springs: 0.7
#define ARCS 4
#define WRIGGLE 22.0  // how far an arc strays from a straight line, px
#define GAS vec3(0.62, 0.35, 1.0)

float toArc(vec2 p, vec2 end, float seed) {
  float along = clamp(dot(p, end) / max(dot(end, end), 1.0), 0.0, 1.0);
  vec2 across = normalize(vec2(-end.y, end.x) + 1e-4);
  float stray = (noise(vec2(along * 5.0 + seed, uTime * 2.6 + seed)) - 0.5) * 2.0 * WRIGGLE * sin(along * 3.14159);
  return length(p - end * along - across * stray);
}

void glass(vec2 p, vec2 uv, inout Look look) {
  float held = smoothstep(8.0, 30.0, length(uFollow));
  vec3 light = GAS * (1.2 * exp(-length(p) / 9.0) + 0.3 * exp(-length(p) / 60.0)); // the electrode
  for (int n = 0; n < ARCS; n++) {
    float seed = float(n) * 7.3;
    float angle = seed + uTime * (0.25 + 0.07 * float(n)) + 1.5 * noise(vec2(seed, uTime * 0.3));
    vec2 roam = vec2(cos(angle), sin(angle)) * uSize * 0.44;
    vec2 end = mix(roam, uFollow + vec2(cos(seed), sin(seed)) * 6.0, held);
    float d = toArc(p, end, seed);
    light += (GAS * exp(-d / 9.0) + vec3(1.0, 0.9, 1.0) * smoothstep(2.2, 0.6, d)) * (0.75 + 0.25 * noise(vec2(uTime * 9.0, seed)));
  }
  look.blur = 12.0;
  look.tint = vec3(0.03, 0.02, 0.07);
  look.milk = 0.8;
  look.light = light * 0.8 + GAS * 0.26 * soak(p, 0.42); // the same light soaking in round the rim, turning the corners with the card
}
