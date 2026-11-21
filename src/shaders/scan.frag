// Scan reveal: a glowing line climbs the object. Above it the object is a see-through grid of
// lines; below it, it is solid. uProgress (0 → 1) is the height of the line:
// set the scroll range with the number properties  from  and  to  in Blender.
// In Blender: custom property  shader = "scan"; the base colour is the solid material.
precision highp float;
varying vec3 vLocalPosition;
varying vec3 vLocalNormal;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;
uniform vec3 uColor;
uniform float uProgress;
uniform float uTime;
uniform float uHover;

const vec3 WIRE = vec3(0.35, 0.9, 1.0); // colour of the grid and of the scan line
const float GRID = 9.0;                 // grid lines per Blender unit
const float GLOW = 0.045;               // thickness of the glow around the scan line (0–1 of the height)

void main() {
  float height = (vLocalPosition.y - uBoundsMin.y) / (uBoundsMax.y - uBoundsMin.y);
  float wobble = 0.012 * sin(vLocalPosition.x * 17.0 + uTime * 2.0) + 0.012 * sin(vLocalPosition.z * 13.0 - uTime * 1.7);
  float line = mix(-0.1, 1.1, uProgress) + wobble;
  float glow = smoothstep(GLOW, 0.0, abs(height - line));

  if (height < line) {
    // Built: a simple lit material.
    vec3 normal = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 view = normalize(cameraPosition - vWorldPosition);
    vec3 key = normalize(vec3(-0.4, 0.75, 0.55));
    float light = 0.5 + 0.5 * dot(normal, key);
    vec3 color = uColor * (0.2 + 0.9 * light * light);
    color += pow(max(dot(reflect(-key, normal), view), 0.0), 30.0) * 0.45;
    color += pow(1.0 - max(dot(normal, view), 0.0), 3.0) * 0.12;
    gl_FragColor = vec4(color + WIRE * glow * 0.9, 1.0);
    return;
  }

  // Not built yet: grid lines on the object's own axes; everything between them is left out.
  vec3 grid = vLocalPosition * GRID;
  vec3 distance = abs(fract(grid - 0.5) - 0.5) / max(fwidth(grid), 1e-5);
  distance += step(0.8, abs(normalize(vLocalNormal))) * 10.0; // a surface cannot show the lines of the axis it faces
  float ink = max(1.0 - min(min(distance.x, distance.y), distance.z) / 1.2, glow);
  if (ink < 0.25) discard;
  float side = gl_FrontFacing ? 1.0 : 0.4; // the far side shows through, dimmer
  gl_FragColor = vec4(WIRE * side * (0.5 + 0.5 * ink + glow + uHover * 0.3), 1.0);
}
