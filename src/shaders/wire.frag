// See-through wireframe version of the slab: only the linework, drawn as light strokes.
// In Blender: custom property  shader = "wire". Number property:  radius = 0.16.
// Lines blend over the scene and never hide each other.
#pragma transparent
#pragma nodepth
precision highp float;
#define WIRE
#include "slab.glsl"
