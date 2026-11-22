// title: Clear
// note: A thick, rigid slab. Progressive refraction: flat in the middle, bending harder toward the rim, where the picture folds over. Lean it with the pointer and the picture inside shifts, as it does through thick glass.
// order: 1
// springs: 0.7
#define WIDTH 58.0   // how far in from the rim the bend reaches, px
#define BEND 0.95    // lean of the surface at the rim
#define SPLIT 0.1    // colour fringe
#define THICK 900.0  // how far the picture shifts when the slab leans

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, WIDTH);
  look.slope = -edge.yz * BEND * edge.x * edge.x + uTilt * THICK;
  look.depth = 48.0;
  look.split = SPLIT;
}
