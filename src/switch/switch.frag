// Two tactile switches drawn entirely in this shader: no images, no 3D model.
// Each is built the way the look is built in a design tool, from stacked simple shapes:
// backdrop → bezel ring → recessed track with the shadow of its upper lip → embossed marks →
// the knob's shadow → the knob's bevel ring → its knurled face.
precision highp float;
varying vec2 vUv;
uniform vec2 uSize;        // picture size, CSS pixels
uniform float uPixelRatio;
uniform float uScale;      // CSS pixels per design pixel
uniform vec2 uCentre[2];   // centre of each switch, CSS pixels from the bottom left
uniform float uOn[2];      // where each knob is: 0 = off (left) … 1 = on (right)

#define W 150.0     // half length of the track, design px
#define H 78.0      // half height of the track
#define LIP 9.0     // width of the bezel ring
#define KNOB 72.0   // knob radius
#define FACE 57.0   // radius of the knurled face inside the knob
#define CELL 7.0    // size of one knurl pyramid
#define ACCENT vec3(0.985, 0.49, 0.03)  // track colour when on
#define OFF vec3(0.4, 0.4, 0.41)        // track colour when off

/** Distance to a pill lying on its side (negative inside). */
float pill(vec2 p, vec2 half_) {
  return length(vec2(max(abs(p.x) - (half_.x - half_.y), 0.0), p.y)) - half_.y;
}
/** 1 inside a shape, 0 outside, one screen pixel of soft edge. */
float cover(float distance_) { return smoothstep(0.75, -0.75, distance_ * uPixelRatio * uScale); }

/** The knob's face: rows of tiny pyramids, each side lit by how it faces the light above. */
vec3 knurl(vec2 k) {
  mat2 turn = mat2(0.7071, -0.7071, 0.7071, 0.7071);
  vec2 f = fract(turn * k / CELL) - 0.5;
  vec2 a = abs(f);
  float sideways = smoothstep(-0.07, 0.07, a.x - a.y); // which pair of sides this point is on
  vec2 facing = mix(vec2(0.0, sign(f.y)), vec2(sign(f.x), 0.0), sideways) * turn;
  float lit = dot(facing, normalize(vec2(-0.25, 1.0)));
  float tip = 1.0 - 2.0 * max(a.x, a.y);
  return vec3(0.865, 0.855, 0.845) * (1.0 + 0.12 * lit) + 0.035 * tip;
}

/** A mark pressed into the track: slightly darker, with a light catch on its lower edge. */
void emboss(inout vec3 colour, float shape, float lower) {
  colour *= 1.0 - 0.13 * cover(shape);
  colour += 0.09 * cover(lower) * (1.0 - cover(shape));
}

void drawSwitch(inout vec3 colour, vec2 p, float on) {
  float amount = clamp(on, 0.0, 1.0);
  float outer = pill(p, vec2(W + LIP, H + LIP));
  float inner = pill(p, vec2(W, H));

  // The whole switch sits in the sheet: a soft dark below it and a soft light above.
  colour *= 1.0 - 0.2 * smoothstep(38.0, -6.0, pill(p + vec2(0.0, 12.0), vec2(W + LIP, H + LIP)));
  colour += 0.07 * smoothstep(26.0, 0.0, pill(p - vec2(0.0, 7.0), vec2(W + LIP, H + LIP)));

  // Bezel ring: its upper half turns away from the light, its lower half catches it.
  float up = clamp(p.y / (H + LIP) * 0.5 + 0.5, 0.0, 1.0);
  vec3 bezel = mix(vec3(0.975, 0.97, 0.96), vec3(0.66, 0.64, 0.63), smoothstep(0.1, 0.95, up));
  bezel += 0.1 * smoothstep(2.5, 0.0, -outer) * up; // hairline on the outer top edge
  colour = mix(colour, bezel, cover(outer));

  // Recessed track, darkened under its upper lip and a little all round.
  vec3 track = mix(OFF, ACCENT, smoothstep(0.1, 0.9, amount));
  vec3 inShadow = mix(vec3(0.5), vec3(0.6, 0.27, 0.16), amount);
  float lip = smoothstep(-34.0, 3.0, pill(p + vec2(0.0, 18.0), vec2(W, H)));
  track *= mix(vec3(1.0), inShadow, lip * 0.8);
  track *= 1.0 - 0.16 * smoothstep(-12.0, 0.0, inner);
  track += 0.04 * smoothstep(-16.0, 0.0, pill(p - vec2(0.0, 14.0), vec2(W, H))); // light bouncing off the lower wall

  // Marks: a slot on the on side, a ring on the off side.
  vec2 slot = p - vec2(-W + 50.0, 0.0);
  emboss(track, length(vec2(slot.x, max(abs(slot.y) - 13.0, 0.0))) - 3.2, length(vec2(slot.x - 1.2, max(abs(slot.y + 1.6) - 13.0, 0.0))) - 3.2);
  vec2 ring = p - vec2(W - 50.0, 0.0);
  emboss(track, abs(length(ring) - 17.0) - 3.2, abs(length(ring + vec2(0.0, 1.6)) - 17.0) - 3.2);

  // The knob and the shadow it drops into the track.
  vec2 k = p - vec2(mix(-(W - H), W - H, on), 0.0);
  float knob = length(k) - KNOB;
  track *= mix(vec3(1.0), inShadow * 0.8, 0.8 * smoothstep(30.0, -8.0, length(k + vec2(0.0, 12.0)) - KNOB));
  colour = mix(colour, track, cover(inner));

  // Bevel ring of the knob: lit from above. Then the face, set slightly in.
  float lift = clamp(k.y / KNOB * 0.5 + 0.5, 0.0, 1.0);
  vec3 body = mix(vec3(0.7, 0.685, 0.675), vec3(0.99, 0.985, 0.98), smoothstep(0.0, 0.9, lift));
  float face = length(k) - FACE;
  vec3 knurled = knurl(k) * (1.0 - 0.2 * smoothstep(-12.0, 0.0, length(k - vec2(0.0, -4.0)) - FACE));
  body = mix(body, body * 0.86, smoothstep(2.5, 0.0, abs(face))); // the seam between ring and face
  body = mix(body, knurled, cover(face));
  colour = mix(colour, body, cover(knob));
}

void main() {
  // Backdrop: a sheet lit from above, with a trace of film grain.
  vec3 colour = mix(vec3(0.79, 0.79, 0.795), vec3(0.955, 0.955, 0.96), smoothstep(0.0, 1.0, vUv.y));
  vec2 px = vUv * uSize;
  for (int i = 0; i < 2; i++) drawSwitch(colour, (px - uCentre[i]) / uScale, uOn[i]);
  colour += (fract(sin(dot(gl_FragCoord.xy, vec2(127.1, 311.7))) * 43758.5453) - 0.5) * 0.014;
  gl_FragColor = vec4(colour, 1.0);
}
