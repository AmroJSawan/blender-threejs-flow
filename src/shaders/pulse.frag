// Object shader. In Blender: add custom property  shader = "pulse"  to a mesh.
precision highp float;
varying vec2 vUv;
varying vec3 vNormal;
uniform float uTime;
uniform float uScroll;
uniform float uHover;
uniform vec3 uColor; // the object's Blender base colour

void main() {
  float rings = 0.5 + 0.5 * sin(length(vUv - 0.5) * 40.0 - uTime * 3.0);
  float rim = pow(1.0 - abs(normalize(vNormal).z), 2.0);
  vec3 color = uColor * (0.35 + 0.65 * rings) + rim * 0.6;
  color += uHover * 0.35;
  color = mix(color, color.gbr, uScroll * 0.5);
  gl_FragColor = vec4(color, 1.0);
}
