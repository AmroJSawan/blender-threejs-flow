// Screen effect: big pixels and a small colour palette, like an old console.
precision highp float;
uniform sampler2D uScene;
uniform vec2 uBuffer;
uniform float uPixelRatio;

const float PIXEL = 6.0;  // size of one pixel, in CSS pixels
const float LEVELS = 5.0; // shades per colour channel

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }

void main() {
  float size = PIXEL * uPixelRatio;
  vec2 cell = floor(gl_FragCoord.xy / size);
  vec3 color = texture2D(uScene, (cell + 0.5) * size / uBuffer).rgb;
  // A checker of tiny offsets hides the steps between shades.
  color = floor(color * LEVELS + bayer2(cell)) / LEVELS;
  gl_FragColor = vec4(color, 1.0);
}
