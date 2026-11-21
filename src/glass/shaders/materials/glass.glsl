// title: Glass
// note: Modern glass: a lightly frosted pane that softens what is behind it, with a rounded rim that bends the picture and splits its colours. The lamp's soft highlight follows the pointer.
// order: 1
#define FROST 20.0   // blur, px
#define BODY 0.12    // how milky the pane is
#define RIM 14.0     // width of the rounded rim, px

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, RIM);
  look.slope = -edge.yz * edge.x * edge.x * 1.1;
  look.blur = FROST;
  look.split = 0.12;
  look.tint = vec3(0.94, 0.97, 1.0);
  look.milk = BODY;
  look.grain = 0.02;
  look.light = vec3(0.95, 0.98, 1.0) * gleam(normalOf(look.slope), p, 30.0) * 0.14;
}
