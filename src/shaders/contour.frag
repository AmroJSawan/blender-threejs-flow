// Contour slices, colour side. In Blender: custom property  shader = "contour".
// Number properties:  slices = 14  (how many levels),  from / to  (scroll range of the spread).
// Stacked together the object looks solid with coloured contour lines; as it spreads, the
// material between the lines dissolves and only floating bands remain.
precision highp float;
varying float vHeight;
varying vec3 vWorldNormal;
uniform float uProgress;
uniform float uSlices;
uniform float uHover;

const float SPREAD = 1.6; // keep equal to contour.vert
const float BAND = 0.42;  // part of each level that is drawn as a band

// Map colours: deep water, shallows, sand, peaks.
vec3 palette(float t) {
  vec3 low = mix(vec3(0.1, 0.25, 0.95), vec3(0.1, 0.85, 0.75), smoothstep(0.0, 0.45, t));
  vec3 high = mix(vec3(1.0, 0.85, 0.3), vec3(1.0, 0.35, 0.5), smoothstep(0.6, 1.0, t));
  return mix(low, high, smoothstep(0.35, 0.7, t));
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  float slices = uSlices > 0.0 ? uSlices : 14.0;
  float level = vHeight * slices;
  float soft = fwidth(level);
  float width = BAND / (1.0 + SPREAD * uProgress); // the bands keep their real thickness while the gaps grow
  float band = 1.0 - smoothstep(width - soft, width + soft, fract(level));

  // The body between the bands thins out like a screen door, then disappears.
  if (band < 0.5 && hash(gl_FragCoord.xy) < smoothstep(0.0, 0.35, uProgress)) discard;

  vec3 normal = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  float light = 0.55 + 0.45 * dot(normal, normalize(vec3(-0.4, 0.8, 0.45)));
  vec3 tint = palette((floor(level) + 0.5) / slices);
  if (level < 1.0) tint *= 0.4; // sea level is a large flat sheet: keep it quiet
  vec3 line = tint * (0.55 + 0.6 * light + uHover * 0.2) * (gl_FrontFacing ? 1.0 : 0.45);
  gl_FragColor = vec4(mix(tint * 0.13 * light, line, band), 1.0);
}
