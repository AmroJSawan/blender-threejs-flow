// title: Sand
// note: Sand as smooth light: soft dunes that glow pale where they face the light and fade to clear glass in their shadow. Drag to draw a groove, shake the card to send the dunes sliding. They slump to their angle of rest and stay.
// order: 10
// springs: 0.7
#define RELIEF 30.0                    // how strongly slopes catch the light
#define SOFT 2.5                       // smoothing of the dunes, in cells
#define LIT vec3(1.0, 0.96, 0.9)       // colour facing the light
#define SHADE vec3(0.86, 0.8, 1.0)     // colour turning away from it
#define BODY 0.5                       // how solid the lit side is

/** Sand height, averaged over a small neighbourhood so no cell edges show. */
float dune(vec2 uv) {
  vec2 e = uSandTexel * SOFT;
  return 0.36 * texture2D(uSand, uv).r + 0.16 * (
    texture2D(uSand, uv + vec2(e.x, 0.0)).r + texture2D(uSand, uv - vec2(e.x, 0.0)).r +
    texture2D(uSand, uv + vec2(0.0, e.y)).r + texture2D(uSand, uv - vec2(0.0, e.y)).r);
}

void glass(vec2 p, vec2 uv, inout Look look) {
  vec2 e = uSandTexel * SOFT;
  float height = dune(uv);
  vec2 lean = vec2(dune(uv + vec2(e.x, 0.0)) - dune(uv - vec2(e.x, 0.0)), dune(uv + vec2(0.0, e.y)) - dune(uv - vec2(0.0, e.y))) * RELIEF;
  float lit = smoothstep(0.25, 0.92, dot(normalize(vec3(-lean, 1.0)), normalize(vec3(-0.45, 0.65, 0.6))));

  vec3 edge = rim(p, 12.0);
  look.slope = -edge.yz * 0.7 * edge.x;
  look.blur = 14.0;
  look.tint = mix(SHADE, LIT, lit);
  look.milk = BODY * lit * smoothstep(0.03, 0.35, height);
  look.grain = 0.03;
  look.shine = 0.0;
}
