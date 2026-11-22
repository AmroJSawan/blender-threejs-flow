// title: Smoke
// note: A near-black card with pale light soaking in from every edge and fading to nothing toward the middle. The light gathers on the side the pointer is on; a tap makes it swell.
// order: 10
// springs: 0.7
#define GLOW vec3(0.74, 0.73, 0.84)  // colour of the light at the edge
#define BODY vec3(0.012, 0.013, 0.02) // colour of the dark middle
#define REACH 0.46    // how far in the light reaches, as a share of the card's width (0.5 = to the middle)
#define POWER 0.4    // its brightness right at the edge
#define GATHER 0.45   // how much it gathers toward the pointer
#define SWELL 0.5     // seconds a tap's swell lasts

/** A ruler of fine ticks across the card, sliding with the pointer. */
float ticks(vec2 p) {
  float x = p.x - uFollow.x * 0.25;
  float index = floor(x / 11.0 + 0.5);
  float tall = mod(index, 4.0) < 0.5 ? 11.0 : 6.0;
  float mark = smoothstep(1.3, 0.5, abs(x - index * 11.0)) * smoothstep(tall + 1.0, tall, abs(p.y + uSize.y * 0.07));
  return mark * smoothstep(uSize.x * 0.34, uSize.x * 0.12, abs(p.x));
}

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, min(uSize.x, uSize.y) * REACH); // x: 1 at the rim … 0 at REACH inside; yz: outward direction
  float toward = max(1.0 + GATHER * dot(edge.yz, uFollow / (uSize * 0.5)), 0.2);
  float soak = (pow(edge.x, 1.9) + 0.2 * pow(edge.x, 9.0)) * toward * (1.0 + 0.7 * exp(-uAge / SWELL));
  look.blur = 20.0;
  look.milk = 0.96;
  look.shine = 0.0;
  look.edge = 0.0;
  look.tint = BODY;
  look.light = GLOW * POWER * soak;
  look.light += GLOW * 0.35 * smoothstep(1.4, 0.0, (1.0 - rim(p, 3.0).x) * 3.0); // a fine line right on the rim
  look.light += vec3(0.6) * ticks(p);
}
