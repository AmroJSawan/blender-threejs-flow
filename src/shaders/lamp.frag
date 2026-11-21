// Flat glowing shape with no shading at all. In Blender: custom property  shader = "lamp".
precision highp float;
uniform float uHover;
uniform vec3 uColor;

void main() {
  gl_FragColor = vec4(uColor * (1.0 + 0.3 * uHover), 1.0);
}
