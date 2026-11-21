// title: Fluted
// note: Reeded glass whose ribs ring like harp strings. Sweep the pointer across to pluck them: each rib swings, drags its neighbours and falls still. The ribs deepen from left to right.
// order: 4
// springs: 0.7
#define DEEP 1.25    // lean at the edge of a rib on the right side
#define SHALLOW 0.2  // the same on the left side

void glass(vec2 p, vec2 uv, inout Look look) {
  float x = p.x + uSize.x * 0.5;
  int rib = int(clamp(floor(x / uRib), 0.0, 31.0));
  float swing = uRibs[rib] * sin(uv.y * 3.14159); // held at both ends, widest in the middle
  float across = clamp((x - swing) / uRib - float(rib), 0.0, 1.0) - 0.5;
  float grow = mix(SHALLOW, DEEP, smoothstep(0.0, 1.0, uv.x));
  look.slope = vec2(-across * 2.0 * grow, 0.0);
  look.depth = uRib * 1.3;
  look.blur = 1.5 * grow;
  look.split = 0.12;
}
