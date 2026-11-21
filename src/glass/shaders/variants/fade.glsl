// title: Progressive blur
// note: Sharp at the top, melting into deep frost at the bottom. The blur radius grows smoothly down the card.
// order: 3
#define BLUR 34.0    // blur radius at the bottom, px
#define FROM 0.95    // height where the blur starts (1 = top)
#define TO 0.15      // height where it is full
#define MILK 0.12

void glass(vec2 p, vec2 uv, inout Look look) {
  float deep = smoothstep(FROM, TO, uv.y);
  vec3 edge = rim(p, 12.0);
  look.slope = -edge.yz * 0.7 * edge.x;
  look.blur = BLUR * deep * deep;
  look.milk = MILK * deep;
  look.grain = 0.03 * deep;
}
