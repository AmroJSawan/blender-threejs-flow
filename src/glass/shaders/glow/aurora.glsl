// title: Aurora
// note: Curtains of light hanging in dark glass, slowly folding. The pointer is a wind: the curtains bend away where it passes and swing back.
// order: 3
// springs: 0.7
#define FOLDS 5.0    // how many curtains across
#define PACE 0.35
#define WIND 1.4     // how far the pointer blows them

float curtain(float x, float y, float seed) {
  float t = uTime * PACE;
  x += 0.22 * sin(y * 2.4 + t * 1.3 + seed) + 0.3 * noise(vec2(x * 1.5 + seed, t * 0.6));
  float fold = 0.5 + 0.5 * sin(x * FOLDS + 3.0 * noise(vec2(x * 2.0, t * 0.4 + seed)));
  return pow(fold, 4.0);
}

void glass(vec2 p, vec2 uv, inout Look look) {
  vec2 q = p / uSize.y;
  float near = exp(-pow((p.y - uFollow.y) / (uSize.y * 0.35), 2.0));
  q.x -= uFollow.x / uSize.y * WIND * near * step(1.0, length(uFollow));
  float rays = 0.75 + 0.25 * noise(vec2(q.x * 40.0, uTime * 0.8));        // fine vertical streaks
  float hang = smoothstep(0.02, 0.35, uv.y) * smoothstep(1.0, 0.55, uv.y); // bright band in the upper middle
  vec3 green = vec3(0.1, 1.0, 0.55), violet = vec3(0.62, 0.3, 1.0), rose = vec3(1.0, 0.3, 0.6);
  vec3 light = green * curtain(q.x, q.y, 0.0) + violet * curtain(q.x * 0.8 + 3.0, q.y, 4.0) * smoothstep(0.3, 0.9, uv.y)
    + rose * 0.5 * curtain(q.x * 1.3 + 7.0, q.y, 9.0) * smoothstep(0.6, 0.1, uv.y);
  look.blur = 14.0;
  look.tint = vec3(0.02, 0.03, 0.07);
  look.milk = 0.8;
  look.light = light * rays * (0.25 + 0.75 * hang) * 0.85;
  look.light += mix(green, violet, uv.y) * 0.22 * soak(p, 0.42); // the same light soaking in round the rim, turning the corners with the card
}
