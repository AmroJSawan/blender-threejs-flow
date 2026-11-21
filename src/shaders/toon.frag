// Comic-book look: two flat tones, halftone dots in the shadow, a hard highlight and an ink outline.
// In Blender: custom property  shader = "toon". Optional number property  outline = 3  (pixels).
// The pointer moves the light.
#pragma outline
precision highp float;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
uniform vec3 uColor;
uniform vec2 uMouse;
uniform float uHover;
uniform float uPixelRatio;

const float CELL = 7.0;                    // distance between halftone dots, in CSS pixels
const vec3 INK = vec3(0.07, 0.06, 0.12);
const vec3 SHADOW = vec3(0.62, 0.52, 0.82); // the base colour is multiplied by this in the shade

void main() {
  vec3 normal = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 view = normalize(cameraPosition - vWorldPosition);
  vec3 key = normalize(vec3(-0.5 + uMouse.x * 0.9, 0.75 + uMouse.y * 0.5, 0.6));
  float lit = dot(normal, key);

  float soft = fwidth(lit);
  float bright = smoothstep(0.3 - soft, 0.3 + soft, lit);
  vec3 color = mix(uColor * SHADOW, uColor, bright);

  // Dots on a 45° screen grid; they grow as the surface turns further from the light.
  vec2 grid = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / (CELL * uPixelRatio);
  float radius = smoothstep(0.35, -0.6, lit) * 0.7;
  float dots = smoothstep(radius, radius - 0.1, length(fract(grid) - 0.5));
  color = mix(color, INK, dots * (1.0 - bright) * 0.85);

  color = mix(color, vec3(1.0), smoothstep(0.95, 0.96, dot(reflect(-key, normal), view)) * 0.9);
  gl_FragColor = vec4(color + uHover * 0.08, 1.0);
}
