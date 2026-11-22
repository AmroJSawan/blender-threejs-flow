// title: Knurled
// note: A track cut into the sheet, with a knurled knob standing on its floor. The floor turns from graphite to orange.
// order: 1
// ink: dark
#define HALF vec2(161.0, 89.0)   // outline of the whole switch, half width and height
#define REACH 2.0                // how far past the outline its shadows fall on the sheet
#define SHEET_TOP vec3(0.935, 0.935, 0.94)
#define SHEET_BOTTOM vec3(0.83, 0.83, 0.835)
#define LIP 11.0    // width of the sloping wall between sheet and track floor
#define DEPTH 22.0  // how deep the track is cut
#define TRAVEL 72.0 // how far the knob moves either side of the middle
#define KNOB 72.0   // knob radius
#define FACE 57.0   // radius of the knurled face inside the knob
#define RISE 5.0    // how far the knob's top stands above the sheet
#define CELL 7.0    // size of one knurl pyramid
#define ACCENT vec3(0.985, 0.5, 0.04)   // floor when on
#define OFF vec3(0.43, 0.43, 0.44)      // floor when off
#define WALL vec3(0.93, 0.925, 0.915)
#define BODY vec3(0.955, 0.95, 0.945)
#define GRIP vec3(0.9, 0.895, 0.89)

/** Rows of tiny pyramids: 0 in the grooves, 1 at each tip. */
float knurl(vec2 k) {
  vec2 a = abs(fract(mat2(0.7071, -0.7071, 0.7071, 0.7071) * k / CELL) - 0.5);
  return 1.0 - 2.0 * max(a.x, a.y);
}

float height(vec2 p) {
  float h = -DEPTH * smoothstep(0.0, -LIP, pill(p, HALF));
  // Marks pressed into the floor: a slot on the on side, a ring on the off side.
  vec2 slot = p - vec2(-100.0, 0.0);
  h -= 1.6 * smoothstep(1.0, -1.0, length(vec2(slot.x, max(abs(slot.y) - 13.0, 0.0))) - 3.2);
  h -= 1.6 * smoothstep(1.0, -1.0, abs(length(p - vec2(100.0, 0.0)) - 17.0) - 3.2);
  // The knob: a gently domed puck with a knurled face set slightly in.
  vec2 k = p - vec2(mix(-TRAVEL, TRAVEL, knobAt), 0.0);
  float r = length(k);
  if (r < KNOB + 2.0) {
    float top = RISE - 5.0 * (r * r) / (KNOB * KNOB) - 1.2 * pow(smoothstep(FACE + 8.0, KNOB, r), 2.0) - 1.2 * smoothstep(FACE + 1.5, FACE - 1.5, r);
    top += 1.0 * knurl(k) * smoothstep(FACE - 1.0, FACE - 5.0, r);
    h = mix(h, top, smoothstep(KNOB + 0.8, KNOB - 0.8, r));
  }
  return h;
}

vec3 paint(vec2 p, vec3 sheet) {
  float outer = pill(p, HALF);
  float r = length(p - vec2(mix(-TRAVEL, TRAVEL, knobAt), 0.0));
  vec3 colour = mix(sheet, WALL, cover(outer));
  colour = mix(colour, mix(OFF, ACCENT, amount()), cover(outer + LIP - 1.0));
  return mix(colour, mix(BODY, GRIP, cover(r - FACE)), cover(r - KNOB));
}

vec3 glow(vec2 p) { return vec3(0.0); }
