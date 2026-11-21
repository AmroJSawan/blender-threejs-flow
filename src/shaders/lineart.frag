// Flat 2D line-art for box-shaped meshes. In Blender: custom property  shader = "lineart".
// One crisp stroke per edge, flat fills, no lighting, no gradients.
// The Blender base colour is the top face; the sides use INK.
precision highp float;
varying vec3 vLocalPosition;
varying vec3 vLocalNormal;
varying vec3 vAxisFacing;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;
uniform float uHover;
uniform vec3 uColor;

const float STROKE_WIDTH = 2.0; // screen pixels
const vec3 STROKE = vec3(1.0);
const float EDGE_ON = 0.03;      // a side seen this close to edge-on counts as hidden
const vec3 INK = vec3(0.03, 0.025, 0.07);

void main() {
  vec3 facing = abs(normalize(vLocalNormal));
  int face = facing.x > 0.5 ? 0 : (facing.y > 0.5 ? 1 : 2);

  // Distance to the nearest edge this face should draw. An edge is shared by two
  // faces; when both are visible only one of them draws it, so strokes never double.
  float edge = 1000.0;
  for (int axis = 0; axis < 3; axis++) {
    if (axis == face) continue;
    bool owns = face < axis;
    if (owns || vAxisFacing[axis] <= EDGE_ON) edge = min(edge, uBoundsMax[axis] - vLocalPosition[axis]);
    if (owns || vAxisFacing[axis] >= -EDGE_ON) edge = min(edge, vLocalPosition[axis] - uBoundsMin[axis]);
  }
  float width = fwidth(edge) * (STROKE_WIDTH + uHover);
  float stroke = 1.0 - smoothstep(width - fwidth(edge), width, edge);

  vec3 fill = vLocalNormal.y > 0.5 ? uColor : INK;
  gl_FragColor = vec4(mix(fill, STROKE, stroke), 1.0);
}
