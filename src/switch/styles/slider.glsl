// title: Slider
// note: A block with three finger ridges sliding in a dark slot. Pushed across, it uncovers a green lamp at the far end.
// order: 4
// ink: dark
#define HALF vec2(152.0, 52.0)
#define SHEET_TOP vec3(0.94, 0.93, 0.915)
#define SHEET_BOTTOM vec3(0.84, 0.83, 0.81)
#define DEPTH 16.0   // how deep the slot is
#define TRAVEL 78.0
#define BLOCK vec2(60.0, 39.0)  // half size of the sliding block
#define RIDGE 11.0              // spacing of the finger ridges
#define LAMP vec3(0.25, 1.0, 0.45)
#define LAMP_AT vec2(-124.0, 0.0)

float block(vec2 p) { return box(p - vec2(mix(-TRAVEL, TRAVEL, knobAt), 0.0), BLOCK, 15.0); }
float lamp(vec2 p) { vec2 q = p - LAMP_AT; return length(vec2(q.x, max(abs(q.y) - 13.0, 0.0))) - 3.0; }

float height(vec2 p) {
  float h = -DEPTH * smoothstep(0.0, -8.0, pill(p, HALF));
  vec2 k = p - vec2(mix(-TRAVEL, TRAVEL, knobAt), 0.0);
  float edge = block(p);
  float top = 4.0 - 3.0 * pow(smoothstep(-14.0, 0.0, edge), 2.0); // rounded shoulders
  top += 1.8 * (0.5 + 0.5 * cos(k.x * 6.2832 / RIDGE)) * smoothstep(RIDGE * 1.5, RIDGE * 1.5 - 2.0, abs(k.x)) * smoothstep(26.0, 21.0, abs(k.y));
  return mix(h, top, smoothstep(1.0, -1.0, edge));
}

vec3 paint(vec2 p, vec3 sheet) {
  vec3 colour = mix(sheet, vec3(0.12, 0.12, 0.13), cover(pill(p, HALF) + 7.0));
  colour = mix(colour, mix(vec3(0.2, 0.21, 0.2), LAMP, amount()), cover(lamp(p)));
  return mix(colour, vec3(0.965, 0.96, 0.95), cover(block(p)));
}

vec3 glow(vec2 p) { return LAMP * amount() * (1.0 - cover(block(p))) * (0.35 * cover(lamp(p)) + 0.3 * exp(-max(lamp(p), 0.0) / 10.0)); }
