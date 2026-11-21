// Soft light bloom on a flat plane placed behind an object.
// In Blender: custom property  shader = "halo"  on a plane.
#pragma additive
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uHover;
uniform vec3 uColor;

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float core = exp(-dot(p, p) * 9.0);                         // tight white glow in the middle
  float wide = exp(-dot(p, p) * 2.2);                         // faint wide wash
  float pink = exp(-dot(p - vec2(-0.45, -0.3), p - vec2(-0.45, -0.3)) * 6.0);
  float breathe = 0.9 + 0.1 * sin(uTime * 1.3);
  vec3 color = uColor * (core * 0.55 + wide * 0.12) + vec3(1.0, 0.15, 0.35) * pink * 0.22;
  float fade = 1.0 - smoothstep(0.6, 1.0, length(p)); // reach zero before the plane's edge
  gl_FragColor = vec4(color * fade * breathe * (1.0 + 0.5 * uHover), 1.0);
}
