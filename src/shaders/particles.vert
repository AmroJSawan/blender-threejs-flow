// Dots: the vertices of the mesh, drawn as round dots (see `#pragma points` in particles.frag).
// A shape key in Blender is the shape the dots travel to while uProgress goes 0 → 1
// (set the scroll range with the number properties  from  and  to).
// The pointer pushes nearby dots away.
#include "pointer.glsl"
attribute vec3 morph; // how far this dot travels to reach the shape key (zero without one)
uniform float uTime;
uniform float uProgress;
uniform float uPixelRatio;
uniform float uSize;
varying float vJourney; // 0 = first shape, 1 = arrived at the second
varying float vShade;

const float SIZE = 0.018;   // dot diameter in Blender units (or number property  size)
const float STAGGER = 0.6;  // how spread out the departures are (0 = all dots leave together)
const float SCATTER = 0.45; // how far the dots fly apart mid-journey
const float DRIFT = 0.012;  // idle wobble
const float REACH = 0.16;   // pointer reach, in picture heights
const float PUSH = 0.09;    // how far the pointer pushes, in picture heights

float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  float id = float(gl_VertexID);
  float journey = clamp(uProgress * (1.0 + STAGGER) - hash(id * 0.137) * STAGGER, 0.0, 1.0);
  journey = journey * journey * (3.0 - 2.0 * journey);
  vJourney = journey;
  vShade = 0.55 + 0.45 * hash(id * 0.917);

  vec3 p = position + morph * journey;
  vec3 aside = normalize(vec3(hash(id * 0.71), hash(id * 1.31), hash(id * 2.17)) - 0.5);
  p += aside * sin(journey * 3.14159) * SCATTER * (0.4 + hash(id * 0.37));
  p += DRIFT * vec3(sin(uTime * 0.7 + id), cos(uTime * 0.9 + id * 1.3), sin(uTime * 0.8 + id * 0.7));

  vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  vec2 away = fromPointer(clip);
  float touched = smoothstep(REACH, 0.0, length(away));
  clip.xy += normalize(away + 1e-5) * vec2(uResolution.y / uResolution.x, 1.0) * touched * PUSH * 2.0 * clip.w;
  gl_Position = clip;

  float size = uSize > 0.0 ? uSize : SIZE;
  gl_PointSize = max(size * projectionMatrix[1][1] * uResolution.y * uPixelRatio * 0.5 / clip.w, 1.5) * (1.0 + touched);
}
