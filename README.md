# Blender → three.js flow

Design the scene in Blender, press Export (or just save), and the browser refreshes with the new scene.
Scroll, mouse, hover and fragment shaders are handled by a small vanilla three.js app.

**Live demo:** https://amrojsawan.github.io/blender-threejs-flow/ (republished automatically on every push to `main`)
**Glass cards:** https://amrojsawan.github.io/blender-threejs-flow/glass.html
**Glow cards:** https://amrojsawan.github.io/blender-threejs-flow/glow.html
**Material cards:** https://amrojsawan.github.io/blender-threejs-flow/materials.html
**Switch study:** https://amrojsawan.github.io/blender-threejs-flow/switch.html
**Switches in 3D:** https://amrojsawan.github.io/blender-threejs-flow/switch3d.html

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
| `src/glass/shaders/background.frag` | The stage behind the card: backdrop colour, out-of-focus colour lights, film grain, and rows of large type on the glass page |
| `src/glass/body.ts` | The card as a body on springs; all tuning is in `feel` at the top |
| `src/glass/main.ts` | Page set-up; card size, the words behind it and each page's staging (`settings.series`) are at the top |

A variant starts with comment lines that describe it (`// title:`, `// note:`, `// order:`, optional `// springs:` where higher = looser and bouncier, optional `// stretch: 1` for a soft body that squashes along its path) and defines one function that fills in the look of the glass at each point:

```glsl
void glass(vec2 p, vec2 uv, inout Look look) {  // p: px from the card centre, uv: 0–1
  look.slope = ...;   // which way the surface leans; bends the picture behind
  look.depth = 48.0;  // px moved per unit of slope
  look.blur = 18.0;   // blur radius, px
  look.split = 0.16;  // colour fringe, as a share of the bend
  look.tint, look.milk, look.grain  // body colour, how solid it is, speckle
  look.shine = 0.0;   // matte (default 1 = polished)
  look.liquid = 2.6;  // show the water surface this strongly (default 0 = none)
}
```

`rim(p, width)` gives the band along the edge (1 at the rim → 0 at `width` px inside, plus the outward direction); `noise`, `hash`, `uTime` and `uSize` are available too.

### Physics per kind

Every card hangs on springs (drag it and let go), but each kind of glass has the physics that suits it, and only runs what its shader mentions:

| Kind | Physics | What the shader reads |
|---|---|---|
| `clear`, `hammered` | Rigid thick glass: leaning it shifts the picture inside | `uTilt` |
| `prism` | Rigid wedge: leaning it swings the spectrum | `uTilt` |
| `frost` | Frost that the pointer wipes clear and that creeps back | `uFog` (`fog.ts`, `shaders/fog.frag`) |
| `fade` (progressive blur) | The line of focus trails the pointer | `uFollow` |
| `fluted` | Ribs ring like harp strings when the pointer crosses them | `uRibs`, `uRib` (`strings.ts`, tuning in `harp`) |
| `dome` | A magnifying bubble that slides after the pointer | `uFollow` |
| `waves` | Sheets floating on water | `uLiquid` |
| `silk` | Cloth folds dragged by the pointer; soft body | `uFollow` |
| `sand` | Grains that slump to their angle of rest; rake and shake | `uSand` (`sand.ts`, `shaders/sand.frag`, tuning in `grit`) |
| `liquid` | Water: waves travel, bounce off the rim and settle | `look.liquid` (`liquid.ts`, `shaders/liquid.frag`, tuning in `flow`) |
| `jelly` | Soft body on loose springs, quivering inside | `// stretch: 1`, `look.liquid` |

`uFollow` is the pointer on the card (px from its centre) trailing behind on a spring; `uTilt` is how the card leans. `src/glass/field.ts` is the shared base of the simulated maps (water, sand, frost, heat).

## Glow cards page

`glow.html` is the light series: the same card and code as the glass page, on a near-black backdrop, with kinds that give off light (`src/glass/shaders/glow/*.glsl`, also `glow.html?glow=ember`). A glow kind sets `look.light` (light added on top of the card) and, with `#define HALO`, a function `vec3 halo(vec2 p, float away)` that lights the background `away` px outside the rim.

| Kind | Light | Physics | What the shader reads |
|---|---|---|---|
| `neon` | Gas tube around the card | Stutters as it strikes, then hums; tap to strike again | `uAge` |
| `ember` | Plate glowing with heat | Rubbing heats it; heat spreads, rises and cools | `uHeat` (`heat.ts`, `shaders/heat.frag`) |
| `aurora` | Curtains of light | The pointer is a wind that bends them | `uFollow` |
| `backlight` | Lamps behind a dark panel | Leaning it lets more light out of one side | `uTilt` |
| `led` (Pixels) | Matrix of tiny lamps | Afterglow: lamps the pointer passes flash and fade | `uFog` |
| `plasma` | Arcs from an electrode | Arcs snap to the pointer and follow it | `uFollow` |
| `flies` | Two dozen blinking points | A swarm that gathers round the pointer and scatters | `uFlies` (`flies.ts`, tuning in `swarm`) |
| `lamp` | Warm lamp behind frost | Swings after the pointer on a spring | `uFollow` |
| `button` | Button with an inner glow: strong under the top edge and round the upper corners, slight round every edge | Bright spot slides after the pointer; a tap presses it and it flares | `uFollow`, `uAge` |

## Material cards page

`materials.html` is the surface-finish series (`src/glass/shaders/materials/*.glsl`, also `materials.html?material=satin`). All three card pages are staged like a product photograph rather than a demo, and this page takes it furthest: a plain dark backdrop with a few out-of-focus colour lights and film grain, the card floating over a wide soft shadow and resting at a slight angle, quiet small print, and light that comes from large studio panels instead of a point lamp. Leaning the card or moving the pointer slides the panels' reflections across the surface.

| Kind | Finish | How it takes the studio light |
|---|---|---|
| `glass` | Thick frosted slab over colour lights | Blurs the body, bends and colour-splits at the rounded rim, hairline of light on the edge |
| `matte` | Soft-touch matte black | No reflection: a slow fall of light and fine grain |
| `satin` | Anodised gradient, amber to violet | A wide, soft band that takes on the colour underneath |
| `gloss` | Deep colour under a clear coat | Crisp-edged panel reflections that slide |
| `brushed` | Titanium, fine linear brush | Grooves smear the light sideways into a soft field |
| `spun` | Steel brushed in circles | Bright spokes from the centre that swing round |
| `foil` | Holographic foil on silver | Light breaks into a smooth run of spectrum colours |
| `ceramic` | Glazed off-white porcelain | Clear but faint reflections that waver on the uneven glaze |

How a material file works:

- It sets `look.milk = 1` (nothing shows through), `look.shine = 0` and `look.edge = 0` (it draws its own highlights and edge), its colour in `look.tint` and its reflections in `look.light`.
- `card.frag` provides the studio: `normalOf(slope)`, `shade(p, normal)` for soft even light, and `studio(p, normal, rough)` for what the surface reflects (`rough` 0 = crisp panel edges, 1 = fully soft). `EYE`, `LEAN` and `KEY` there set how fast reflections travel and where the main panel stands; the panels themselves are the four lines inside `studio`.
- `#define SIDE_COLOUR vec3(...)` gives the card visible thickness under its lower edge.
- Header lines: `// stage: #1b1c20` (backdrop colour), `// lights: 0.3` (strength of the colour lights behind), `// ink: dark` (dark print for light materials).
- Page-wide staging for each of the three pages is in `settings.series` in `src/glass/main.ts`: `stage` and `lights` (backdrop colour and colour lights), `words` (rows of type behind the card, used by the glass page), `lift` (shadow), `lean` (resting angle), `tilt` (how far it leans toward the pointer). The header lines above work on any page.

## Switch study page

`switch.html` is a finish study: tactile switches drawn entirely in a fragment shader, with no images and no 3D model. Six styles, chosen from the bar at the bottom (also `switch.html?style=rocker`, or the arrow keys); each shows one switch on and one off, and both can be toggled.

| Style | What it is |
|---|---|
| `knurled` | Track cut into the sheet, knurled knob on its floor; the floor turns orange |
| `soft` | One material throughout, told apart by light alone; a small green lamp |
| `rocker` | Rocker plate in a dark panel; the pressed side sinks and its mark lights |
| `slider` | Ridged block in a dark slot; uncovers a green lamp |
| `ball` | White ball in a rounded groove that fills with blue |
| `dish` | Raised clay bar with a dish pressed into it; the dish turns cream |

Nothing is a painted-on shadow or highlight. A style file (`src/switch/styles/*.glsl`) describes its switch once, as a height above the sheet for every point, and says what each part is made of. `src/switch/switch.frag` then lights every style the same way: each point is lit by how it faces a large soft light (sampled at seven places, so shadow edges are wide gradients), shaded as far as the shape blocks its view of that light, and darkened a little where walls crowd it. So every shadow stays attached to what casts it. A shadow is darkest where it touches what casts it and fades to nothing within `FALL` pixels. The light is set at the top of `switch.frag` (`SUN`, `SPREAD` for how soft it is, `AMBIENT`, `FALL`).

A style file starts with `// title:`, `// note:`, `// order:` and `// ink: light` (for a dark sheet), then defines:

- `HALF` (half size of the switch's outline), `SHEET_TOP` and `SHEET_BOTTOM` (sheet colour)
- `float height(vec2 p)`: height above the sheet, design pixels
- `vec3 paint(vec2 p, vec3 sheet)`: the colour of the material at each point
- `vec3 glow(vec2 p)`: light given off by lamps, added unshaded

`knobAt` (0 to 1) is where the switch is, and `amount()` is the same eased for colours and lamps. To add a style, copy one of the files.

`src/switch/main.ts` holds the spring and layout (`settings`), and lays an invisible real button with `role="switch"` over each drawn switch, so keyboard and screen readers work.

## Switches in 3D page

`switch3d.html` shows the six switches of the study as real 3D models made in Blender, shown with three.js: Knurled, Soft, Rocker, Slider, Ball and Dish. Pick one from the bar at the bottom (also `switch3d.html?style=ball`, or the arrow keys). Move the pointer and the view leans round it; click, tap or press Space to switch it.

How it works:

1. `blender/make_switch.py` (run with `npm run switch`, about a minute per style, in a background Blender) models every switch. Each style is one function with its own numbers at its top (sizes, colours); the light is shared and set at the top of the file. `npm run switch -- -- ball dish` rebuilds only the named ones.
2. It lights each model with one wide, soft, far-away light plus even room light, and bakes the light that falls on each part into pictures. Lamps (Soft, Slider, Rocker) are lit for the "on" bake, so their light on the parts round them is real too.
3. A baked shadow cannot follow a moving knob. So for a sliding knob the base is baked without it, and the knob's shadow is baked as its own picture (`knob-shadow.webp`: how much darker a flat floor is around the knob), which the page slides along the floor with the knob. The rocker tips in place, so it stays in the base's bake. The moving part itself is baked in three places: on, halfway and off.
4. It saves `blender/switches/<name>.blend`, exports `public/switch3d/<name>/` (`switch.glb`, `base-on`/`base-off`, `knob-on`/`knob-mid`/`knob-off`, and `knob-shadow`, all WebP; `QUALITY` in the script trades size for fidelity), and writes the list of styles the page offers to `src/switch3d/styles.json` (title, note, sheet colour, and a fingerprint of the style's files that the page adds to their addresses, so a browser never mixes stored files from an older bake with new ones).
5. `src/switch3d/main.ts` draws a model unlit: each part shows its own colour times the baked light. A style is loaded the first time it is chosen; until its model and every picture have arrived the page shows the plain sheet in that style's colour, then the switch fades in. Camera and spring are in `settings` at the top. The real `role="switch"` button is kept exactly over the switch as the view leans. `switch3d.html?hold=0.5` freezes the knob partway (0 off, 1 on) for inspection; clicks do not move it while held.

What a part does on the page is set on its material in the script: `off=` (a different colour while off), `glow=True` (a lamp, lit when on) and `gloss=` (a soft reflection of the light, used on the ball).

To change a look, edit the numbers at the top of its function in `make_switch.py` (or `LIGHT_SOFT` for shadow softness, `ROOM` for how filled the shadows are) and run `npm run switch` again. To add a style, copy one of the functions and add it to `STYLES`. You can also open the `.blend` files, but the baked pictures only update when the script runs.

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
| `npm run switch` | Rebuild the 3D switches and bake their light (`blender/make_switch.py`) |
| `npm run optimize` | Compress `public/scene.glb` (Meshopt + WebP) before shipping |

`export` and `demo` assume Blender at `/Applications/Blender.app`; edit `package.json` if yours is elsewhere.

## Good to know

- Only **Principled BSDF** materials with image textures survive export. Bake procedural node materials to textures, or recreate the effect as a fragment shader.
- Lights are exported in "compat" units so Blender strengths roughly match three.js. Area lights are not part of glTF.
- Hover scaling animates the object's scale; avoid tagging objects whose scale is also keyframed.
- `.blend` and `.glb` are binary. For big scenes, set up Git LFS before committing them.
