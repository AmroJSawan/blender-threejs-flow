// Living orb: the surface drifts between a calm, softly lumpy state and an active
// state where regular ripple bands travel around it.
// It wakes up by itself every few seconds; hovering (or pressing it in the card view)
// keeps it awake, and the pointer tilts the direction of the bands.
// Picked up automatically because it has the same name as pulse.frag.
uniform float uTime;
uniform float uHover;
uniform vec2 uMouse;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vWave;   // -1…1: grooves to ridges of the ripples
varying float vActive; // 0 = calm, 1 = fully rippling

const float RIPPLE = 0.05;    // ripple height when active, in Blender units
const float LUMPS = 0.1;      // height of the slow calm lumps
const float BANDS = 5.5;      // how many ripple bands fit on the orb
const float SPEED = 1.6;      // how fast the bands travel
const float CYCLE = 7.0;      // seconds between two automatic wake-ups
const float TILT = 0.9;       // how far the pointer tilts the bands

// 0…1: how awake the orb is right now.
float activity() {
  float cycle = 0.5 - 0.5 * cos(uTime * 6.2831 / CYCLE);
  return max(smoothstep(0.3, 0.7, cycle), uHover);
}

// The direction the bands are stacked along: wanders slowly, leans toward the pointer.
vec3 bandAxis() {
  vec3 axis = vec3(0.35 * sin(uTime * 0.31), 1.0, 0.35 * cos(uTime * 0.23));
  axis.xz += vec2(uMouse.x, -uMouse.y) * TILT;
  return normalize(axis);
}

float ripple(vec3 p, vec3 axis) {
  float along = dot(p, axis);
  // A slight wobble keeps the bands organic instead of perfectly flat rings.
  float wobble = 0.5 * sin(dot(p, axis.zxy) * 3.0 + uTime * 0.7) + 0.25 * sin(p.x * 4.0 - p.z * 3.0 + uTime * 0.4);
  return sin((along * BANDS + wobble) * 3.1416 - uTime * SPEED);
}

float lumps(vec3 p) {
  float t = uTime * 0.45;
  return (sin(p.x * 2.3 + t) * sin(p.y * 1.9 - t * 1.3) + sin(p.z * 2.7 + t * 0.8) * sin(p.x * 1.5 - p.y * 2.1 + t)) * 0.5;
}

vec3 displace(vec3 p, vec3 n, vec3 axis, float awake) {
  float height = LUMPS * lumps(p) * (1.0 - 0.4 * awake) + RIPPLE * awake * ripple(p, axis);
  return p + n * height;
}

void main() {
  vUv = uv;
  vec3 n = normalize(normal);
  vec3 axis = bandAxis();
  float awake = activity();
  vActive = awake;
  vWave = ripple(position, axis);

  // Rebuild the normal from two displaced neighbours so the ripples catch the light.
  vec3 tangent = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 bitangent = cross(n, tangent);
  float e = 0.02;
  vec3 p0 = displace(position, n, axis, awake);
  vec3 p1 = displace(position + tangent * e, normalize(n + tangent * e / length(position)), axis, awake);
  vec3 p2 = displace(position + bitangent * e, normalize(n + bitangent * e / length(position)), axis, awake);
  vNormal = normalize(normalMatrix * cross(p1 - p0, p2 - p0));

  vec4 world = modelMatrix * vec4(p0, 1.0);
  vWorldPosition = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
