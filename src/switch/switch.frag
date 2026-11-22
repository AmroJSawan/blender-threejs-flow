// Two tactile switches drawn entirely in this shader: no images, no 3D model.
// Nothing here is a painted-on shadow or highlight. The switch is described once, as a height
// above the sheet for every point (`height`): the sheet is 0, the track is cut down into it, the
// knob stands up from the track's floor. All light and shade then follow from that shape:
// each point is lit by how it faces the light, is in shadow if the shape blocks its line to the
// light, and is a little darker where walls crowd it. So every shadow is attached to what casts it.
precision highp float;
varying vec2 vUv;
uniform vec2 uSize;        // picture size, CSS pixels
uniform float uPixelRatio;
uniform float uScale;      // CSS pixels per design pixel
uniform vec2 uCentre[2];   // centre of each switch, CSS pixels from the bottom left
uniform float uOn[2];      // where each knob is: 0 = off (left) … 1 = on (right)

// Shape, in design pixels.
#define W 150.0     // half length of the track
#define H 78.0      // half height of the track
#define LIP 9.0     // width of the sloping wall between sheet and track floor
#define DEPTH 22.0  // how deep the track is cut into the sheet
#define KNOB 72.0   // knob radius
#define FACE 57.0   // radius of the knurled face inside the knob
#define RISE 5.0    // how far the knob's top stands above the sheet
#define CELL 7.0    // size of one knurl pyramid
// Light.
#define SUN vec3(-0.26, 0.72, 0.64)  // direction to the light: above, slightly left, toward the viewer
#define AMBIENT 0.56                 // light that reaches everything, even in shadow
#define SOFT 1.3                     // shadow edge: higher = harder
#define STEPS 22                     // samples along the line to the light
// Colours.
#define ACCENT vec3(0.985, 0.5, 0.04)   // track when on
#define OFF vec3(0.43, 0.43, 0.44)      // track when off
#define WALL vec3(0.93, 0.925, 0.915)   // the sloping wall round the track
#define BODY vec3(0.955, 0.95, 0.945)   // knob
#define GRIP vec3(0.9, 0.895, 0.89)     // its knurled face

float knobAt; // knob position of the switch being drawn

/** Distance to a pill lying on its side (negative inside). */
float pill(vec2 p, vec2 half_) {
  return length(vec2(max(abs(p.x) - (half_.x - half_.y), 0.0), p.y)) - half_.y;
}
/** 1 inside a shape, 0 outside, one screen pixel of soft edge. */
float cover(float distance_) { return smoothstep(0.75, -0.75, distance_ * uPixelRatio * uScale); }

/** Rows of tiny pyramids: 0 in the grooves, 1 at each tip. */
float knurl(vec2 k) {
  vec2 a = abs(fract(mat2(0.7071, -0.7071, 0.7071, 0.7071) * k / CELL) - 0.5);
  return 1.0 - 2.0 * max(a.x, a.y);
}

/** Height of the switch above the sheet at `p`, design pixels. */
float height(vec2 p) {
  // The track: a pill cut into the sheet, with a sloping wall.
  float h = -DEPTH * smoothstep(0.0, -LIP, pill(p, vec2(W + LIP, H + LIP)));
  // Marks pressed into its floor: a slot on the on side, a ring on the off side.
  vec2 slot = p - vec2(-W + 50.0, 0.0);
  h -= 1.6 * smoothstep(1.0, -1.0, length(vec2(slot.x, max(abs(slot.y) - 13.0, 0.0))) - 3.2);
  h -= 1.6 * smoothstep(1.0, -1.0, abs(length(p - vec2(W - 50.0, 0.0)) - 17.0) - 3.2);
  // The knob: a puck standing on the floor, with a rounded shoulder and a knurled face set slightly in.
  vec2 k = p - vec2(mix(-(W - H), W - H, knobAt), 0.0);
  float r = length(k);
  if (r < KNOB + 2.0) {
    float top = RISE - 3.5 * (r * r) / (KNOB * KNOB) - 3.0 * pow(smoothstep(FACE + 6.0, KNOB, r), 2.0) - 1.6 * smoothstep(FACE + 1.2, FACE - 1.2, r); // gently domed
    top += 1.3 * knurl(k) * smoothstep(FACE - 1.0, FACE - 5.0, r);
    h = mix(h, top, smoothstep(KNOB + 0.8, KNOB - 0.8, r));
  }
  return h;
}

/** One switch, lit. `sheet` is the colour of the surface it is cut into. */
vec3 drawSwitch(vec2 p, float on, vec3 sheet) {
  float outer = pill(p, vec2(W + LIP, H + LIP));
  if (outer > 2.0) return sheet; // nothing rises high enough to shade the sheet beyond the rim
  knobAt = on;
  float h = height(p);
  vec3 sun = normalize(SUN);

  // How the surface faces: from the height just left/right and below/above.
  float e = 0.8;
  vec3 normal = normalize(vec3(height(p - vec2(e, 0.0)) - height(p + vec2(e, 0.0)), height(p - vec2(0.0, e)) - height(p + vec2(0.0, e)), 2.0 * e));
  float facing = min(max(dot(normal, sun), 0.0) / sun.z, 1.3); // 1 on flat ground

  // Cast shadow: walk toward the light and see how nearly the shape blocks the way.
  vec2 toward = normalize(sun.xy);
  float climb = sun.z / length(sun.xy);
  float open = 1.0;
  for (int i = 1; i <= STEPS; i++) {
    float t = float(i) * 2.0;
    open = min(open, SOFT * (h + 0.6 + t * climb - height(p + toward * t)) / t);
  }
  open = clamp(open, 0.0, 1.0);

  // Crowding: less of the room's light reaches a point with walls close by.
  float walls = max(height(p + vec2(6.0, 0.0)) - h, 0.0) + max(height(p - vec2(6.0, 0.0)) - h, 0.0)
              + max(height(p + vec2(0.0, 6.0)) - h, 0.0) + max(height(p - vec2(0.0, 6.0)) - h, 0.0);
  float light = (AMBIENT + (1.0 - AMBIENT) * facing * open) * (1.0 - 0.3 * clamp(walls / 36.0, 0.0, 1.0));

  // What each part is made of.
  vec2 k = p - vec2(mix(-(W - H), W - H, on), 0.0);
  float knob = cover(length(k) - KNOB);
  vec3 colour = mix(sheet, WALL, cover(outer));
  colour = mix(colour, mix(OFF, ACCENT, smoothstep(0.1, 0.9, clamp(on, 0.0, 1.0))), cover(outer + LIP - 1.0));
  colour = mix(colour, mix(BODY, GRIP, cover(length(k) - FACE)), knob);

  // In shade a colour gets deeper, not just greyer.
  colour = pow(colour, vec3(1.0 + 0.75 * clamp(1.0 - light, 0.0, 1.0))) * light;
  // The knob is smooth enough to show a soft glint of the light.
  colour += knob * 0.1 * pow(max(dot(normal, normalize(sun + vec3(0.0, 0.0, 1.0))), 0.0), 24.0);
  return colour;
}

void main() {
  // The sheet: evenly lit from above, with a trace of film grain.
  vec3 sheet = mix(vec3(0.83, 0.83, 0.835), vec3(0.935, 0.935, 0.94), smoothstep(0.0, 1.0, vUv.y));
  vec3 colour = sheet;
  vec2 px = vUv * uSize;
  for (int i = 0; i < 2; i++) {
    vec2 p = (px - uCentre[i]) / uScale;
    if (abs(p.y) < H + LIP + 4.0) colour = drawSwitch(p, uOn[i], sheet);
  }
  colour += (fract(sin(dot(gl_FragCoord.xy, vec2(127.1, 311.7))) * 43758.5453) - 0.5) * 0.014;
  gl_FragColor = vec4(colour, 1.0);
}
