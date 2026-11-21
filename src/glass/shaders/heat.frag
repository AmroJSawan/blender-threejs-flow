// Heat in the card. Red = how hot it is here. Rubbing with the pointer heats it (friction);
// the heat spreads, drifts upward and slowly cools. A faint pilot glow stays along the bottom.
precision highp float;
varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uAspect;
uniform vec2 uTouchFrom;
uniform vec2 uTouchTo;
uniform float uTouch;     // heat added by the pointer this step

#define FINGER 0.075   // width of the heated stroke, in card heights
#define SPREAD 0.3     // how fast heat flows into its surroundings
#define RISE 0.6       // how fast it drifts upward, cells per step
#define COOL 0.989     // 1 = never cools
#define PILOT 0.0028   // warmth fed in along the bottom edge

float toStroke(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float along = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return length(p - a - ab * along);
}

void main() {
  vec2 from = vUv - vec2(0.0, RISE * uTexel.y);
  float heat = texture2D(uState, from).r;
  float around = 0.25 * (
    texture2D(uState, from + vec2(uTexel.x, 0.0)).r + texture2D(uState, from - vec2(uTexel.x, 0.0)).r +
    texture2D(uState, from + vec2(0.0, uTexel.y)).r + texture2D(uState, from - vec2(0.0, uTexel.y)).r);
  heat = mix(heat, around, SPREAD) * COOL;

  vec2 shape = vec2(uAspect, 1.0);
  float d = toStroke(vUv * shape, uTouchFrom * shape, uTouchTo * shape) / FINGER;
  heat += uTouch * smoothstep(1.0, 0.0, d);
  heat += PILOT * smoothstep(0.08, 0.0, vUv.y);

  gl_FragColor = vec4(clamp(heat, 0.0, 1.6), 0.0, 0.0, 1.0);
}
