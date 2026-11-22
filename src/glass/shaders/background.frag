// The stage behind the card, set like a photographer's backdrop: one colour, brighter behind the
// card and falling off to the corners; a few large out-of-focus colour lights; fine film grain.
// The glass page adds rows of large light type, because letters make bending and blur readable.
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;   // picture size, CSS pixels
uniform sampler2D uType;    // one line of words, tiling sideways
uniform float uTypeAspect;  // its width / height
uniform vec3 uStageColour;  // colour of the backdrop
uniform float uLights;      // how strong the colour lights are
uniform float uWords;       // how strong the type is (0 = none)

#define ROW 170.0   // height of a row of type, px
#define DRIFT 0.01  // how fast the type slides

vec3 light(vec2 p, vec2 centre, float reach, vec3 colour) {
  float glow = smoothstep(reach, 0.0, length(p - centre));
  return colour * glow * glow;
}

void main() {
  vec2 px = vUv * uResolution;
  vec2 p = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
  float t = uTime;

  vec3 colour = uStageColour * (1.35 - 0.95 * smoothstep(0.0, 1.0, length(p * vec2(0.85, 1.0))));
  colour += uLights * light(p, vec2(-0.13 + sin(t * 0.23) * 0.07, 0.1 + cos(t * 0.19) * 0.06), 0.42, vec3(0.42, 0.3, 1.0));
  colour += uLights * light(p, vec2(0.14 + cos(t * 0.17 + 1.0) * 0.07, -0.12 + sin(t * 0.21 + 2.0) * 0.06), 0.4, vec3(1.0, 0.4, 0.22));
  colour += uLights * 0.7 * light(p, vec2(0.1 + sin(t * 0.13 + 4.0) * 0.08, 0.2 + cos(t * 0.15) * 0.05), 0.3, vec3(0.1, 0.75, 0.95));

  if (uWords > 0.0) {
    // Rows of type, sliding in alternating directions; every other row is fainter.
    float rows = max(floor(uResolution.y / ROW + 0.5), 3.0);
    float row = floor(vUv.y * rows);
    float within = (fract(vUv.y * rows) - 0.2) / 0.6;
    float side = mod(row, 2.0) * 2.0 - 1.0;
    float along = px.x / (uResolution.y / rows * 0.6 * uTypeAspect) + side * t * DRIFT + row * 0.37;
    float ink = texture2D(uType, vec2(along, within)).a * step(0.0, within) * step(within, 1.0);
    colour = mix(colour, vec3(0.93, 0.95, 1.0), ink * uWords * (side > 0.0 ? 1.0 : 0.3));
  }

  colour += (fract(sin(dot(px, vec2(127.1, 311.7))) * 43758.5453) - 0.5) * 0.022;
  gl_FragColor = vec4(colour, 1.0);
}
