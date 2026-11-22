// title: Orchid
// note: The other way round: the middle is filled with violet and the edges cool to blue, then cyan along the bottom. A cluster of dots pulses at the centre; a tap sends a brighter pulse through it.
// order: 12
// springs: 0.7
// radius: 58
#define MIDDLE vec3(0.4, 0.22, 0.86)
#define EDGE_TOP vec3(0.3, 0.4, 0.95)
#define EDGE_LOW vec3(0.22, 0.78, 0.95)
#define REACH 0.5
#define DOTS 0.058    // spacing of the dots, as a share of the card's width
#define SWELL 0.6

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = inset(p, min(uSize.x, uSize.y) * REACH);
  float toward = max(1.0 + 0.3 * dot(edge.yz, uFollow / (uSize * 0.5)), 0.3);
  float soak = clamp(pow(edge.x, 1.7) * toward, 0.0, 1.0);
  vec3 cool = mix(EDGE_LOW, EDGE_TOP, smoothstep(0.0, 0.75, uv.y));

  // A 4 × 4 cluster of dots: the middle four are largest, the corners faintest, and a pulse runs outward.
  float spacing = uSize.x * DOTS;
  vec2 cell = floor(p / spacing + 2.0);
  vec2 inCell = p - (cell - 1.5) * spacing;
  float inside = step(0.0, cell.x) * step(cell.x, 3.0) * step(0.0, cell.y) * step(cell.y, 3.0);
  float out_ = length(cell - 1.5); // 0.7 for the middle four … 2.1 for the corners
  float pulse = 0.5 + 0.5 * sin(uTime * 2.2 - out_ * 1.8);
  float size = spacing * mix(0.36, 0.2, smoothstep(0.7, 2.1, out_)) * (0.85 + 0.15 * pulse);
  float dot_ = smoothstep(0.8, -0.8, length(inCell) - size) * inside;
  float bright = mix(0.95, 0.3, smoothstep(0.7, 2.1, out_)) * (0.7 + 0.3 * pulse) + exp(-uAge / SWELL) * 0.5;

  look.blur = 20.0;
  look.milk = 1.0;
  look.shine = 0.0;
  look.edge = 0.0;
  look.tint = mix(MIDDLE * (0.8 + 0.2 * uv.y), cool, soak) * 0.82;
  look.light = vec3(0.92, 0.9, 1.0) * dot_ * bright;
  look.light += cool * 0.3 * smoothstep(1.4, 0.0, (1.0 - inset(p, 3.0).x) * 3.0);
}
