// The whole picture of the glass page: the background, the card's shadow, and the card itself.
// The card is described per pixel by a variant file (src/glass/shaders/variants/*.glsl), which only
// fills in a `Look`: how the surface leans, how much it blurs, how far colours split.
precision highp float;
uniform sampler2D uScene;   // the background, with smaller blurred versions (mip levels)
uniform sampler2D uLiquid;  // liquid height map (see liquid.frag)
uniform sampler2D uSand;    // sand height map (see sand.frag)
uniform sampler2D uFog;     // how far the frost has been wiped (see fog.frag)
uniform sampler2D uHeat;    // how hot the card is at each point (see heat.frag)
uniform sampler2D uFace;    // the print on the card
uniform vec2 uBuffer;       // canvas size, device pixels
uniform vec2 uLiquidTexel;
uniform vec2 uSandTexel;
uniform float uPixelRatio;
uniform float uTime;
uniform vec2 uCenter;       // card centre, CSS pixels from the bottom left
uniform vec2 uSize;         // card width and height, CSS pixels
uniform float uRadius;      // corner radius
uniform vec4 uToCard;       // screen → card: undoes the card's turn and stretch
uniform vec4 uToScreen;     // card → screen
uniform vec2 uTilt;         // how the card leans toward the viewer
uniform vec2 uFollow;       // the pointer on the card, px from its centre, trailing behind on a spring
uniform float uRib;         // width of one rib of fluted glass, px
uniform float uRibs[32];    // how far each rib has swung from rest, px
uniform vec3 uFlies[24];    // points of light: xy = px from the card centre, z = brightness
uniform float uLift;        // how far the card floats over the backdrop: scales its shadow
uniform float uAge;         // seconds since this kind was chosen or the screen was last tapped

#define TAPS 12             // samples per blurred pixel
#define SHADOW 0.42

struct Look {
  vec2 slope;    // which way the surface leans (uphill)
  float depth;   // thickness, px: a slope of 1 moves the picture behind by this much
  float blur;    // blur radius, px
  float split;   // colour split, as a share of the bend
  vec3 tint;     // colour of the glass body
  float milk;    // 0 = clear, 1 = solid tint
  float grain;   // frosting speckle
  float liquid;  // how strongly the water surface shows (0 = not at all)
  float shine;   // 1 = polished glass, 0 = matte
  vec3 light;    // light the card gives off here, added on top of everything
  float edge;    // 1 = the stock bright line on the rim and faint sheen, 0 = the kind draws its own
};

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

/** Distance to a rounded box (negative inside) and the direction pointing outward. */
vec3 roundedBox(vec2 p, vec2 half_, float radius) {
  vec2 w = abs(p) - half_ + radius;
  float g = max(w.x, w.y);
  vec2 q = max(w, 0.0);
  float l = length(q);
  vec2 outward = g > 0.0 ? q / l : (w.x > w.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
  return vec3(g > 0.0 ? l - radius : g - radius, sign(p) * outward);
}

/** The band along the rim. x: 1 at the rim falling to 0 at `width` px inside; yz: outward direction. */
vec3 rim(vec2 p, float width) {
  float radius = min(max(uRadius, width), min(uSize.x, uSize.y) * 0.5);
  vec3 box = roundedBox(p, uSize * 0.5, radius);
  return vec3(clamp(1.0 + box.x / width, 0.0, 1.0), box.yz);
}

// ---- Studio light for the materials page ----
// The card is lit like a product photograph: no point lamp, but large soft light panels whose
// reflections sweep across the surface as the card leans or the pointer moves.
#define EYE 900.0     // distance of the camera, px: smaller = reflections change faster across the card
#define LEAN 320.0    // how far leaning the card moves the reflections
#define KEY vec2(-0.55, 0.83)  // the side the main light panel stands on (upper left)

/** The way the surface faces for a given slope, including the card's lean. */
vec3 normalOf(vec2 slope) { return normalize(vec3(-slope - uTilt * LEAN, 1.0)); }

/** Soft, even light: about 1 on the lit upper left, falling gently to the lower right. For matte colour. */
float shade(vec2 p, vec3 normal) {
  return clamp(0.6 + 0.45 * dot(p / uSize, KEY) + 0.9 * dot(normal.xy, KEY), 0.0, 1.4);
}

float panel(float at, float centre, float halfWidth, float soft) {
  return smoothstep(centre - halfWidth - soft, centre - halfWidth + soft, at) * (1.0 - smoothstep(centre + halfWidth - soft, centre + halfWidth + soft, at));
}

/**
 * What the surface at `p` reflects of the studio: a wide main panel with a thin strip beside it,
 * a cool panel on the far side, and a dim room. `rough` 0 = mirror-crisp panel edges, 1 = fully soft.
 */
vec3 studio(vec2 p, vec3 normal, float rough) {
  vec3 eye = normalize(vec3(-p / EYE, 1.0));
  vec2 seen = reflect(-eye, normal).xy - uFollow / uSize * 0.22;
  float at = dot(seen, KEY);
  float soft = 0.004 + rough * 0.3;
  float spread = 1.0 / (1.0 + rough * 2.5); // a rougher surface smears the same light wider and dimmer
  vec3 light = vec3(0.05 + 0.07 * smoothstep(-0.6, 0.6, seen.y));
  light += vec3(1.0, 0.98, 0.95) * panel(at, 0.17, 0.085, soft) * spread;
  light += vec3(1.0, 0.98, 0.95) * 0.45 * panel(at, 0.035, 0.012, soft) * spread;
  light += vec3(0.62, 0.76, 1.0) * 0.5 * panel(at, -0.33, 0.06, soft * 1.5) * spread;
  return light;
}

#include "variant"

vec3 pick(vec2 uv, vec2 split, float level) {
  if (dot(split, split) < 1e-10) return textureLod(uScene, uv, level).rgb;
  return vec3(textureLod(uScene, uv + split, level).r, textureLod(uScene, uv, level).g, textureLod(uScene, uv - split, level).b);
}

/** The background at `uv`, blurred by `radius` px, red and blue pulled apart by `split`. */
vec3 behind(vec2 uv, float radius, vec2 split) {
  float r = radius * uPixelRatio;
  if (r < 0.75) return pick(uv, split, 0.0);
  float level = max(log2(r * 0.55), 0.0);
  vec3 sum = pick(uv, split, level);
  for (int i = 0; i < TAPS; i++) {
    float angle = float(i) * 2.39996;
    float reach = sqrt((float(i) + 0.5) / float(TAPS)) * r;
    sum += pick(uv + vec2(cos(angle), sin(angle)) * reach / uBuffer, split, level);
  }
  return sum / float(TAPS + 1);
}

void main() {
  vec2 screenUv = gl_FragCoord.xy / uBuffer;
  mat2 toCard = mat2(uToCard.xy, uToCard.zw);
  mat2 toScreen = mat2(uToScreen.xy, uToScreen.zw);
  vec2 p = toCard * (gl_FragCoord.xy / uPixelRatio - uCenter);
  p /= 1.0 + dot(uTilt, p);

  vec3 box = roundedBox(p, uSize * 0.5, uRadius);
  vec3 back = textureLod(uScene, screenUv, 0.0).rgb;
  float shadow = roundedBox(p + vec2(0.0, 22.0) * uLift, uSize * 0.5, uRadius).x;
  back *= 1.0 - SHADOW * smoothstep(50.0 * uLift, -24.0 * uLift, shadow);
  // A kind that writes  #define SIDE_COLOUR colour  has thickness: its side shows under the lower edge.
  #ifdef SIDE_COLOUR
  float side = roundedBox(p + vec2(-1.0, 4.5), uSize * 0.5, uRadius).x;
  back = mix(back, SIDE_COLOUR * (0.5 + 0.9 * smoothstep(-2.5, 0.0, side)), smoothstep(0.6, -0.6, side * uPixelRatio));
  #endif
  // A kind that writes  #define HALO  also lights the background around the card.
  #ifdef HALO
  back += halo(p, max(box.x, 0.0));
  #endif
  if (box.x > 1.0) {
    gl_FragColor = vec4(back, 1.0);
    return;
  }

  vec2 uv = p / uSize + 0.5;
  Look look = Look(vec2(0.0), 40.0, 0.0, 0.0, vec3(1.0), 0.0, 0.0, 0.0, 1.0, vec3(0.0), 1.0);
  glass(p, uv, look);

  // Water surface, for the kinds that ask for it: the height map's slope leans the surface.
  vec2 e = uLiquidTexel;
  vec2 ripple = vec2(
    texture2D(uLiquid, uv + vec2(e.x, 0.0)).r - texture2D(uLiquid, uv - vec2(e.x, 0.0)).r,
    texture2D(uLiquid, uv + vec2(0.0, e.y)).r - texture2D(uLiquid, uv - vec2(0.0, e.y)).r);
  look.slope += ripple * look.liquid;

  vec2 bend = toScreen * (look.slope * look.depth) * uPixelRatio / uBuffer;
  vec3 colour = behind(screenUv + bend, look.blur, bend * look.split);
  colour = mix(colour, look.tint, look.milk);
  colour += (hash(gl_FragCoord.xy) - 0.5) * look.grain;
  colour += look.light;

  // Light from the upper left: glints where the surface leans toward it, a bright line on the rim.
  vec3 normal = normalize(vec3(-look.slope - uTilt * 900.0, 1.0));
  vec3 lamp = normalize(vec3(-0.45, 0.65, 0.6));
  float glint = pow(max(dot(normal, normalize(lamp + vec3(0.0, 0.0, 1.0))), 0.0), 110.0);
  colour += glint * 0.55 * look.shine;
  float sheen = smoothstep(0.55, 0.0, abs(dot(uv - 0.5, vec2(0.7, 0.7)) + 0.18 + dot(uTilt, vec2(600.0, -600.0))));
  colour += sheen * 0.045 * look.edge;
  float facing = dot(box.yz, normalize(vec2(-0.6, 0.8)));
  colour += smoothstep(1.6, 0.0, -box.x) * (0.12 + 0.75 * facing * facing) * look.edge;

  vec4 print = texture2D(uFace, uv);
  colour = mix(colour, print.rgb, print.a);

  float cover = smoothstep(0.6, -0.6, box.x * uPixelRatio);
  gl_FragColor = vec4(mix(back, colour, cover), 1.0);
}
