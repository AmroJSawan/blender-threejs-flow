# Blender → three.js flow

Design the scene in Blender, press Export (or just save), and the browser refreshes with the new scene.
Scroll, mouse, hover and fragment shaders are handled by a small vanilla three.js app.

**Live demo:** https://amrojsawan.github.io/blender-threejs-flow/ (republished automatically on every push to `main`)
**Glass cards:** https://amrojsawan.github.io/blender-threejs-flow/glass.html

**Stack:** three.js (WebGL 2) · GSAP ScrollTrigger · Lenis · Vite · TypeScript

## Start

```bash
npm install
npm run dev
```

Open http://localhost:5173. The repo ships with a demo scene (`blender/demo.blend` → `public/scene.glb`).

## Blender side

1. Install the add-on once: **Edit → Preferences → Add-ons → Install from Disk…** → `blender/threejs_bridge.py`.
2. Save your `.blend` inside `blender/` (the export path defaults to `//../public/scene.glb`).
3. In the 3D viewport press **N** → **three.js** tab → **Export to three.js**.
   With **Export on Save** ticked, every Ctrl+S re-exports and the browser reloads.

### Control things from Blender

| What you do in Blender | What happens on the web |
|---|---|
| Animate anything (camera included) | The animation follows the scrollbar |
| Name an action `Loop…` (e.g. `Loop_Spin`) | It plays in a loop instead of following scroll |
| Add tag `hover` to an object | It reacts to hover and click |
| Add tag `label` | Tooltip text on hover |
| Add tag `link` | URL opened on click |
| Add tag `shader` = `pulse` | The object is drawn with `src/shaders/pulse.frag` |
| Add a number property (e.g. `floors` = 12) | The object's shader receives it as `uniform float uFloors` |
| Add the number property `copies` = 140 | The mesh is drawn that many times in one go; its vertex shader tells the copies apart (`gl_InstanceID`) |
| Add the number properties `from` = 0.4, `to` = 0.5 | The object's shader receives `uProgress`, running 0 → 1 while the page scrolls between those positions (0 = top, 1 = bottom) |
| Add a shape key to a mesh | Its shader receives `attribute vec3 morph`: how far each vertex travels to reach that shape |
| Set the scene camera | It becomes the web camera (framing is kept on phones) |

Tags are added with the buttons in the three.js panel (they are ordinary custom properties).

## Web side

| File | What it is for |
|---|---|
| `src/config.ts` | **The control panel**: background, lighting, scroll length and smoothing, mouse parallax, hover effect, plus `events` hooks (`onEnter`, `onLeave`, `onClick`, `onScroll`) for custom behaviour |
| `src/shaders/*.frag` | Fragment shaders. Drop a file in, reference it by name from Blender or from `config.look.backgroundShader` |
| `src/shaders/*.vert` | Optional. A `.vert` with the same name as a `.frag` also moves the surface (see `pulse.vert`: wave displacement) |
| `src/shaders/*.glsl` | Shared snippets pulled in with `#include "file.glsl"` (see `studio.glsl`, the fake studio the mirror and glass reflect) |
| `src/cards.ts` | Card view for small screens: one card per object; tap to open full screen, then drag to rotate and pinch to zoom |
| `src/stage.ts` | Renderer, GLB loading, camera |
| `src/scroll.ts` | Blender animations ↔ scroll |
| `src/hover.ts` | Raycasting, hover, click |
| `src/shaders.ts` | Wires shaders to objects and feeds them uniforms |
| `src/render.ts` | Draws each picture: the scene, then refracting glass, then the screen effect |
| `src/shaders/effects/*.frag` | Screen effects over the whole picture. Pick one with `config.look.effect`, the switcher at the bottom of the page, or `?effect=ascii` in the address |

Every shader receives: `uTime`, `uScroll` (0–1), `uMouse` (-1…1, eased), `uPointer` (-1…1, exact; the finger in the card view), `uResolution`, `uPixelRatio`, `uHover` (0–1), `uProgress` (0–1, see `from` / `to`), `uColor` (the Blender base colour), and varyings `vUv`, `vNormal`, `vWorldPosition`, `vWorldNormal`, `vWave`.

Included shaders:

| Shader | Look | Number properties |
|---|---|---|
| `pulse` | Living orb: calm lumps that wake into ripple bands every few seconds; hover (or press in the card view) keeps it awake, the pointer tilts the bands | |
| `mirror`, `glass` | Mirror face and glass rim reflecting a fake studio | |
| `lineart` | Flat 2D single-stroke boxes, coloured top | |
| `blueprint` | Architectural line drawing on boxes; the base colour is the ink | `floors`, `level` |
| `slab` | Technical drawing of a rounded slab: black top with fine linework, holographic sides | `radius` |
| `wire` | See-through wireframe version of the same slab | `radius` |
| `dash` | Dashed guide line on a thin post | `dash` |
| `grid` | Dark drawing paper with a faint grid under a group | `cell`, `shade` |
| `echo` | Tumbling ring of light with a fading tail (the ring drawn at its past positions) | `copies` |
| `shade` | Soft dark ball behind glowing things, so light reads on any background | `shade` |
| `particles` | The mesh's vertices as dots; they travel to a shape key as `uProgress` rises and dodge the pointer | `size`, `from`, `to` |
| `field` | One pin drawn in a grid; a wave rolls through and the pointer raises the pins | `copies`, `columns`, `gap` |
| `ribbon` | Fluttering satin strip with pulses of light running along it (strip mesh with UV along its length) | `phase` |
| `foil` | Iridescent chrome reflecting a drawn studio of strip lights | |
| `lens` | Glass that bends and colour-splits the scene behind it | |
| `toon` | Two flat tones, halftone dots in the shadow, hard highlight, ink outline | `outline` |
| `clay` | Matte pastel clay in soft wrapped light | `contact` |
| `scan` | A glowing line climbs the object, turning a wire grid into a solid | `from`, `to` |
| `contour` | The object cut into level bands that lift apart | `slices`, `from`, `to` |
| `lamp` | Flat colour | |
| `backdrop` | Full-screen background | |

Shaders also get `uBoundsMin` / `uBoundsMax` (the object's own box) and varyings `vLocalPosition`, `vLocalNormal`. `flat2d.glsl` is a shared vertex shader that removes perspective, so grouped 3D objects read as one flat 2D drawing (used by `lineart` and `lamp`). `boxedge.glsl` is the shared single-stroke outline for boxes (used by `lineart` and `blueprint`). `slab.glsl` is the shared body of `slab` and `wire`.

Shader objects are solid by default, which is the fastest and lets them hide each other correctly. A shader opts into something else with a `#pragma` line:

| Line in the shader | Effect |
|---|---|
| `#pragma transparent` | Uses the alpha it outputs (glass, soft edges) |
| `#pragma nodepth` | Never hides what is behind it (thin lines that should not cut each other) |
| `#pragma additive` | Blended as light: adds to what is behind it |
| `#pragma underlay` | Ground sheet: painted over the floor but under every other shader object (used by `grid`) |
| `#pragma points` | The mesh's vertices are drawn as dots (set `gl_PointSize` in the `.vert`); the mesh itself stays invisible and still catches the pointer |
| `#pragma outline` | Adds an ink outline of constant pixel width (number property `outline`) |
| `#pragma refract` | Drawn last, with a picture of everything behind it in `uniform sampler2D uScene` (sample at `gl_FragCoord.xy / uBuffer`) |

The Assembly element in the demo uses no shader at all: its parts are moved apart with ordinary Blender keyframes, which follow the scrollbar like any other animation.

### Screen effects

A screen effect redraws the finished picture through one fragment shader in `src/shaders/effects/`. Included: `ascii`, `bloom`, `dither`, `grain`, `pixels`. An effect reads the picture from `uScene` (size `uBuffer`, in device pixels) and also gets `uTime`, `uResolution` and `uPixelRatio`. Add `#pragma mipmap` to also get smaller, blurred versions of the picture through `textureLod` (used by `bloom`). Set `config.look.effectPicker = false` to hide the switcher.

## Glass cards page

`glass.html` is a second page for fragment shaders on a flat card: one glass card over a moving background, with a switcher for the kind of glass (also `glass.html?glass=frost`, or the arrow keys). It does not use the Blender scene.

| File | What it is for |
|---|---|
| `src/glass/shaders/variants/*.glsl` | **One file per kind of glass.** Drop a file in and it appears in the switcher |
| `src/glass/shaders/card.frag` | The shared part: card shape, shadow, blur, colour split, light, print |
| `src/glass/shaders/background.frag` | What lies behind the glass (colour lights, grid, rows of type) |
| `src/glass/shaders/liquid.frag` | The liquid skin: a height map that behaves like the surface of water |
| `src/glass/body.ts` | The card as a body on springs; all tuning is in `feel` at the top |
| `src/glass/liquid.ts` | Runs the liquid; tuning in `flow` at the top |
| `src/glass/shaders/sand.frag`, `src/glass/sand.ts` | Dry sand: a height map that only moves where a slope is steeper than its angle of rest; tuning in `grit` |
| `src/glass/main.ts` | Page set-up; card size and the words behind it are in `settings` at the top |

A variant starts with comment lines that describe it (`// title:`, `// note:`, `// order:`, optional `// springs:` where higher = looser, wobblier) and defines one function that fills in the look of the glass at each point:

```glsl
void glass(vec2 p, vec2 uv, inout Look look) {  // p: px from the card centre, uv: 0–1
  look.slope = ...;   // which way the surface leans; bends the picture behind
  look.depth = 48.0;  // px moved per unit of slope
  look.blur = 18.0;   // blur radius, px
  look.split = 0.16;  // colour fringe, as a share of the bend
  look.tint, look.milk, look.grain  // body colour, how solid it is, speckle
  look.liquid = 2.6;  // how strongly the liquid skin shows (default 0.35)
}
```

`rim(p, width)` gives the band along the edge (1 at the rim → 0 at `width` px inside, plus the outward direction); `noise`, `hash`, `uTime` and `uSize` are available too.

Included: `clear` (progressive refraction toward the rim), `frost`, `fade` (progressive blur), `fluted`, `prism`, `dome`, `hammered`, `waves` (stacked sheets with swaying wave edges), `silk` (slow wide folds), `sand` (rake it, shake it), `liquid`, `jelly`.

A variant can read the simulations directly: `uLiquid` / `uLiquidTexel` (water height) and `uSand` / `uSandTexel` (sand height). The sand only runs while a variant that mentions `uSand` is shown. `look.shine = 0.0` makes a surface matte.

Physical movement, on every variant: the card hangs on springs (drag it and let go; it lags, leans, stretches along its path and settles), leans under the pointer, and carries a liquid skin that the pointer stirs, the card's own movement sloshes, and small drops keep alive.

## Phones: card view

On screens up to `config.cards.maxWidth` (768 px) the scroll scene is replaced by a vertical list of cards.
Every top-level object with a `label` tag gets a card (or list names in `config.cards.names`); the label is the caption and a `link` tag becomes a button.
In the list the cards are previews only, so the page scrolls freely. Tapping a card opens it full screen with a Back button (the phone's own Back works too); there, drag rotates, pinch zooms (wheel on a laptop) and double-tap resets. Looping animations keep playing and the Blender camera is not used there. Since there is no scroll, scroll animations of objects and `uProgress` play back and forth by themselves (`config.cards.replay` seconds per round trip). A finger pressed on the full-screen view also acts as the pointer for shaders that use `uPointer`.
Each preview is its own small canvas that scrolls with the page; one hidden 3D canvas renders only the cards on screen and copies each frame into its preview, so nothing lags behind the scroll.
Set `config.cards.enabled = false` to show the scroll scene on every screen.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server with reload on export |
| `npm run build` | Type-check and build to `dist/` |
| `npm run export` | Export `blender/demo.blend` without opening Blender |
| `npm run demo` | Rebuild the demo scene from `blender/make_demo.py` |
| `npm run optimize` | Compress `public/scene.glb` (Meshopt + WebP) before shipping |

`export` and `demo` assume Blender at `/Applications/Blender.app`; edit `package.json` if yours is elsewhere.

## Good to know

- Only **Principled BSDF** materials with image textures survive export. Bake procedural node materials to textures, or recreate the effect as a fragment shader.
- Lights are exported in "compat" units so Blender strengths roughly match three.js. Area lights are not part of glTF.
- Hover scaling animates the object's scale; avoid tagging objects whose scale is also keyframed.
- `.blend` and `.glb` are binary. For big scenes, set up Git LFS before committing them.
