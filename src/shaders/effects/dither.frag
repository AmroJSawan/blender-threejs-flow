// Screen effect: two-colour ordered dithering, like an old one-bit display.
precision highp float;
uniform sampler2D uScene;
uniform vec2 uBuffer;
uniform float uPixelRatio;

const float PIXEL = 2.0;                  // size of one dot, in CSS pixels
const vec3 DARK = vec3(0.05, 0.06, 0.16);
const vec3 LIGHT = vec3(0.96, 0.9, 0.76);
const float GAIN = 1.7;                   // brightens the picture before it is reduced to two colours

// 4 × 4 Bayer pattern: a different threshold for each dot of a small tile.
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  float size = PIXEL * uPixelRatio;
  vec2 cell = floor(gl_FragCoord.xy / size);
  vec3 color = texture2D(uScene, (cell + 0.5) * size / uBuffer).rgb;
  float brightness = dot(color, vec3(0.299, 0.587, 0.114)) * GAIN;
  gl_FragColor = vec4(mix(DARK, LIGHT, step(bayer4(cell) + 0.03, brightness)), 1.0);
}
