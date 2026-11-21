// title: Sand
// note: Dry sand under glass. Drag across it to rake a groove, shake the card to throw the sand to one side. It never ripples: it slumps until it reaches its angle of rest, then stays.
// order: 10
#define RELIEF 42.0                     // how strongly the light picks out slopes
#define LIGHT vec3(0.98, 0.86, 0.68)    // sand in the light
#define DARK vec3(0.42, 0.27, 0.2)      // sand in shadow
#define GRAIN 0.16                      // speckle
#define THIN 0.3                        // below this height the sand lets the glass show through

void glass(vec2 p, vec2 uv, inout Look look) {
  vec2 e = uSandTexel;
  float height = texture2D(uSand, uv).r;
  vec2 lean = vec2(
    texture2D(uSand, uv + vec2(e.x, 0.0)).r - texture2D(uSand, uv - vec2(e.x, 0.0)).r,
    texture2D(uSand, uv + vec2(0.0, e.y)).r - texture2D(uSand, uv - vec2(0.0, e.y)).r) * RELIEF;
  float lit = dot(normalize(vec3(-lean, 1.0)), normalize(vec3(-0.45, 0.65, 0.6)));
  vec2 grain = floor(p * 1.7);
  vec3 sand = mix(DARK, LIGHT, smoothstep(0.15, 0.95, lit));
  sand *= 1.0 - GRAIN + 2.0 * GRAIN * hash(grain);
  sand += 0.5 * pow(hash(grain + 31.0), 60.0); // the odd grain catches the light

  vec3 edge = rim(p, 12.0);
  look.slope = -edge.yz * 0.7 * edge.x;
  look.blur = 12.0;
  look.tint = sand;
  look.milk = smoothstep(0.03, THIN, height);
  look.shine = 0.0;
  look.liquid = 0.0;
}
