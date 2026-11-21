// title: Fluted
// note: Reeded glass. Each rib is a small lens that flips and squeezes what is behind it; the ribs deepen from left to right.
// order: 4
#define RIB 22.0     // width of one rib, px
#define DEEP 1.25    // lean at the edge of a rib on the right side
#define SHALLOW 0.2  // the same on the left side

void glass(vec2 p, vec2 uv, inout Look look) {
  float across = fract(p.x / RIB) - 0.5;
  float grow = mix(SHALLOW, DEEP, smoothstep(0.0, 1.0, uv.x));
  look.slope = vec2(-across * 2.0 * grow, 0.0);
  look.depth = RIB * 1.3;
  look.blur = 1.5 * grow;
  look.split = 0.12;
  look.liquid = 0.2;
}
