// title: Dome
// note: A magnifying bubble trapped in the glass. It slides after the pointer, overshoots a little and drifts back to the middle when left alone.
// order: 6
// springs: 0.7
#define BULGE 0.5    // 0.5 doubles the size of what is under the centre
#define EASE 0.7     // how much the bulge flattens toward its edge
#define ROAM 0.75    // how far the bubble follows the pointer

void glass(vec2 p, vec2 uv, inout Look look) {
  float half_ = min(uSize.x, uSize.y) * 0.5;
  vec2 q = (p - uFollow * ROAM) / half_;
  look.slope = -q * BULGE * max(1.0 - EASE * dot(q, q) * 0.5, 0.0) * smoothstep(1.5, 0.9, length(q));
  look.depth = half_;
  look.split = 0.07;
}
