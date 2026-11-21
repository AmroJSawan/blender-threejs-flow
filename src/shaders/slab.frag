// Technical-drawing style for flat rounded slabs (see slab() in blender/make_demo.py).
// In Blender: custom property  shader = "slab".
// Number properties on the object:
//   radius = 0.16   corner radius of the slab (same units as the mesh)
//   ghost  = 1      see-through wireframe instead of the solid holographic body
precision highp float;
varying vec3 vLocalPosition;
varying vec3 vLocalNormal;
varying vec3 vNormal;
varying vec3 vAxisFacing;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;
uniform vec3 uColor;
uniform vec2 uMouse;
uniform float uTime;
uniform float uHover;
uniform float uRadius;
uniform float uGhost;

const float STROKE_WIDTH = 2.0;  // screen pixels
const float THIN = 0.6;          // inner detail lines
const float GHOST_OPACITY = 0.4;
const vec3 INK = vec3(0.02);
const float VENT = 0.035;        // width of one vent slit plus its gap

float roundedBox(vec2 p, vec2 size, float r) {
  vec2 q = abs(p) - size + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// 1 where `distance` is within `pixels` of zero.
float line(float distance, float pixels) {
  float w = max(fwidth(distance), 1e-5);
  return 1.0 - smoothstep(pixels * w - w, pixels * w, abs(distance));
}

// Soft pastel iridescence that drifts over time and with the mouse.
vec3 holo(vec3 p) {
  float t = (p.x + p.z) * 0.35 + p.y * 0.8 + uTime * 0.04 + uMouse.x * 0.12;
  t += 0.15 * sin(p.x * 5.0 + uTime * 0.3) + 0.15 * sin(p.y * 9.0 - p.z * 4.0);
  // Blue → pink → orange → aqua and round again.
  vec3 stops[4];
  stops[0] = vec3(0.42, 0.68, 1.0);
  stops[1] = vec3(1.0, 0.62, 0.78);
  stops[2] = vec3(1.0, 0.78, 0.52);
  stops[3] = vec3(0.62, 0.95, 0.93);
  float f = fract(t) * 4.0;
  int i = int(f);
  vec3 from = i == 0 ? stops[0] : (i == 1 ? stops[1] : (i == 2 ? stops[2] : stops[3]));
  vec3 to = i == 0 ? stops[1] : (i == 1 ? stops[2] : (i == 2 ? stops[3] : stops[0]));
  return mix(from, to, smoothstep(0.0, 1.0, fract(f)));
}

void main() {
  vec3 centre = (uBoundsMin + uBoundsMax) * 0.5;
  vec3 size = (uBoundsMax - uBoundsMin) * 0.5;
  vec3 p = vLocalPosition - centre;
  bool ghost = uGhost > 0.5;
  float stroke = STROKE_WIDTH + uHover;

  vec3 color = INK;
  float lines = 0.0; // white linework on top of `color`

  if (abs(vLocalNormal.y) > 0.5) {
    // Top or bottom: outline, two inset lines and a centre emblem.
    float outline = roundedBox(p.xz, size.xz, uRadius);
    float emblem = roundedBox(p.xz, size.xz * 0.26, uRadius * 0.4);
    lines = line(outline, stroke);
    lines = max(lines, 0.55 * line(outline + 0.09 * size.x, THIN));
    lines = max(lines, 0.3 * line(roundedBox(p.xz, size.xz * 0.62, uRadius * 0.7), THIN));
    if (ghost) lines = max(lines, 0.55 * line(emblem, THIN));
    else color = mix(color, holo(p), 1.0 - smoothstep(0.0, fwidth(emblem), emblem));
  } else {
    if (ghost && !gl_FrontFacing) discard;
    // Silhouette of the rounded corners.
    lines = line(abs(normalize(vNormal).z), stroke);
    // The rim next to the hidden cap (the visible cap draws its own outline).
    if (!ghost) lines = max(lines, line(vAxisFacing.y > 0.0 ? p.y + size.y : size.y - p.y, stroke));

    // Vent slits on the flat parts of the sides.
    vec3 n = abs(vLocalNormal);
    float along = n.x > 0.999 ? p.z / size.z : (n.z > 0.999 ? -p.x / size.x : 9.0);
    float area = step(0.28, along) * step(along, 0.7) * step(abs(p.y), size.y * 0.5);
    float slit = area * step(0.5, fract(along * size.x / VENT));
    if (ghost) lines = max(lines, 0.5 * slit);
    else color = mix(holo(p), INK, slit);
  }

  if (ghost) {
    float alpha = lines * GHOST_OPACITY;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  } else {
    gl_FragColor = vec4(mix(color, uColor, lines), 1.0);
  }
}
