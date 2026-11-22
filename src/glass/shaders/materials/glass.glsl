// title: Glass
// note: A thick slab of frosted glass over soft colour lights. The body blurs what is behind it, the rounded rim bends it and splits its colours, and a fine bright line runs round the edge where it catches the studio light.
// order: 1
// stage: #0d0e13
// lights: 1
#define FROST 26.0   // blur of the body, px
#define BODY 0.07    // how milky the slab is
#define RIM 18.0     // width of the rounded rim, px
#define LINE 0.85    // brightness of the fine line on the edge

void glass(vec2 p, vec2 uv, inout Look look) {
  vec3 edge = rim(p, RIM);
  float curve = edge.x * edge.x;
  look.slope = -edge.yz * curve * 1.5;
  look.depth = 46.0;
  look.blur = FROST * (1.0 - 0.55 * curve); // the rim is clearer than the body
  look.split = 0.3;
  look.tint = vec3(0.93, 0.95, 1.0);
  look.milk = BODY + 0.05 * shade(p, normalOf(vec2(0.0)));
  look.grain = 0.028;
  look.shine = 0.0;
  look.edge = 0.0;

  // Studio light: a broad soft wash on the body, crisp on the rounded rim, and a hairline on the very edge
  // that is brightest where it faces the light and where it faces away from it.
  look.light = studio(p, normalOf(vec2(0.0)), 0.6) * 0.1;
  look.light += studio(p, normalOf(look.slope * 0.5), 0.05) * curve * 0.5;
  float facing = dot(edge.yz, normalize(KEY));
  look.light += vec3(0.95, 0.97, 1.0) * LINE * rim(p, 1.6).x * (0.16 + 0.84 * facing * facing);
}
