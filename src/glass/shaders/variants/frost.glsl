// title: Frost
// note: Frosted over. Rub it with the pointer to wipe a clear patch; the frost creeps back in from the edges within a few seconds.
// order: 2
// springs: 0.7
#define BLUR 18.0    // blur radius, px
#define MILK 0.12    // 0 = clear, 1 = white
#define GRAIN 0.045

void glass(vec2 p, vec2 uv, inout Look look) {
  float frosted = 1.0 - smoothstep(0.05, 0.7, texture2D(uFog, uv).r);
  vec3 edge = rim(p, 12.0);
  look.slope = -edge.yz * 0.7 * edge.x;
  look.blur = BLUR * frosted;
  look.milk = MILK * frosted;
  look.grain = GRAIN * frosted;
}
