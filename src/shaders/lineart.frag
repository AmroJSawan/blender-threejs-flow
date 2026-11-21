// 2D line-art look for 3D boxes. In Blender: custom property  shader = "lineart".
// Draws a glowing outline on every edge of the object's box, a flat dark fill on
// the sides and a sliding colour gradient on the top. No lighting at all.
precision highp float;
varying vec3 vLocalPosition;
varying vec3 vLocalNormal;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;
uniform float uTime;
uniform float uHover;
uniform vec3 uColor; // Blender base colour: the fill of the sides

const float LINE = 1.2;  // outline thickness, in screen pixels
const float GLOW = 7.0;  // how far the glow spreads inward, in screen pixels
const vec3 WARM = vec3(1.0, 0.16, 0.42);
const vec3 COOL = vec3(0.36, 0.46, 1.0);
const vec3 DEEP = vec3(0.07, 0.04, 0.28);

void main() {
  vec3 facing = abs(normalize(vLocalNormal));

  // Distance to the nearest box edge, ignoring the axis this face looks along.
  vec3 d = min(vLocalPosition - uBoundsMin, uBoundsMax - vLocalPosition);
  d += step(0.5, facing) * 1000.0;
  float edge = min(d.x, min(d.y, d.z));
  float pixel = fwidth(edge);
  float line = 1.0 - smoothstep(pixel * LINE, pixel * (LINE + 1.0), edge);
  float glow = exp(-edge / (pixel * GLOW)) * (0.35 + 0.4 * uHover);

  vec3 fill = uColor;
  if (vLocalNormal.y > 0.5) {
    // Top face: gradient that slides sideways; each step is offset by its width.
    float across = (vLocalPosition.x - uBoundsMin.x) / (uBoundsMax.x - uBoundsMin.x);
    float slide = across + 0.3 * sin(uTime * 0.7 + uBoundsMax.x * 4.0);
    fill = mix(WARM, COOL, smoothstep(0.05, 0.55, slide));
    fill = mix(fill, DEEP, smoothstep(0.55, 1.0, slide));
  }

  gl_FragColor = vec4(fill + vec3(line + glow), 1.0);
}
