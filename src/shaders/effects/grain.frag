// Screen effect: film look. Moving grain, darker corners and a slight colour fringe toward the edges.
precision highp float;
uniform sampler2D uScene; // the finished picture
uniform vec2 uBuffer;     // its size in device pixels
uniform float uTime;
uniform float uPixelRatio;

const float GRAIN = 0.11;
const float FRINGE = 0.012;
const float VIGNETTE = 0.9;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uBuffer;
  vec2 fromCentre = uv - 0.5;
  float edge = dot(fromCentre, fromCentre);
  vec2 shift = fromCentre * edge * FRINGE;
  vec3 color = vec3(texture2D(uScene, uv + shift).r, texture2D(uScene, uv).g, texture2D(uScene, uv - shift).b);
  color += (hash(floor(gl_FragCoord.xy / uPixelRatio) + fract(uTime * 7.0) * 100.0) - 0.5) * GRAIN;
  gl_FragColor = vec4(color * (1.0 - edge * VIGNETTE), 1.0);
}
