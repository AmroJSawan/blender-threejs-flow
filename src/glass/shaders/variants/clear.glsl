// title: Clear
// note: Progressive refraction. Flat and clear in the middle, bending harder and harder toward the rim, where the picture folds over.
// order: 1
#define WIDTH 58.0   // how far in from the rim the bend reaches, px
#define BEND 1.5     // lean of the surface at the rim
#define SPLIT 0.16   // colour fringe

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, WIDTH);
  look.slope = -edge.yz * BEND * edge.x * edge.x;
  look.depth = 48.0;
  look.split = SPLIT;
}
