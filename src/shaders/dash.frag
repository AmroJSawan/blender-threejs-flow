// Dashed guide line for thin vertical posts. In Blender: custom property  shader = "dash".
// Optional number property  dash = 0.07  (length of one dash plus one gap).
precision highp float;
varying vec3 vLocalPosition;
uniform vec3 uColor;
uniform float uDash;

void main() {
  if (fract(vLocalPosition.y / (uDash > 0.0 ? uDash : 0.07)) > 0.5) discard;
  gl_FragColor = vec4(uColor, 0.55);
}
