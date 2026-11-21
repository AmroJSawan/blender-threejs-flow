// Ribbon, colour side. In Blender: custom property  shader = "ribbon"  on a strip mesh.
// Satin in the Blender base colour, with pulses of light running along it.
// Optional number property  phase = 2.0  shifts the timing, so several ribbons do not move in step.
precision highp float;
varying vec2 vUv;
varying vec3 vWorldPosition;
uniform float uTime;
uniform float uHover;
uniform float uPhase;
uniform vec3 uColor;

const float PULSES = 2.0; // light pulses on the ribbon at once
const float FLOW = 0.3;   // how fast they travel (ribbon lengths per second)

void main() {
  // The strip moves, so its facing is measured here, from the surface actually drawn.
  vec3 normal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
  vec3 view = normalize(cameraPosition - vWorldPosition);
  if (dot(normal, view) < 0.0) normal = -normal;

  vec3 key = normalize(vec3(-0.3, 0.8, 0.5));
  float light = 0.5 + 0.5 * dot(normal, key);
  float sheen = pow(max(dot(reflect(-key, normal), view), 0.0), 14.0);
  vec3 color = uColor * (0.22 + 0.9 * light) + sheen * 0.45;
  color *= 0.7 + 0.3 * sin(vUv.y * 3.14159); // darker toward both edges, like folded satin

  float along = fract(vUv.x * PULSES - uTime * FLOW * (1.0 + uHover) - uPhase * 0.16);
  color += mix(uColor, vec3(1.0), 0.65) * pow(along, 7.0) * 1.7; // bright head, fading tail
  gl_FragColor = vec4(color, 1.0);
}
