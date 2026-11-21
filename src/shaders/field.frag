// Field of pins, colour side. In Blender: custom property  shader = "field"  (see field.vert).
// The Blender base colour is the resting colour; raised pins glow toward PEAK at their tips.
precision highp float;
varying vec3 vNormal;
varying float vTop;
varying float vLift;
varying float vTouch;
uniform vec3 uColor;

const vec3 PEAK = vec3(1.0, 0.8, 0.35);

void main() {
  float light = 0.4 + 0.6 * max(dot(normalize(vNormal), normalize(vec3(-0.3, 0.8, 0.5))), 0.0);
  vec3 color = mix(uColor * 0.35, uColor, vTop);
  color = mix(color, PEAK, vLift * vTop) * light;
  color += PEAK * vTouch * vTop * 0.3;
  gl_FragColor = vec4(color, 1.0);
}
