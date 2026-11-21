// title: Silk
// note: Slow, wide folds drifting through the glass like cloth in a breeze. The pointer catches the cloth and drags the folds after it; let go and they slide back.
// order: 9
// stretch: 0.4
#define FOLDS 3.0    // how many folds fit down the card
#define DEPTH 0.5    // how steep they are
#define PACE 0.45    // how fast they drift
#define DRAG 1.1     // how far the pointer pulls the cloth

float folds(vec2 q) {
  float t = uTime * PACE;
  q += 0.4 * vec2(sin(q.y * 1.7 + t * 0.8), sin(q.x * 1.3 - t * 0.6));
  return 0.5 * sin(q.x * 2.6 + q.y * 1.2 + t) + 0.3 * sin(q.x * 1.2 - q.y * 2.4 - t * 0.9 + 1.7) + 0.14 * sin((q.x + q.y) * 4.1 + t * 1.5);
}

void glass(vec2 p, vec2 uv, inout Look look) {
  vec2 q = (p - uFollow * DRAG) / uSize.y * FOLDS;
  float e = 0.04;
  float height = folds(q);
  vec2 lean = vec2(folds(q + vec2(e, 0.0)) - folds(q - vec2(e, 0.0)), folds(q + vec2(0.0, e)) - folds(q - vec2(0.0, e))) / (2.0 * e);
  vec3 edge = rim(p, 12.0);
  look.slope = lean * DEPTH - edge.yz * 0.7 * edge.x;
  look.depth = 64.0;
  look.blur = 2.0 + 5.0 * smoothstep(0.4, -0.6, height); // the valleys are a little softer
  look.split = 0.2;
  look.tint = mix(vec3(0.75, 0.7, 1.0), vec3(1.0, 0.8, 0.9), height * 0.5 + 0.5);
  look.milk = 0.1;
}
