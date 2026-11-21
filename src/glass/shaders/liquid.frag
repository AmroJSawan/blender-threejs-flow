// The liquid skin of the card: a small height map that behaves like the surface of water.
// Each step every point is pulled toward the average of its neighbours, which makes waves travel,
// bounce off the rim and die out. Red = height, green = how fast it is rising.
precision highp float;
varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 uTexel;      // size of one cell
uniform float uAspect;    // card width / height
uniform vec2 uTouchFrom;  // the finger's stroke since the last step, in card coordinates 0–1
uniform vec2 uTouchTo;
uniform float uTouch;     // how hard it presses
uniform vec3 uDrop;       // xy: where a drop lands, z: how hard
uniform vec2 uSlosh;      // the card's own acceleration: the liquid lags behind

#define SPEED 0.9      // how fast waves travel (keep below 1.9)
#define CALM 0.986     // 1 = waves never die out
#define LEVEL 0.004    // pull back to a flat surface
#define FINGER 0.07    // size of the finger, in card heights
#define DROP 0.05      // size of a drop

float toStroke(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float along = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return length(p - a - ab * along);
}

void main() {
  vec2 state = texture2D(uState, vUv).rg;
  float height = state.r;
  float rise = state.g;
  float around = 0.25 * (
    texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r + texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r +
    texture2D(uState, vUv + vec2(0.0, uTexel.y)).r + texture2D(uState, vUv - vec2(0.0, uTexel.y)).r);

  rise += (around - height) * SPEED - height * LEVEL;
  rise *= CALM;

  vec2 shape = vec2(uAspect, 1.0);
  float finger = toStroke(vUv * shape, uTouchFrom * shape, uTouchTo * shape) / FINGER;
  rise -= uTouch * exp(-finger * finger);
  float drop = length((vUv - uDrop.xy) * shape) / DROP;
  rise -= uDrop.z * exp(-drop * drop);
  rise += dot(uSlosh, vUv - 0.5);

  gl_FragColor = vec4(clamp(height + rise, -4.0, 4.0), rise, 0.0, 1.0);
}
