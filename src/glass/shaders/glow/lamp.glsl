// title: Lamp
// note: A warm lamp behind frosted glass. It swings after the pointer on a spring and sways back to the middle; the frost scatters its light and some spills past the rim.
// order: 8
// springs: 0.7
#define HALO
#define WARM vec3(1.0, 0.72, 0.36)
#define SIZE 64.0    // how wide the lamp's glow is, px
#define SWING 0.9    // how far it follows the pointer

float lamp(vec2 p) {
  float d = length(p - uFollow * SWING) / SIZE;
  return 1.0 / (1.0 + d * d);
}

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, 12.0);
  look.slope = -edge.yz * 0.7 * edge.x;
  look.blur = 22.0;
  look.tint = vec3(0.1, 0.09, 0.1);
  look.milk = 0.6;
  look.grain = 0.04;
  look.light = WARM * lamp(p) * 1.05 + vec3(1.0, 0.95, 0.85) * pow(lamp(p), 6.0) * 0.5;
}

vec3 halo(vec2 p, float away) { return WARM * 0.5 * lamp(p) * exp(-away / 60.0); }
