// Flat 2D line-art for box-shaped meshes. In Blender: custom property  shader = "lineart".
// One crisp stroke per edge, flat fills, no lighting, no gradients.
// The Blender base colour is the top face; the sides use INK.
precision highp float;
#include "boxedge.glsl"
uniform float uHover;
uniform vec3 uColor;

const float STROKE_WIDTH = 2.0; // screen pixels
const vec3 STROKE = vec3(1.0);
const vec3 INK = vec3(0.03, 0.025, 0.07);

void main() {
  vec3 fill = vLocalNormal.y > 0.5 ? uColor : INK;
  gl_FragColor = vec4(mix(fill, STROKE, boxStroke(STROKE_WIDTH + uHover)), 1.0);
}
