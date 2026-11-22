// title: Ball
// note: A white ball rolling in a rounded groove. The groove fills with blue as the ball crosses to the on side.
// order: 5
// ink: dark
#define HALF vec2(156.0, 70.0)
#define SHEET_TOP vec3(0.9, 0.925, 0.96)
#define SHEET_BOTTOM vec3(0.79, 0.82, 0.87)
#define DEPTH 20.0   // how deep the groove is
#define ROUND 30.0   // how far in from the rim its wall keeps curving
#define TRAVEL 90.0
#define BALL 52.0    // ball radius
#define FLAT 0.5     // how flattened the ball is drawn (1 = a true half sphere, which throws very long shadows)
#define ON vec3(0.15, 0.43, 1.0)
#define OFF vec3(0.72, 0.75, 0.81)

float height(vec2 p) {
  float in_ = clamp(-pill(p, HALF) / ROUND, 0.0, 1.0);
  float h = -DEPTH * (1.0 - (1.0 - in_) * (1.0 - in_)); // steep at the rim, levelling out to the floor
  float r = length(p - vec2(mix(-TRAVEL, TRAVEL, knobAt), 0.0));
  if (r < BALL) h = max(h, -DEPTH + FLAT * sqrt(BALL * BALL - r * r));
  return h;
}

vec3 paint(vec2 p, vec3 sheet) {
  vec3 colour = mix(sheet, mix(OFF, ON, amount()), cover(pill(p, HALF)));
  return mix(colour, vec3(0.975, 0.975, 0.98), cover(length(p - vec2(mix(-TRAVEL, TRAVEL, knobAt), 0.0)) - BALL + 0.5));
}

/** The ball is glazed: it shows a soft reflection of the light on the side facing it. */
vec3 glow(vec2 p) {
  vec2 k = p - vec2(mix(-TRAVEL, TRAVEL, knobAt), 0.0);
  vec2 from = (k - vec2(-0.3, 0.36) * BALL) / (BALL * 0.34);
  return vec3(0.1) * exp(-dot(from, from)) * cover(length(k) - BALL);
}
