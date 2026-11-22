// title: Dish
// note: The reverse of the others: the bar stands up from the sheet and the thumb rest is a shallow dish pressed into it. One clay material; the dish turns cream when on.
// order: 6
// ink: dark
#define HALF vec2(156.0, 74.0)
#define REACH 60.0
#define SHEET_TOP vec3(0.86, 0.66, 0.56)
#define SHEET_BOTTOM vec3(0.74, 0.54, 0.45)
#define RAISE 11.0   // how far the bar stands above the sheet
#define SLOPE 14.0   // width of its rounded edge
#define TRAVEL 80.0
#define DISH 56.0    // dish radius
#define HOLLOW 10.0  // how deep the dish is
#define CREAM vec3(0.97, 0.91, 0.83)

float fromDish(vec2 p) { return length(p - vec2(mix(-TRAVEL, TRAVEL, knobAt), 0.0)); }

float height(vec2 p) {
  float h = RAISE * smoothstep(0.0, -SLOPE, pill(p, HALF));
  float r = fromDish(p);
  if (r < DISH) h -= HOLLOW * smoothstep(0.0, 1.0, 1.0 - (r * r) / (DISH * DISH));
  return h;
}

vec3 paint(vec2 p, vec3 sheet) {
  return mix(sheet, mix(sheet * 0.9, CREAM, amount()), smoothstep(DISH - 2.0, DISH - 12.0, fromDish(p)));
}

vec3 glow(vec2 p) { return vec3(0.0); }
