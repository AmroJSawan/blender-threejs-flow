// title: Jelly
// note: A soft gel slab on loose springs. Drag and let go: it stretches along its path, overshoots and wobbles back.
// order: 9
// springs: 2.4
#define WIDTH 34.0   // width of the rounded edge, px

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, WIDTH);
  look.slope = -edge.yz * 1.2 * edge.x * edge.x;
  look.depth = 40.0;
  look.blur = 6.0;
  look.split = 0.1;
  look.tint = vec3(1.0, 0.5, 0.68);
  look.milk = 0.3;
  look.liquid = 1.0;
}
