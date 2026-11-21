// Field of pins: one small pin drawn many times in a grid; a wave rolls through it and
// the pins under the pointer rise.
// In Blender: a pin whose origin is at its base, with the number properties
//   copies = 324   how many pins
//   columns = 18   pins per row
//   gap = 0.11     distance between pins
#include "pointer.glsl"
uniform float uTime;
uniform float uCopies;
uniform float uColumns;
uniform float uGap;
uniform vec3 uBoundsMax;
varying vec3 vNormal;
varying float vTop;   // 0 at the base of the pin, 1 at its tip
varying float vLift;  // 0 = resting, 1 = fully raised
varying float vTouch; // 0…1: how close the pointer is

const float REST = 0.18;    // resting height, as a multiple of the pin's own height
const float WAVE = 1.0;     // extra height at the crest of the wave
const float TOUCH = 1.3;    // extra height under the pointer
const float REACH = 0.14;   // pointer reach, in picture heights

void main() {
  float columns = max(uColumns, 1.0);
  float rows = ceil(uCopies / columns);
  float id = float(gl_InstanceID);
  vec2 spot = (vec2(mod(id, columns), floor(id / columns)) - 0.5 * vec2(columns - 1.0, rows - 1.0)) * uGap;

  // Rings spreading from the centre, crossed by a slow swell.
  float wave = (0.5 + 0.5 * sin(length(spot) * 6.0 - uTime * 1.6)) * (0.6 + 0.4 * sin(spot.x * 2.0 + uTime * 0.6));
  vec4 base = projectionMatrix * modelViewMatrix * vec4(spot.x, 0.0, spot.y, 1.0);
  vTouch = smoothstep(REACH, 0.0, length(fromPointer(base)));
  float height = REST + WAVE * wave + TOUCH * vTouch;
  vLift = clamp((height - REST) / (WAVE + TOUCH * 0.5), 0.0, 1.0);
  vTop = position.y / uBoundsMax.y;
  vNormal = normalize(normalMatrix * normal);

  vec3 p = vec3(position.x + spot.x, position.y * height, position.z + spot.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
