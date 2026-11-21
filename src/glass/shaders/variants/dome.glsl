// title: Dome
// note: A magnifying bulge. Strongest in the middle, easing off toward the rim.
// order: 6
#define BULGE 0.5    // 0.5 doubles the size of what is under the centre
#define EASE 0.7     // how much the bulge flattens toward the rim

void glass(vec2 p, vec2 uv, inout Look look) {
  float half_ = min(uSize.x, uSize.y) * 0.5;
  vec2 q = p / half_;
  look.slope = -q * BULGE * max(1.0 - EASE * dot(q, q) * 0.5, 0.0);
  look.depth = half_;
  look.split = 0.07;
  look.liquid = 0.2;
}
