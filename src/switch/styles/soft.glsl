// title: Soft
// note: One material throughout: the track is pressed into the sheet and the knob swells out of it, told apart by light alone. A small lamp shows when it is on.
// order: 2
// ink: dark
#define HALF vec2(160.0, 80.0)
#define REACH 2.0
#define SHEET_TOP vec3(0.925, 0.935, 0.95)
#define SHEET_BOTTOM vec3(0.82, 0.835, 0.86)
#define DEPTH 10.0   // how deep the track is pressed in
#define SLOPE 18.0   // width of its sloping wall
#define TRAVEL 82.0
#define KNOB 62.0    // knob radius
#define SWELL 8.0    // how far the knob's top stands above the sheet
#define LAMP vec3(0.2, 1.0, 0.52)
#define LAMP_AT vec2(-98.0, 0.0)

/** 1 where the knob is, 0 elsewhere. */
float underKnob(vec2 p) { return smoothstep(KNOB, KNOB - 8.0, length(p - vec2(mix(-TRAVEL, TRAVEL, knobAt), 0.0))); }

float height(vec2 p) {
  float h = -DEPTH * smoothstep(0.0, -SLOPE, pill(p, HALF));
  h -= 2.0 * smoothstep(1.5, -1.5, length(p - LAMP_AT) - 7.0); // the lamp sits in a small dimple
  float r = length(p - vec2(mix(-TRAVEL, TRAVEL, knobAt), 0.0));
  return mix(h, SWELL - 5.0 * (r * r) / (KNOB * KNOB), smoothstep(KNOB, KNOB - 11.0, r));
}

vec3 paint(vec2 p, vec3 sheet) {
  float lens = cover(length(p - LAMP_AT) - 5.5) * (1.0 - underKnob(p));
  return mix(sheet, mix(sheet * 0.72, LAMP, amount()), lens);
}

vec3 glow(vec2 p) {
  float d = length(p - LAMP_AT);
  return LAMP * amount() * (1.0 - underKnob(p)) * (0.35 * cover(d - 5.5) + 0.3 * exp(-d / 9.0));
}
