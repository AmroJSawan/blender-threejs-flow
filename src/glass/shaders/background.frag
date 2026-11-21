// What lies behind the glass: slow colour lights, a fine grid and rows of big type.
// Straight lines and letters are what make bending and blur readable.
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;   // picture size, CSS pixels
uniform sampler2D uType;    // one line of words, tiling sideways
uniform float uTypeAspect;  // its width / height
uniform float uDim;         // 1 = full brightness; lower for pages where the card itself gives the light

#define ROW 150.0   // height of a row of type, px
#define GRID 50.0   // grid spacing, px
#define DRIFT 0.012 // how fast the type slides

vec3 light(vec2 p, vec2 centre, float reach, vec3 colour) {
  float glow = smoothstep(reach, 0.0, length(p - centre));
  return colour * glow * glow;
}

void main() {
  vec2 px = vUv * uResolution;
  vec2 p = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
  float t = uTime;

  vec3 colour = vec3(0.035, 0.04, 0.06);
  colour += light(p, vec2(sin(t * 0.21) * 0.38, cos(t * 0.17) * 0.24), 0.75, vec3(0.14, 0.34, 1.0));
  colour += light(p, vec2(cos(t * 0.13 + 2.0) * 0.42, sin(t * 0.19 + 1.0) * 0.32), 0.62, vec3(1.0, 0.2, 0.55));
  colour += light(p, vec2(sin(t * 0.11 + 4.0) * 0.32, -0.28 + cos(t * 0.23) * 0.16), 0.55, vec3(1.0, 0.6, 0.12));
  colour += light(p, vec2(cos(t * 0.16 + 5.0) * 0.5, 0.3 + sin(t * 0.14 + 3.0) * 0.14), 0.5, vec3(0.1, 0.85, 0.7));

  vec2 cell = abs(fract(px / GRID) - 0.5) * GRID;
  colour += 0.07 * smoothstep(1.2, 0.0, min(cell.x, cell.y));

  // Rows of type, sliding in alternating directions; every other row is dimmer.
  float rows = max(floor(uResolution.y / ROW + 0.5), 3.0);
  float row = floor(vUv.y * rows);
  float within = (fract(vUv.y * rows) - 0.14) / 0.72;
  float side = mod(row, 2.0) * 2.0 - 1.0;
  float along = px.x / (uResolution.y / rows * 0.72 * uTypeAspect) + side * t * DRIFT + row * 0.37;
  float ink = texture2D(uType, vec2(along, within)).a * step(0.0, within) * step(within, 1.0);
  colour = mix(colour, vec3(0.94, 0.96, 1.0), ink * (side > 0.0 ? 0.92 : 0.3));

  gl_FragColor = vec4(colour * uDim, 1.0);
}
