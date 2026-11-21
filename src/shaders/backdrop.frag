// Full-screen background. Enabled by config.look.backgroundShader = 'backdrop'.
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uScroll;
uniform vec2 uMouse;
uniform vec2 uResolution;

void main() {
  vec2 p = vUv - 0.5;
  p.x *= uResolution.x / uResolution.y;
  vec2 light = vec2(uMouse.x * 0.25, 0.15 + uMouse.y * 0.15);
  float glow = smoothstep(0.9, 0.0, length(p - light));
  float wave = 0.5 + 0.5 * sin(p.x * 3.0 + uTime * 0.3 + uScroll * 6.2831);
  vec3 base = vec3(0.035, 0.04, 0.06);
  vec3 tint = mix(vec3(0.10, 0.16, 0.34), vec3(0.30, 0.12, 0.34), uScroll);
  vec3 color = base + tint * glow * (0.6 + 0.4 * wave);
  gl_FragColor = vec4(pow(color, vec3(1.0 / 2.2)), 1.0);
}
