// title: Neon
// note: A gas tube bent around the card. It stutters as it strikes, then settles into a steady hum with a faint buzz. Tap anywhere to strike it again.
// order: 1
// springs: 0.7
#define HALO
#define TUBE vec3(1.0, 0.16, 0.5)   // colour of the gas
#define INSET 26.0                  // how far the tube sits inside the rim, px
#define STRIKE 1.1                  // seconds of stutter before it holds

/** 0–1: how lit the tube is right now. */
float lit() {
  float buzz = 0.93 + 0.07 * hash(vec2(floor(uTime * 50.0), 7.0));
  if (uAge > STRIKE) return buzz;
  float chance = mix(0.2, 0.9, uAge / STRIKE); // catches more often as it warms up
  return step(hash(vec2(floor(uTime * 22.0), 3.0)), chance) * step(0.12, uAge) * buzz;
}

float toTube(vec2 p) { return abs(roundedBox(p, uSize * 0.5 - INSET, max(uRadius - INSET * 0.5, 4.0)).x); }

void glass(vec2 p, vec2 uv, inout Look look) {
  float d = toTube(p);
  float on = lit();
  look.blur = 12.0;
  look.tint = vec3(0.03, 0.03, 0.06);
  look.milk = 0.74;
  look.light = on * (TUBE * (0.9 * exp(-d / 12.0) + 0.3 * exp(-d / 55.0)) + vec3(1.0, 0.86, 0.94) * smoothstep(3.2, 1.2, d));
  look.light += on * TUBE * 0.22 * soak(p, 0.42); // the same light soaking in round the rim, turning the corners with the card
  look.light += (1.0 - on) * TUBE * 0.06 * smoothstep(3.2, 1.2, d); // the unlit tube is still faintly visible
}

vec3 halo(vec2 p, float away) { return TUBE * 0.55 * exp(-(away + INSET) / 70.0) * lit(); }
