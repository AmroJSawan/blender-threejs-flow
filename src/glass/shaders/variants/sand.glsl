// title: Sand
// note: Sand as a drawing: thousands of pale grains on clear glass, packed where the dunes face the light and sparse in their shadow. Drag to rake a groove, shake the card to throw the grains aside. They slump to their angle of rest and stay.
// order: 10
// springs: 0.7
#define GRAIN 3.0       // spacing of the grains, px
#define DOT 1.3         // size of one grain, px
#define RELIEF 46.0     // how strongly slopes change the packing
#define PACK 1.7        // overall density
#define HAZE 0.26       // pale body under the grains, so dunes read as mass
#define INK vec3(1.0, 0.97, 0.92)

void glass(vec2 p, vec2 uv, inout Look look) {
  vec2 e = uSandTexel;
  float height = texture2D(uSand, uv).r;
  vec2 lean = vec2(
    texture2D(uSand, uv + vec2(e.x, 0.0)).r - texture2D(uSand, uv - vec2(e.x, 0.0)).r,
    texture2D(uSand, uv + vec2(0.0, e.y)).r - texture2D(uSand, uv - vec2(0.0, e.y)).r) * RELIEF;
  float lit = dot(normalize(vec3(-lean, 1.0)), normalize(vec3(-0.45, 0.65, 0.6)));
  float packed = clamp(height * PACK * (0.12 + 1.2 * smoothstep(0.38, 0.82, lit)), 0.0, 1.0);

  // One grain per cell, nudged off the grid; a cell holds a grain when its number is under the packing.
  vec2 cell = floor(p / GRAIN);
  vec2 centre = (cell + 0.5 + (vec2(hash(cell + 3.0), hash(cell + 11.0)) - 0.5) * 0.7) * GRAIN;
  float grain = smoothstep(DOT, DOT - 0.7, length(p - centre)) * step(hash(cell), packed);

  vec3 edge = rim(p, 12.0);
  look.slope = -edge.yz * 0.7 * edge.x;
  look.blur = 9.0;
  look.tint = INK;
  look.milk = max(grain * 0.95, packed * HAZE);
  look.shine = 0.3;
}
