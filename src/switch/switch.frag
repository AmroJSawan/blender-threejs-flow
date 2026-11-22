// Tactile switches drawn entirely in a shader: no images, no 3D model.
// Nothing here is a painted-on shadow or highlight. A style file (src/switch/styles/*.glsl)
// describes its switch as a height above the sheet for every point (`height`) and says what each
// part is made of (`paint`). This file does the rest, the same for every style: each point is lit
// by how it faces a large soft light, is shaded as far as the shape blocks its view of that light,
// and is a little darker where walls crowd it. So every shadow is attached to what casts it.
precision highp float;
varying vec2 vUv;
uniform vec2 uSize;        // picture size, CSS pixels
uniform float uPixelRatio;
uniform float uScale;      // CSS pixels per design pixel
uniform vec2 uCentre[2];   // centre of each switch, CSS pixels from the bottom left
uniform float uOn[2];      // where each switch is: 0 = off … 1 = on (a spring, so it can overshoot a little)

// Light.
#define SUN vec3(-0.26, 0.72, 0.64)  // direction to the light: above, slightly left, toward the viewer
#define SPREAD 0.8                   // size of the light: 0 = a bare bulb (hard shadows), larger = a big soft panel
#define WRAP 0.5                     // how far light creeps round onto surfaces facing away
#define AMBIENT 0.5                  // light that reaches everything, even in shadow
#define SOFT 1.0                     // shadow edge from each part of the light: higher = harder
#define STEPS 14                     // samples along each line to the light
#define FALL 44.0                    // how far a shadow can reach, design px; it fades out toward that distance

float knobAt; // position of the switch being drawn, 0…1

/** 0 → 1 as the switch goes from off to on, for colours and lamps. */
float amount() { return smoothstep(0.1, 0.9, clamp(knobAt, 0.0, 1.0)); }
/** Distance to a pill lying on its side (negative inside). */
float pill(vec2 p, vec2 half_) {
  return length(vec2(max(abs(p.x) - (half_.x - half_.y), 0.0), p.y)) - half_.y;
}
/** Distance to a box with rounded corners. */
float box(vec2 p, vec2 half_, float radius) {
  vec2 q = abs(p) - half_ + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}
/** 1 inside a shape, 0 outside, one screen pixel of soft edge. */
float cover(float distance_) { return smoothstep(0.75, -0.75, distance_ * uPixelRatio * uScale); }

// The style provides:  HALF, SHEET_TOP, SHEET_BOTTOM,
//   float height(vec2 p),  vec3 paint(vec2 p, vec3 sheet),  vec3 glow(vec2 p)
#include "style"

/** One switch, lit. `sheet` is the colour of the surface it is set in. */
vec3 drawSwitch(vec2 p, float on, vec3 sheet) {
  knobAt = on;
  float h = height(p);
  // How the surface faces: from the height just left/right and below/above.
  float e = 0.8;
  vec3 normal = normalize(vec3(height(p - vec2(e, 0.0)) - height(p + vec2(e, 0.0)), height(p - vec2(0.0, e)) - height(p + vec2(0.0, e)), 2.0 * e));

  // Soft light: the light is a large panel, not a point. It is sampled at its centre and six
  // places round its edge (turned a little differently for every pixel, which blends the samples);
  // each sample lights the surface by how it faces it, and is blocked or not by the shape on the
  // way there. Averaged, shadow edges become wide, gentle gradients.
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453); // hides the steps
  float spin = fract(sin(dot(gl_FragCoord.xy, vec2(39.346, 11.135))) * 43758.5453);
  float direct = 0.0;
  for (int j = 0; j < 7; j++) {
    float angle = (float(j) + spin) * 1.0472;
    vec3 sun = normalize(SUN + (j == 0 ? vec3(0.0) : SPREAD * vec3(cos(angle), sin(angle), 0.0)));
    float facing = clamp((dot(normal, sun) + WRAP) / (sun.z + WRAP), 0.0, 1.25); // 1 on flat ground
    vec2 toward = normalize(sun.xy);
    float climb = sun.z / length(sun.xy);
    float blocked = 0.0;
    for (int i = 0; i < STEPS; i++) {
      float t = (float(i) + 0.4 + jitter) * FALL / float(STEPS + 1);
      float cleared = SOFT * (h + 0.6 + t * climb - height(p + toward * t)) / (t * climb); // 1 or more on open flat ground
      // Whatever blocks the light counts for less the further away it is, so a shadow is darkest
      // where it touches what casts it and has faded to nothing by FALL.
      blocked = max(blocked, clamp(1.0 - cleared, 0.0, 1.0) * (1.0 - smoothstep(0.4, 1.0, t / FALL)));
    }
    direct += facing * (1.0 - blocked);
  }
  direct /= 7.0;

  // Crowding: less of the room's light reaches a point with walls close by.
  float walls = max(height(p + vec2(6.0, 0.0)) - h, 0.0) + max(height(p - vec2(6.0, 0.0)) - h, 0.0)
              + max(height(p + vec2(0.0, 6.0)) - h, 0.0) + max(height(p - vec2(0.0, 6.0)) - h, 0.0);
  float light = (AMBIENT + (1.0 - AMBIENT) * direct) * (1.0 - 0.3 * clamp(walls / 48.0, 0.0, 1.0));

  // In shade a colour gets deeper, not just greyer. Lamps are added on top, unshaded.
  vec3 colour = paint(p, sheet);
  colour = pow(colour, vec3(1.0 + 0.75 * clamp(1.0 - light, 0.0, 1.0))) * light;
  return colour + glow(p);
}

void main() {
  // The sheet: evenly lit from above, with a trace of film grain.
  vec3 sheet = mix(SHEET_BOTTOM, SHEET_TOP, smoothstep(0.0, 1.0, vUv.y));
  vec3 colour = sheet;
  vec2 px = vUv * uSize;
  // Each point belongs to the nearer of the two switches.
  vec2 first = (px - uCentre[0]) / uScale;
  vec2 second = (px - uCentre[1]) / uScale;
  bool upper = abs(first.y) < abs(second.y);
  vec2 p = upper ? first : second;
  if (abs(p.x) < HALF.x + FALL + 2.0 && abs(p.y) < HALF.y + FALL + 2.0) colour = drawSwitch(p, upper ? uOn[0] : uOn[1], sheet);
  colour += (fract(sin(dot(gl_FragCoord.xy, vec2(127.1, 311.7))) * 43758.5453) - 0.5) * 0.014;
  gl_FragColor = vec4(colour, 1.0);
}
