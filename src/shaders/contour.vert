// Contour slices: the object is cut into level bands like a topographic map, and the stack
// stretches apart as uProgress goes 0 → 1 (see contour.frag).
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;
uniform float uProgress;
varying float vHeight; // 0 at the bottom of the object, 1 at the top (before stretching)
varying vec3 vWorldNormal;

const float SPREAD = 1.6; // how much taller the stack gets: 1.6 = 2.6 times its height

void main() {
  vHeight = (position.y - uBoundsMin.y) / (uBoundsMax.y - uBoundsMin.y);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec3 p = position;
  p.y = uBoundsMin.y + (position.y - uBoundsMin.y) * (1.0 + SPREAD * uProgress);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
