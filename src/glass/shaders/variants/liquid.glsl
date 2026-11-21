// title: Liquid
// note: A skin of water. Move over the card to stir it, drag the card to slosh it; waves travel, bounce off the rim and settle.
// order: 11
// stretch: 0.3
#define WAVES 2.6    // how strongly the waves bend the picture

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, 14.0);
  look.slope = -edge.yz * 0.8 * edge.x;
  look.depth = 46.0;
  look.split = 0.14;
  look.tint = vec3(0.7, 0.9, 1.0);
  look.milk = 0.06;
  look.liquid = WAVES;
}
