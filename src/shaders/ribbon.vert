// Ribbon: a strip that flutters like fabric while light travels along it (see ribbon.frag).
// Needs a strip mesh whose UV runs 0 → 1 along its length (U) and across its width (V),
// like the ones made by ribbons() in blender/make_demo.py.
uniform float uTime;
uniform float uPhase;
varying vec2 vUv;
varying vec3 vWorldPosition;

const float FLUTTER = 0.06; // height of the waves, in Blender units
const float WAVES = 4.0;    // waves along the ribbon
const float SPEED = 1.5;

void main() {
  vUv = uv;
  // The ends stay put; the middle sways the most.
  float sway = sin(uv.x * WAVES * 6.2831 - uTime * SPEED + uPhase) * FLUTTER * sin(uv.x * 3.14159);
  vec4 world = modelMatrix * vec4(position + normal * sway, 1.0);
  vWorldPosition = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
