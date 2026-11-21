// Screen effect: glow. Bright parts of the picture spill light onto their surroundings.
// `#pragma mipmap` asks the engine for smaller, blurred versions of the picture as well.
#pragma mipmap
precision highp float;
uniform sampler2D uScene;
uniform vec2 uBuffer;

const float THRESHOLD = 0.6;  // only parts brighter than this glow
const float STRENGTH = 0.7;

// One blurred version of the picture: four neighbouring samples smooth out its blocks.
vec3 blurred(vec2 uv, float level) {
  vec2 reach = exp2(level) * 0.5 / uBuffer;
  vec3 sum = textureLod(uScene, uv + reach * vec2(1.0, 1.0), level).rgb + textureLod(uScene, uv + reach * vec2(-1.0, 1.0), level).rgb;
  sum += textureLod(uScene, uv + reach * vec2(1.0, -1.0), level).rgb + textureLod(uScene, uv + reach * vec2(-1.0, -1.0), level).rgb;
  return max(sum * 0.25 - THRESHOLD, 0.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uBuffer;
  vec3 glow = vec3(0.0);
  for (int level = 2; level <= 6; level++) glow += blurred(uv, float(level));
  gl_FragColor = vec4(textureLod(uScene, uv, 0.0).rgb + glow * STRENGTH, 1.0);
}
