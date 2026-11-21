// Flat glowing white shape. In Blender: custom property  shader = "lamp".
precision highp float;
varying vec3 vNormal;
uniform float uHover;
uniform vec3 uColor;

void main() {
  float rim = 1.0 - abs(normalize(vNormal).z);
  vec3 color = mix(uColor, vec3(0.75, 0.8, 1.0), rim * rim * 0.6);
  gl_FragColor = vec4(color * (1.0 + 0.3 * uHover), 1.0);
}
