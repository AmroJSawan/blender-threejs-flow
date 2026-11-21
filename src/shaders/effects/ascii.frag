// Screen effect: the picture as coloured text characters. Brighter areas get denser characters.
precision highp float;
uniform sampler2D uScene;
uniform vec2 uBuffer;
uniform float uPixelRatio;

const float CELL = 9.0; // size of one character, in CSS pixels
const float GAIN = 1.25; // brightens the picture before characters are chosen
const float INK = 1.5;   // brightness of the characters themselves

// Each character is a 5 × 5 grid of on/off dots packed into one whole number.
float character(int dots, vec2 p) {
  p = floor(p * vec2(4.0, -4.0) + 2.5);
  if (clamp(p.x, 0.0, 4.0) != p.x || clamp(p.y, 0.0, 4.0) != p.y) return 0.0;
  return float((dots >> int(p.x + 5.0 * p.y)) & 1);
}

void main() {
  float size = CELL * uPixelRatio;
  vec2 cell = floor(gl_FragCoord.xy / size);
  vec3 color = texture2D(uScene, (cell + 0.5) * size / uBuffer).rgb;
  float brightness = dot(color, vec3(0.299, 0.587, 0.114)) * GAIN;

  int dots = 0;                               // (space)
  if (brightness > 0.06) dots = 4096;         // .
  if (brightness > 0.16) dots = 65600;        // :
  if (brightness > 0.28) dots = 163153;       // *
  if (brightness > 0.40) dots = 15255086;     // o
  if (brightness > 0.52) dots = 13121101;     // &
  if (brightness > 0.64) dots = 15252014;     // 8
  if (brightness > 0.76) dots = 13195790;     // @
  if (brightness > 0.88) dots = 11512810;     // #

  vec2 inside = fract(gl_FragCoord.xy / size) * 2.0 - 1.0;
  vec3 ink = min(color * INK, 1.0);
  gl_FragColor = vec4(mix(vec3(0.02, 0.025, 0.04), ink, character(dots, inside)), 1.0);
}
