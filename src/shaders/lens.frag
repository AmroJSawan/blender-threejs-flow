// Glass that bends the scene behind it and splits it into colours at the edges.
// In Blender: custom property  shader = "lens"  on a rounded object. Works best on ball-like shapes.
// `#pragma refract` makes the engine draw this object last and hand it uScene, a picture of
// everything behind it (see src/render.ts).
#pragma refract
precision highp float;
varying vec3 vNormal;
varying vec3 vWorldPosition;
uniform sampler2D uScene;
uniform vec2 uBuffer;         // size of uScene in device pixels
uniform mat4 projectionMatrix;
uniform vec3 uBoundsMax;
uniform vec3 uColor;          // Blender base colour: a light tint
uniform float uHover;
uniform vec2 uMouse;

const float BEND = 1.15;  // above 1 the picture flips upside down toward the rim, like a glass ball
const float SPLIT = 0.22; // how far the colours separate
const int STEPS = 6;      // samples across the spectrum

void main() {
  if (!gl_FrontFacing) discard;
  vec3 normal = normalize(vNormal);
  float rim = 1.0 - max(normal.z, 0.0);

  // The object's size on screen, in picture heights, so the bend looks the same at any distance.
  float size = uBoundsMax.x * projectionMatrix[1][1] / length(cameraPosition - vWorldPosition) * 0.5;
  vec2 bend = -normal.xy * (0.4 + rim) * size * BEND * vec2(uBuffer.y / uBuffer.x, 1.0);
  vec2 uv = gl_FragCoord.xy / uBuffer;

  vec3 color = vec3(0.0);
  vec3 total = vec3(0.0);
  for (int i = 0; i < STEPS; i++) {
    float t = float(i) / float(STEPS - 1);
    vec3 weight = clamp(vec3(1.0 - 2.0 * t, 1.0 - abs(2.0 * t - 1.0), 2.0 * t - 1.0), 0.0, 1.0); // red → green → blue
    vec2 at = uv + bend * (1.0 + (t - 0.5) * SPLIT * (1.0 + uHover));
    color += textureLod(uScene, clamp(at, 0.001, 0.999), 0.0).rgb * weight;
    total += weight;
  }
  color = color / total * mix(vec3(1.0), uColor, 0.3);

  color += vec3(0.75, 0.85, 1.0) * pow(rim, 3.0) * 0.5; // pale edge
  vec3 window = normalize(vec3(-0.45 + uMouse.x * 0.3, 0.6 + uMouse.y * 0.3, 0.65));
  color += smoothstep(0.984, 0.994, dot(normal, window)) * 0.9; // one small bright reflection
  gl_FragColor = vec4(color, 1.0);
}
