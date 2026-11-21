// title: Backlight
// note: A dark panel with lamps behind it, washing the wall in slowly turning colour. Lean the panel with the pointer and more light escapes from the side that lifts.
// order: 4
// springs: 0.7
#define HALO
#define REACH 95.0   // how far the light spreads, px
#define TURN 0.25    // how fast the colours travel round
#define LEAK 2600.0  // how much leaning shifts the light

vec3 wash(vec2 p) {
  float a = atan(p.y, p.x) + uTime * TURN;
  return 0.5 + 0.5 * cos(a + vec3(0.0, 2.1, 4.2));
}

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, 3.0);
  look.blur = 16.0;
  look.tint = vec3(0.03, 0.035, 0.05);
  look.milk = 0.93;
  look.light = wash(p) * edge.x * 0.7; // a line of light along the rim
}

vec3 halo(vec2 p, float away) {
  float side = 1.0 + clamp(dot(normalize(p), uTilt) * LEAK, -0.8, 1.6);
  return wash(p) * side * (0.7 * exp(-away / REACH) + 0.5 * exp(-away / (REACH * 0.25)));
}
