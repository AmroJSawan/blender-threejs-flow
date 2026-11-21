// Dry sand: a height map where sand only moves when a slope is steeper than its angle of rest.
// Each step every cell hands a little sand to any lower neighbour that is too far below it,
// so grooves keep their shape, piles slump into cones and nothing ever ripples like water.
precision highp float;
varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 uTexel;      // size of one cell
uniform float uAspect;    // card width / height
uniform vec2 uTouchFrom;  // the finger's stroke since the last step, in card coordinates 0–1
uniform vec2 uTouchTo;
uniform float uTouch;     // how much sand the finger moves
uniform vec2 uSlide;      // which way the sand is thrown when the card is shaken
uniform float uReset;     // 1 = lay fresh raked sand

#define REPOSE 0.011   // steepest step between two cells that sand can hold
#define RATE 0.22      // how fast a slope that is too steep collapses (keep below 0.25)
#define FINGER 0.04    // width of the groove a finger leaves, in card heights
#define FILL 0.55      // how much sand there is

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float toStroke(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float along = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return length(p - a - ab * along);
}

/** Sand handed from one cell to its neighbour; `throw_` is the shake pushing it that way. */
float moved(float from, float to, float throw_) {
  return min(max(from - to + throw_ - REPOSE, 0.0) * RATE, from * 0.2);
}

void main() {
  vec2 shape = vec2(uAspect, 1.0);
  if (uReset > 0.5) {
    // Fresh sand: soft dunes, raked in fine wavy lines.
    vec2 q = vUv * shape;
    float rake = sin(q.y * 110.0 + sin(q.x * 6.0) * 2.5);
    gl_FragColor = vec4(FILL + 0.012 * rake + 0.09 * noise(q * 2.5), 0.0, 0.0, 1.0);
    return;
  }

  float here = texture2D(uState, vUv).r;
  float height = here;
  // The four neighbours; the rim is a wall, so nothing crosses it.
  for (int i = 0; i < 4; i++) {
    vec2 way = i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
    vec2 at = vUv + way * uTexel;
    if (at.x < 0.0 || at.x > 1.0 || at.y < 0.0 || at.y > 1.0) continue;
    float there = texture2D(uState, at).r;
    float throw_ = dot(uSlide, way);
    height += moved(there, here, -throw_) - moved(here, there, throw_);
  }

  // A finger digs a groove and piles what it removed along both sides.
  float d = toStroke(vUv * shape, uTouchFrom * shape, uTouchTo * shape) / FINGER;
  height += uTouch * (0.25 * exp(-d * d * 0.25) - exp(-d * d));

  gl_FragColor = vec4(max(height, 0.0), 0.0, 0.0, 1.0);
}
