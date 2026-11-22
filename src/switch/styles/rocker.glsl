// title: Rocker
// note: A rocker plate in a dark panel. It pivots on its middle: the pressed side sinks into the panel, the other side lifts, and the mark on the pressed side lights.
// order: 3
// ink: light
#define HALF vec2(128.0, 78.0)
#define SHEET_TOP vec3(0.215, 0.22, 0.235)
#define SHEET_BOTTOM vec3(0.14, 0.145, 0.16)
#define PLATE vec2(116.0, 66.0)  // half size of the rocker plate
#define ROCK 0.085               // how steeply it tips
#define ACCENT vec3(1.0, 0.52, 0.08)
#define MARK vec3(0.6, 0.61, 0.63)

float bar(vec2 p) { return length(vec2(p.x - 62.0, max(abs(p.y) - 15.0, 0.0))) - 3.0; }  // the "on" mark
float ring(vec2 p) { return abs(length(p - vec2(-62.0, 0.0)) - 14.0) - 3.0; }            // the "off" mark

float height(vec2 p) {
  float h = -9.0 * smoothstep(0.0, -7.0, box(p, HALF, 20.0)); // the opening in the panel
  float side = knobAt * 2.0 - 1.0;                             // +1 = right side pressed (on)
  float plate = 3.0 - side * p.x * ROCK + 0.00035 * p.x * p.x; // tipped, and slightly hollow along its length
  return mix(h, plate, smoothstep(1.0, -1.0, box(p, PLATE, 14.0)));
}

vec3 paint(vec2 p, vec3 sheet) {
  vec3 colour = mix(sheet, vec3(0.07, 0.072, 0.08), cover(box(p, HALF, 20.0) + 5.0));
  colour = mix(colour, vec3(0.2, 0.205, 0.22), cover(box(p, PLATE, 14.0)));
  colour = mix(colour, MARK, cover(ring(p)));
  return mix(colour, mix(MARK, ACCENT, amount()), cover(bar(p)));
}

vec3 glow(vec2 p) { return ACCENT * amount() * (0.45 * cover(bar(p)) + 0.28 * exp(-max(bar(p), 0.0) / 9.0)); }
