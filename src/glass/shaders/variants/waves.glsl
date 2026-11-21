// title: Waves
// note: Five sheets of glass with swaying wave-shaped edges, stacked down the card. Each sheet adds blur and tint, and its edge bends the picture like a lens. Stirring the card lifts the waves.
// order: 8
#define LAYERS 5
#define EDGE 28.0    // width of each sheet's rounded edge, px
#define BEND 1.15    // how hard that edge bends the picture
#define BLUR 30.0    // blur under all the sheets, px
#define SWAY 0.045   // height of the waves, in card heights
#define PACE 0.5     // how fast they travel

float crest(float x, float i) {
  return 0.87 - i * 0.17
    + SWAY * sin(x * 5.0 * (1.0 + 0.13 * i) + uTime * PACE * (1.0 + 0.25 * i) + i * 1.9)
    + SWAY * 0.45 * sin(x * 11.0 - uTime * PACE * 1.6 + i * 4.0);
}

void glass(vec2 p, vec2 uv, inout Look look) {
  float lift = texture2D(uLiquid, uv).r * 0.035;
  float sheets = 0.0;
  for (int n = 0; n < LAYERS; n++) {
    float i = float(n);
    float below = (crest(uv.x, i) + lift - uv.y) * uSize.y; // px under this sheet's edge
    sheets += smoothstep(-1.0, 1.0, below);
    float rise = (crest(uv.x + 0.01, i) - crest(uv.x - 0.01, i)) / 0.02 * uSize.y / uSize.x;
    float band = clamp(1.0 - below / EDGE, 0.0, 1.0) * step(0.0, below);
    look.slope -= normalize(vec2(-rise, 1.0)) * BEND * band * band;
  }
  float deep = sheets / float(LAYERS);
  look.depth = 46.0;
  look.blur = BLUR * deep * deep;
  look.split = 0.16;
  look.tint = mix(vec3(1.0), vec3(0.72, 0.84, 1.0), deep);
  look.milk = 0.04 + 0.1 * deep;
  look.liquid = 0.3;
}
