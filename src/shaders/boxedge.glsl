// Single-stroke outlines for box-shaped meshes, shared by lineart and blueprint.
// Use with a .vert that includes flat2d.glsl (it provides vAxisFacing).
varying vec3 vLocalPosition;
varying vec3 vLocalNormal;
varying vec3 vAxisFacing;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;

const float EDGE_ON = 0.03; // a side seen this close to edge-on counts as hidden

// 1 on the box's edges, 0 elsewhere. `pixels` is the stroke width on screen.
float boxStroke(float pixels) {
  vec3 facing = abs(normalize(vLocalNormal));
  int face = facing.x > 0.5 ? 0 : (facing.y > 0.5 ? 1 : 2);

  // An edge is shared by two faces; when both are visible only one of them
  // draws it, so strokes never double.
  float edge = 1000.0;
  for (int axis = 0; axis < 3; axis++) {
    if (axis == face) continue;
    bool owns = face < axis;
    if (owns || vAxisFacing[axis] <= EDGE_ON) edge = min(edge, uBoundsMax[axis] - vLocalPosition[axis]);
    if (owns || vAxisFacing[axis] >= -EDGE_ON) edge = min(edge, vLocalPosition[axis] - uBoundsMin[axis]);
  }
  float width = fwidth(edge) * pixels;
  return 1.0 - smoothstep(width - fwidth(edge), width, edge);
}
