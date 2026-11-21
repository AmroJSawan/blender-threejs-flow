// Object shader. In Blender: add custom property  shader = "pulse"  to a mesh.
// pulse.vert (same name) makes the same wave physically move the surface.
precision highp float;
varying vec3 vNormal;
varying float vWave; // -1…1: troughs to crests of the wave
uniform float uScroll;
uniform float uHover;
uniform vec3 uColor; // the object's Blender base colour

void main() {
  vec3 normal = normalize(vNormal);
  float bands = 0.5 + 0.5 * vWave;
  float light = 0.45 + 0.55 * max(dot(normal, normalize(vec3(0.4, 0.8, 0.6))), 0.0);
  float rim = pow(1.0 - abs(normal.z), 2.0);

  vec3 color = uColor * (0.35 + 0.65 * bands) * light + rim * 0.5;
  color += uHover * 0.3;
  color = mix(color, color.gbr, uScroll * 0.5);
  gl_FragColor = vec4(color, 1.0);
}
