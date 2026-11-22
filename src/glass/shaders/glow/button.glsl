// title: Button
// note: A dark button lit from inside: a strong glow under its top edge that wraps round both upper corners, and a slighter one all the way round. The bright spot slides after the pointer. Tap to press it: it sinks, flares and settles.
// order: 9
// springs: 0.7
#define GLOW vec3(0.5, 0.6, 1.0)    // colour of the inner glow
#define LINE vec3(0.9, 0.93, 1.0)   // colour of the thin line right at the edge
#define WIDE 0.7      // button width, as a share of the card's width
#define TALL 68.0     // button height, px
#define TOP 1.0       // strength of the glow under the top edge
#define ROUND 0.2     // strength of the slighter glow round every edge
#define WRAP 0.45     // how far the top glow runs down the two sides (0 = top only, 1 = right round)
#define REACH 15.0    // how deep the top glow reaches into the button, px
#define THIN 6.0      // how deep the all-round glow reaches, px
#define PRESS 0.3     // seconds a press takes to settle

/** 1 at the moment of a tap, falling back to 0. */
float pressed() { return exp(-uAge / PRESS); }

float toSegment(vec2 p, vec2 a, vec2 b) {
  vec2 along = b - a;
  return length(p - a - along * clamp(dot(p - a, along) / dot(along, along), 0.0, 1.0));
}

/** Distance to the arrow drawn on the button, px. */
float arrow(vec2 p) {
  float shaft = toSegment(p, vec2(-11.0, 0.0), vec2(11.0, 0.0));
  float head = min(toSegment(p, vec2(11.0, 0.0), vec2(4.0, 7.0)), toSegment(p, vec2(11.0, 0.0), vec2(4.0, -7.0)));
  return min(shaft, head);
}

void glass(vec2 p, vec2 uv, inout Look look) {
  float press = pressed();
  vec2 half_ = vec2(uSize.x * WIDE, TALL) * 0.5;
  vec3 button = roundedBox(p * (1.0 + 0.04 * press), half_, half_.y); // a pressed button looks a little smaller
  float inside = -button.x; // px in from the button's edge
  float on = smoothstep(-0.7, 0.7, inside);

  // The panel the button sits on, darker just under the button where its shadow falls.
  float under = roundedBox(p + vec2(0.0, 9.0 * (1.0 - press)), half_, half_.y).x;
  look.blur = 18.0;
  look.milk = 0.92;
  look.shine = 1.0 - on;
  look.tint = mix(vec3(0.035, 0.04, 0.06) * (1.0 - 0.75 * smoothstep(22.0, -4.0, under)), vec3(0.055, 0.065, 0.11), on);

  // Inner glow. `top` is 1 under the top edge, fades down the sides and is 0 along the bottom.
  float top = smoothstep(-WRAP, 1.0, button.z);
  float spot = exp(-pow((p.x - uFollow.x) / (half_.x * 0.55), 2.0)); // brightest where the pointer is
  float depth = max(inside, 0.0);
  float fade = smoothstep(half_.y, half_.y * 0.4, depth); // gone by the middle, so top and bottom halves meet without a seam
  float glow = TOP * top * (0.6 + 0.6 * spot) * exp(-depth / REACH) * fade + ROUND * exp(-depth / THIN);
  float line = smoothstep(1.6, 0.2, depth) * (0.25 + 0.75 * top);
  float power = (0.94 + 0.06 * sin(uTime * 1.7)) * (1.0 + 1.3 * press);
  look.light = on * power * (GLOW * glow + LINE * line * 0.8);

  // The arrow, and a little of the button's light spilling onto the panel above it.
  look.light += on * LINE * smoothstep(1.9, 0.9, arrow(p)) * (0.8 + 0.4 * press);
  look.light += (1.0 - on) * GLOW * 0.2 * soak(p, 0.42); // the same light soaking in round the rim, turning the corners with the card
  look.light += (1.0 - on) * GLOW * 0.16 * power * top * exp(-max(button.x, 0.0) / 14.0);
}
