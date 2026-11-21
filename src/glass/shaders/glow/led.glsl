// title: Pixels
// note: A matrix of tiny lamps with afterglow. A slow pattern runs through them; wherever the pointer passes they flash and then fade over a few seconds, like a phosphor screen.
// order: 5
// springs: 0.7
#define PITCH 15.0   // spacing of the lamps, px
#define LAMP 4.0     // size of a lamp, px

void glass(vec2 p, vec2 uv, inout Look look) {
  vec2 cell = floor(p / PITCH);
  vec2 centre = (cell + 0.5) * PITCH;
  float d = length(p - centre);
  float afterglow = texture2D(uFog, centre / uSize + 0.5).r;
  float pattern = 0.5 + 0.5 * sin(cell.x * 0.55 + cell.y * 0.35 - uTime * 1.4) * sin(cell.y * 0.4 + uTime * 0.6);
  float level = clamp(0.1 + 0.35 * pattern * pattern + 1.2 * afterglow, 0.0, 1.3);
  vec3 lamp = mix(vec3(0.1, 0.35, 1.0), vec3(0.75, 0.95, 1.0), smoothstep(0.3, 1.1, level));
  look.blur = 12.0;
  look.tint = vec3(0.02, 0.025, 0.04);
  look.milk = 0.86;
  look.light = lamp * level * (smoothstep(LAMP, LAMP - 1.5, d) + 0.35 * exp(-d / 5.0));
}
