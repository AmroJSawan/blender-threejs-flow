// Blueprint / architectural line drawing for box-shaped meshes.
// In Blender: custom property  shader = "blueprint".
// The Blender base colour is the ink: outline, floor lines and a faint tint of the fill.
// Optional number properties on the object:
//   floors = 12    horizontal floor lines on the sides
//   level  = 0.7   one white line at that height (0 = bottom, 1 = top)
precision highp float;
#include "boxedge.glsl"
uniform float uHover;
uniform vec3 uColor;
uniform float uFloors;
uniform float uLevel;

const float STROKE_WIDTH = 2.0; // screen pixels
const vec3 PAPER = vec3(0.035);
const float TINT = 0.08;        // how much of the ink colour shows in the fill

void main() {
  vec3 color = mix(PAPER, uColor, TINT);

  if (abs(vLocalNormal.y) < 0.5) {
    float height = (vLocalPosition.y - uBoundsMin.y) / (uBoundsMax.y - uBoundsMin.y);
    if (uFloors > 0.0) {
      float f = height * uFloors;
      float distance = (0.5 - abs(fract(f) - 0.5)) / fwidth(f);
      color = mix(color, uColor, 0.7 * (1.0 - smoothstep(0.4, 1.0, distance)));
    }
    if (uLevel > 0.0) {
      float distance = abs(height - uLevel) / fwidth(height);
      color = mix(color, vec3(1.0), 1.0 - smoothstep(0.8, 1.6, distance));
    }
  }

  gl_FragColor = vec4(mix(color, uColor, boxStroke(STROKE_WIDTH + uHover)), 1.0);
}
