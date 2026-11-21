// title: Fireflies
// note: Two dozen points of light drifting in smoked glass, each blinking at its own pace. They gather in a ring around the pointer and scatter back to their own patches when it leaves.
// order: 7
// springs: 0.7
#define FLY vec3(0.85, 1.0, 0.35)

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 light = vec3(0.0);
  for (int i = 0; i < 24; i++) {
    float d = length(p - uFlies[i].xy);
    light += FLY * uFlies[i].z * (exp(-d / 3.0) + 0.22 * exp(-d / 26.0));
  }
  look.blur = 14.0;
  look.tint = vec3(0.02, 0.04, 0.035);
  look.milk = 0.78;
  look.light = light;
}
