// title: Spun
// note: Steel brushed in circles on a lathe. The fine rings turn the studio light into bright spokes that fan out from the centre and swing round as the card leans or the pointer moves.
// order: 6
// stage: #121315
// lights: 0.1
// ink: dark
#define SIDE_COLOUR vec3(0.34, 0.35, 0.37)
#define BASE vec3(0.8, 0.82, 0.85)  // colour of the metal
#define BEVEL 4.0                   // width of the rounded edge, px
#define SPOKE 5.0                   // how narrow the bright spokes are
#define SWING 1.5                   // how far the spokes turn with the pointer

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, BEVEL);
  vec3 normal = normalOf(-edge.yz * edge.x * edge.x * 1.2);
  float angle = atan(p.y, p.x);
  float turn = 0.95 + SWING * (uFollow.x / uSize.x - uFollow.y / uSize.y) + dot(uTilt, vec2(700.0, -700.0));
  float main_ = pow(abs(cos(angle - turn)), SPOKE);
  float second = pow(abs(cos(angle - turn - 1.25)), SPOKE * 2.5);
  float rings = noise(vec2(length(p) * 1.6, 3.0)) - 0.5; // the fine circular scratches
  look.milk = 1.0;
  look.shine = 0.0;
  look.edge = 0.0;
  look.tint = BASE * 0.12;
  look.light = BASE * (0.1 + 0.95 * main_ + 0.3 * second) * (1.0 + 0.3 * rings) * (0.75 + 0.35 * shade(p, normal));
  look.light += studio(p, normal, 0.05) * edge.x * edge.x * 0.6;
}
