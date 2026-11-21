// Frost on the glass. Red = how clear the glass is here: a finger wipes it to 1, then the frost
// creeps back in from the edges of the wiped patch.
precision highp float;
varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uAspect;
uniform vec2 uTouchFrom;
uniform vec2 uTouchTo;
uniform float uTouch;     // 1 while the pointer is on the card

#define FINGER 0.085   // width of the wiped stroke, in card heights
#define REFROST 0.0022 // how fast the frost returns (0.0022 ≈ 8 seconds)
#define CREEP 0.12     // how much it closes in from the edges

float toStroke(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float along = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return length(p - a - ab * along);
}

void main() {
  float clear = texture2D(uState, vUv).r;
  float around = 0.25 * (
    texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r + texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r +
    texture2D(uState, vUv + vec2(0.0, uTexel.y)).r + texture2D(uState, vUv - vec2(0.0, uTexel.y)).r);
  clear = mix(clear, around, CREEP) - REFROST;

  vec2 shape = vec2(uAspect, 1.0);
  float d = toStroke(vUv * shape, uTouchFrom * shape, uTouchTo * shape) / FINGER;
  clear = max(clear, uTouch * smoothstep(1.0, 0.45, d));

  gl_FragColor = vec4(clamp(clear, 0.0, 1.0), 0.0, 0.0, 1.0);
}
