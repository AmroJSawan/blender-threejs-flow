// title: Matte
// note: A soft-touch matte card. It scatters light evenly: no glint, only a slow fall from the lit side to the shaded one and a fine grain. Move the pointer to move the lamp.
// order: 2
#define BASE vec3(0.47, 0.42, 0.4)   // colour of the card
#define BEVEL 9.0                    // width of the rounded edge, px
#define GRAIN 0.035                  // fine surface speckle

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, BEVEL);
  vec3 normal = normalOf(-edge.yz * edge.x * edge.x);
  look.milk = 1.0;
  look.shine = 0.0;
  look.grain = GRAIN;
  look.tint = BASE * (0.36 + 0.7 * diffuse(normal, p, 0.6));
  look.light = vec3(gleam(normal, p, 4.0) * 0.035);
}
