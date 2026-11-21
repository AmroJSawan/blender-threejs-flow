// Tumbling ring that leaves a tail of light: the ring is drawn many times, each copy
// showing where the ring was a little earlier (see echo.frag).
// Needs the ring strip from halo() in blender/make_demo.py and the number property
// copies = 140  on the object (how many past positions are drawn).
uniform float uTime;
uniform float uHover;
uniform vec2 uMouse;
uniform vec2 uResolution;
uniform float uCopies;
uniform vec3 uBoundsMax;
varying float vEcho;   // 0 = the ring now, 1 = the oldest echo
varying float vAcross; // -1…1 across the width of the line

const float SPIN = 1.5;       // turns of the main spin, radians per second
const float TILT = 0.75;      // how far the spin axis leans over, radians
const float TILT_SPEED = 0.43;
const float ROLL = 0.21;      // slow roll of the whole figure, radians per second
const float TAIL = 0.5;       // seconds of history kept in the tail (longer fills the whole sweep)
const float HEAD_WIDTH = 3.0; // screen pixels: the ring itself
const float ECHO_WIDTH = 2.4; // screen pixels: each echo
const float MOUSE_LEAN = 0.5; // how far the pointer leans the figure

mat3 rotateX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotateY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotateZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

// Where the point at `angle` on the ring was at time `t`.
vec3 ringPoint(float angle, float t) {
  vec3 p = uBoundsMax.x * vec3(cos(angle), sin(angle), 0.0);
  p = rotateY(t * SPIN) * p;
  p = rotateX(TILT * sin(t * TILT_SPEED) + uMouse.y * MOUSE_LEAN) * p;
  return rotateZ(t * ROLL + uMouse.x * MOUSE_LEAN) * p;
}

void main() {
  vEcho = float(gl_InstanceID) / max(uCopies - 1.0, 1.0);
  vAcross = uv.y * 2.0 - 1.0;
  float t = uTime - vEcho * TAIL * (1.0 + uHover); // hovering / pressing stretches the tail
  float angle = uv.x * 6.2831853;

  mat4 toScreen = projectionMatrix * modelViewMatrix;
  vec4 here = toScreen * vec4(ringPoint(angle, t), 1.0);
  vec4 next = toScreen * vec4(ringPoint(angle + 0.02, t), 1.0);

  // Widen the line sideways on screen, so it keeps the same pixel width at any distance.
  vec2 along = normalize((next.xy / next.w - here.xy / here.w) * uResolution + 1e-6);
  float width = gl_InstanceID == 0 ? HEAD_WIDTH : ECHO_WIDTH;
  here.xy += vec2(-along.y, along.x) * vAcross * width / uResolution * here.w;
  gl_Position = here;
}
