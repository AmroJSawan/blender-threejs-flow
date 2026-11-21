// Drawing sheet for a flat plane: a faint grid on dark paper, fading out toward the border.
// In Blender: custom property  shader = "grid". Optional number properties:
//   cell  = 0.4   size of one grid square
//   shade = 0.9   how dark the paper under the drawing is (0 = only the grid lines)
// Drawn underneath every other shader object (#pragma underlay).
#pragma underlay
precision highp float;
varying vec3 vLocalPosition;
uniform vec3 uBoundsMax;
uniform vec3 uColor;
uniform float uCell;
uniform float uShade;

const float OPACITY = 0.14;
const vec3 PAPER = vec3(0.035);

void main() {
  vec2 g = vLocalPosition.xz / (uCell > 0.0 ? uCell : 0.4);
  vec2 distance = abs(fract(g - 0.5) - 0.5) / fwidth(g);
  float fade = 1.0 - smoothstep(0.35, 1.0, length(vLocalPosition.xz / uBoundsMax.xz));
  float line = (1.0 - min(min(distance.x, distance.y), 1.0)) * OPACITY * fade;
  float paper = uShade * fade;
  float alpha = paper + (1.0 - paper) * line;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(mix(PAPER, uColor, line), alpha);
}
