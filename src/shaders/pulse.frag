// Object shader. In Blender: add custom property  shader = "pulse"  to a mesh.
// pulse.vert (same name) adds the physical noise displacement.
precision highp float;
varying vec2 vUv;
varying vec3 vNormal;
varying float vNoise; // -1…1, the noise that moved this point
uniform float uTime;
uniform float uScroll;
uniform float uHover;
uniform vec3 uColor; // the object's Blender base colour

void main() {
  vec3 normal = normalize(vNormal);
  float rings = 0.5 + 0.5 * sin(length(vUv - 0.5) * 40.0 - uTime * 3.0);
  float light = 0.35 + 0.65 * max(dot(normal, normalize(vec3(0.4, 0.8, 0.6))), 0.0);
  float rim = pow(1.0 - abs(normal.z), 2.0);

  vec3 color = uColor * (0.45 + 0.55 * rings);
  color = mix(color * 0.55, color * 1.35, 0.5 + 0.5 * vNoise); // valleys darker, peaks brighter
  color = color * light + rim * 0.5;
  color += uHover * 0.3;
  color = mix(color, color.gbr, uScroll * 0.5);
  gl_FragColor = vec4(color, 1.0);
}
