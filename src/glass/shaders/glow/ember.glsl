// title: Ember
// note: A dark plate that heats where you rub it. The heat spreads, drifts upward and cools from white through yellow and orange to dull red; the hot air above it shimmers.
// order: 2
// springs: 0.7
#define HALO
#define HAZE 0.9     // how much hot air bends the picture

/** Colour of something glowing with heat: 0 = cold, 1 = white hot. */
vec3 hot(float t) {
  return vec3(smoothstep(0.02, 0.45, t), 0.85 * smoothstep(0.28, 0.9, t), smoothstep(0.7, 1.25, t));
}

void glass(vec2 p, vec2 uv, inout Look look) {
  float heat = texture2D(uHeat, uv).r;
  vec2 air = vec2(noise(p / 16.0 + vec2(0.0, -uTime * 1.6)), noise(p / 16.0 + vec2(9.0, -uTime * 1.6))) - 0.5;
  look.slope = air * HAZE * min(heat, 1.0);
  look.blur = 10.0;
  look.tint = vec3(0.045, 0.04, 0.04);
  look.milk = 0.86;
  look.shine = 0.4;
  look.light = hot(heat) * (0.92 + 0.08 * noise(p / 5.0 + uTime * 3.0));
}

vec3 halo(vec2 p, float away) {
  float heat = texture2D(uHeat, clamp(p / uSize + 0.5, 0.0, 1.0)).r;
  return hot(heat * 0.8) * 0.5 * exp(-away / 46.0);
}
