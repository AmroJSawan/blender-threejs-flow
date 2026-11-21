// Physical wave: regular ripples travel across the surface and push it in and out.
// Picked up automatically because it has the same name as pulse.frag.
uniform float uTime;
uniform float uHover;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vWave;

const float AMOUNT = 0.05;      // ripple height, in Blender units
const float HOVER_BOOST = 0.04; // extra height while hovered
const float FREQUENCY = 9.0;    // how many ripples fit on the object
const float SPEED = 3.0;        // how fast they travel
const float BEND = 0.6;         // 0 = straight bands, higher = curvier bands

float wave(vec3 p) {
  float phase = (p.y + p.x * 0.5) * FREQUENCY + sin(p.z * 2.0) * BEND;
  return sin(phase - uTime * SPEED);
}

vec3 displace(vec3 p, vec3 n) {
  return p + n * wave(p) * (AMOUNT + HOVER_BOOST * uHover);
}

void main() {
  vUv = uv;
  vec3 n = normalize(normal);
  vWave = wave(position);

  // Rebuild the normal from two displaced neighbours so the ripples catch the light.
  vec3 tangent = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 bitangent = cross(n, tangent);
  float e = 0.02;
  vec3 p0 = displace(position, n);
  vec3 p1 = displace(position + tangent * e, n);
  vec3 p2 = displace(position + bitangent * e, n);
  vNormal = normalize(normalMatrix * cross(p1 - p0, p2 - p0));

  vec4 world = modelMatrix * vec4(p0, 1.0);
  vWorldPosition = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
