# Blender → three.js flow

Design the scene in Blender, press Export (or just save), and the browser refreshes with the new scene.
Scroll, mouse, hover and fragment shaders are handled by a small vanilla three.js app.

**Lab canvas:** https://amrojsawan.github.io/blender-threejs-flow/ (republished automatically on every push to `main`)
**3D styles:** https://amrojsawan.github.io/blender-threejs-flow/styles.html
**Glass cards:** https://amrojsawan.github.io/blender-threejs-flow/glass.html
**Glow cards:** https://amrojsawan.github.io/blender-threejs-flow/glow.html
**Material cards:** https://amrojsawan.github.io/blender-threejs-flow/materials.html
**Switch study:** https://amrojsawan.github.io/blender-threejs-flow/switch.html
**Switches in 3D:** https://amrojsawan.github.io/blender-threejs-flow/switch3d.html
**Switch in CSS:** https://amrojsawan.github.io/blender-threejs-flow/switch-css.html
**Expressions:** https://amrojsawan.github.io/blender-threejs-flow/expressions.html

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

A variant starts with comment lines that describe it (`// title:`, `// note:`, `// order:`, optional `// springs:` where higher = looser and bouncier, optional `// stretch: 1` for a soft body that squashes along its path, optional `// radius: 40` for its own corner radius in px instead of its series') and defines one function that fills in the look of the glass at each point:

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
| `smoke` | Near-black card with pale light soaking in from every edge; a ruler of fine ticks | Light gathers toward the pointer, ticks slide; a tap makes it swell | `uFollow`, `uAge` |
| `horizon` | Blue edge light turning teal toward the bottom, round a sun half risen over a horizon | Sun rises and sinks with the pointer; a tap makes the light swell | `uFollow`, `uAge` |
| `orchid` | Violet middle with edges cooling to blue and cyan; a pulsing cluster of dots | Edge colour leans toward the pointer; a tap brightens the dots | `uFollow`, `uAge` |
| `lagoon` | Teal light soaking in from the edges, with a brighter stretch drifting round the rim | The bright stretch jumps to the side the pointer is on; a tap makes it swell | `uFollow`, `uAge` |
| `aura` | Violet edge light round a deep blue middle, fine rings breathing round a small moon | Rings lean toward the pointer; a tap sends a ring outward | `uFollow`, `uAge` |

The last five are inner-glow cards: light soaks in from the edge and fades toward the middle. They use `inset(p, width)` from `card.frag`, whose contours are the card's own outline moved inward with the same corner radius, so the light turns each corner exactly as the card does (`rim` rounds its inner contours off into an oval instead). `REACH` is how far in the light reaches and `POWER` its brightness at the edge.

Every glow card has rounder corners than the other series (`settings.series.glow.radius` in `src/glass/main.ts`) and its own colour soaking in round the rim: one line in each kind, `look.light += colour * strength * soak(p, 0.42)`, where `soak` (also in `card.frag`) is that same corner-following falloff.

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

## Switch in CSS page (proof of concept)

`switch-css.html` is the knurled switch with no 3D on the page at all: pictures rendered in Blender, moved by plain CSS, with no JavaScript. It costs and behaves like any other CSS component, and every pixel on screen is one Blender rendered.

1. `blender/render_switch_css.py` (run with `npm run switch-css`, about three minutes) takes the model and light from `make_switch.py`, looks straight down at it without perspective, and renders the knob's journey from off to on as `FRAMES` (18) pictures joined side by side into one strip.
2. It renders the strip once per screen density (1x, 2x, 3x), each at its exact pixel size, so the browser never scales a picture. It writes `public/switch-css/knurled-1x/2x/3x.webp` (about 60, 160 and 270 kB; a browser loads only the one for its screen) and `src/switch-css/knurled.css` (sizes, frame count, addresses).
3. `src/switch-css/switch.css` is the component: a real checkbox with `role="switch"` lies invisibly over the picture; `:checked` moves the strip from its first frame to its last, and a `steps()` transition shows every frame on the way. The frames are spaced evenly in time, not distance, so the knob eases in and out.

The size on the page is fixed by `UNIT` in the script (CSS pixels per Blender unit); another size is another render. What this version cannot do is lean with the pointer: that needs the 3D page.

## Expressions page

`expressions.html` is a collection of fourteen small animated 3D scenes, each one "expression" picked out of a set of motion-design references. Choose one from the bar at the bottom (also `expressions.html?expression=rods`, or the arrow keys); the view leans a little toward the pointer. They are built directly in three.js from simple shapes, not exported from Blender.

| Stage | Expressions | Look |
|---|---|---|
| `light` | `iris`, `crest`, `vortex`, `halo` | Concentric rings of light with a lit zone sweeping round them, and a glowing ring, on black |
| `clay` | `ribbons`, `petals`, `coil`, `blades`, `blocks` | Matt grey shapes in a soft studio, with real-time soft shadows |
| `ember` | `orbit`, `rods`, `monolith`, `zigzag` | Dark shapes that glow orange and red at one end and cool to black |
| `steel` | `dial` | Dark grained metal under one lamp hanging above: faces go dark as they turn upright and light up as they tip back |

| File | For |
|---|---|
| `src/expressions/scenes/*.ts` | **One file per expression.** Drop a file in and it appears in the bar. It gives a `title`, `note`, `order`, its `stage`, and a `build()` that returns the objects and an `update(time)` called every frame. Its numbers (how many arcs, colours, speeds) are at the top |
| `src/expressions/kit.ts` | The building blocks: `rings()` (one field of rings that all share a centre, with a lit zone that can be turned, sheared and narrowed), `stepped()` (time that moves pose to pose), `keyed()` (a value read off a list of keyframes, in straight lines) and `flowing()` (the same as a smooth curve, for things that swing), `band()` (an arc of light with one crisp bright edge), `clay()` and `shadowed()` (matt material and shadows), `arcSlab()` (a thick slice of a ring), `ember()` (a material hot at one end and dark at the other) |
| `src/expressions/main.ts` | The page: camera, the three stages' backdrops and light (`settings.stages`), the bar, and the fade between expressions |

`dial` is a mechanical study after "Semantic Restructuring" by Reijo Palmiste. Every wedge of the dial is a flap that turns on its own (unseen) axle from hub to rim, and that is all it ever does; the hub is a plate that turns over once a second in the same way; the ring turns once per loop, and the whole dial nods twice. Its file opens with the mechanism as read from the clip; each flap's turning is a list of keyframes.

`orbit` and `rods` copy their reference clips' motion frame by frame: the lists of `[seconds, value]` at the top of each file are the reference's own timing (view, turn, heat, each moon and rod), and `PACE` slows or speeds the whole thing. Like the clips, each plays through and then starts again.

With the system's reduced-motion setting on, the expressions play at `settings.calm` of full speed. `expressions.html?expression=orbit&at=2.2` freezes an expression at that many seconds, for checking a pose; choosing another expression lets go of it.

## Illustrations page

`illustrations.html` shows marketing stills: sparse, abstract pictures of a product moment rather than diagrams. There are two scenes, chosen with the upper row of buttons; the lower row holds the chosen scene's variants.

- **Signal** is one thick rounded card floating over a dotted ground, with a single glowing line curving away from it through one or two small chips.
- **Gateway** is a bigger scene made from the same parts: a round hub in the middle with a bright ring, and bundles of thin lines running out of it, left and right, to three small cards, a tile and a label. Lights travel along the lines toward the hub.

The picture is made in two halves.

**Shape, in Blender.** Nothing is modelled by hand. `blender/make_illustration.py` writes one Geometry Nodes group per scene and the whole scene comes out of it:

```bash
npm run illustration
```

- **The parts are shared.** The card, the chip, the tile with its ring and the dotted ground are each one function under `PARTS` in the script, and both scenes are put together from them. A change to the card changes it everywhere.
- **The parameters** are each node group's inputs, listed in the script as `SIGNAL_PARAMETERS` and `GATEWAY_PARAMETERS`. For Signal: the card's size, thickness and corner radius, how high it floats, the line's reach, drift and bend, the number of chips, the dot spacing, and every word on the card. For Gateway: the hub's radius, its ring and how much of it is coloured, the dashes inside, how many lines are in a bundle, their spacing, how much they loosen and weave, how far out everything stands (`Span`), and every word. Open `blender/illustrations/signal.blend` or `gateway.blend` and they are on the object's modifier; change one and every part follows.
- **Where things stand in Gateway** (the three cards, the tile, the label, and where each bundle leaves the hub and ends) is a short list of positions above `GATEWAY_PARAMETERS`: `CARDS`, `TILE_AT`, `NODE_AT`, `BUNDLES`.
- **The ground's dots** are shapes in the `.blend`, but are left out of the files made for the page (they would be most of each file). The page draws them itself from the same `Dot Pitch`, `Dot Size` and `Ground`.
- **Extra numbers for the page** travel with the shape: every point of a card knows where on its card it is, and every point of a thin line knows how far along it is. That is how one card surface serves cards of any size anywhere, and how the lights run along the lines.
- **The words are geometry** made by the same network, so they stay sharp at any size. They are set in Inter (`blender/fonts`, SIL Open Font License; `FONTS` in the script names the two weights). To change the typeface, put another font there and point `FONTS` at it; use one whose outlines do not overlap, or letters such as 4 and + come out with holes. The card's layout follows its size: the panel fills the space between the head and foot strips, and right-hand items stay on the right edge.
- **Variants** are the same network with different numbers and words (each scene's `variants` in `SCENES` at the end of the script). Each is exported to `public/illustrations/<scene>/<name>.glb`; the page lists them and shows what each was made from, with the changed values marked.
- **Round things** take their segment count from `Resolution`.

**Light, in Blender too.** The light on the ground and on every solid part (cards, chips, the tile, the hub's plate) is worked out by Blender's Cycles renderer, the same way the 3D switches are lit: one wide soft lamp overhead, a dim even room, and the glowing parts (cards, the line, the hub's ring, the thin lines) shining on what is round them. The result, shadows and all, is saved per variant as two pictures: `<variant>.webp` for the ground and `<variant>-parts.webp` for the solid parts, each of which has its own place in that picture. The page multiplies each part's colour by its light, so a chip's lighter top and darker sides, and the green it picks up beside a glowing line, are real. Words and thin overlays cast no shadows. Everything about it is in `LIGHT` near the top of the script: the lamp's power, size and height, how brightly each kind of part shines, and the quality of the picture. Working the light out is what takes the time: about two minutes per variant.

**Look, on the page.** `src/illustrations/main.ts` colours each part by its Blender material name. The picture is drawn directly, with smoothed edges and no blur or grain over it. All of it is in `settings` at the top:

- `scenes`: per scene, the camera (`view`), the window shape it was composed for, and the faint shaft of light over the middle (`beam`, Gateway only).
- `card`: the gradient across a card (far left, middle, near right), how dark its sides are, the bright line round its top edge, the soft streak of light across it, and `lit`: how much the worked-out light counts on a card, which also glows by itself.
- `chip`: a chip's colour in full light.
- `ground`: the ground's and dots' colours in full light, and `light`, which scales the light Blender worked out.
- `plate`: the hub's plate and its faint grid, in full light.
- `wire`: the thin lines, drawn as glass tubes, and the light that moves inside them: the glass and its brighter outline, the light's two colours, how fast it runs, how far apart the lights are, how long the bright core is, how strong the soft haze round it, and how closely each line's lights follow its neighbour's (`step`, `loose`), which is what makes a bundle read as one current.
- `silk`: the other way of drawing the lines, used by the Gateway's Silk variant, which is Flow over again with only the lines drawn differently (`"wire": "silk", "like": "flow"` in `make_illustration.py`, so it shares Flow's model and light). The same modelled bundle is gathered on the page into one strand: a sharp middle line with soft veils winding slowly round it, fanning out to the modelled lines at both ends. Each point carries how far it stands from the middle of its bundle (`_off`) for this.
- `parts`: the plain parts. A `bright` above 1 makes a part glow (the line); `opacity` makes it see-through (the panel, the tile, the dim text).
- `look`: how far the camera leans toward the pointer.
- `bloom`: the small glow round the brightest parts. `samples`: how finely edges are smoothed.

The slightly darker corners are plain CSS, in `src/illustrations/illustrations.css`.

`?scene=gateway&variant=calm` links to a scene and a variant. `?keep` lets a still be saved from the canvas and adds `drawNow(seconds)` for drawing on request, with the moving lights at that moment.

With the system's reduced-motion setting on, the lights on the lines stand still.

An earlier, denser isometric scene ("Network": plates, towers, routed lines, label cards) was retired when the direction changed; it is in the git history before this change.

## Groove page (a touch control you can feel)

`tactile.html` is a study of one question: what would give a car's touchscreen back what knobs had, without drawing a knob? The page is split into two zones (Climate, Sound). Each zone is one wide roller set into the dashboard, drawn by a shader: almost flat when left alone, swelling under a resting finger, and a drum turning with the finger once it slides (an upright drum for a sideways slide). A window in it holds a counter drum, like an odometer's, which grows and rolls to the new value while that value is being changed; the zone itself takes a little of the screen from the other, which dims. All of it is in `src/tactile/main.ts`; the numbers are in `settings` at the top.

How it is worked:

| Do this | It does this | You get |
|---|---|---|
| Put a finger down anywhere in a zone | Nothing changes | A soft thud, the roller swelling under the finger, and (after a moment's rest) the zone and its values spoken |
| Slide up or down | The zone's main setting, one notch at a time, from wherever you landed | Per notch: a short pulse, a tick whose pitch rises with the value, the roller's ridges passing under the finger, one per notch, hanging back and then slipping on; the counter rolling to the next value |
| Slide left or right | The zone's second setting | The same, heavier and lower |
| Reach either end | Nothing more | A longer, lower thud, a red flush under the finger, no more ticks |
| Tap with a second finger while the first rests (or double-tap) | Switches the zone on or off | Two pulses and two notes, rising for on, falling for off |

"Eyes-free" turns the picture off so it can be tried by ear and hand alone. "Voice" turns the spoken values off.

Why it is built this way (what was read, 2026-11-23):

- **The problem is measured.** Four everyday tasks took 10 s in a 2005 car with buttons and up to 44.9 s on touchscreens ([Vi Bilägare 2022](https://www.vibilagare.se/english/physical-buttons-outperform-touchscreens-new-cars-test-finds)); touch use of CarPlay slowed reactions by 57%, more than texting ([TRL 2020](https://www.trl.co.uk/uploads/trl/documents/PPR948-_IAM-RoadSmart---infotainment-sim-study.pdf)). Pointing at a target is what suffers: its throughput fell 58% while driving ([Shen et al. 2025](https://faculty.washington.edu/wobbrock/pubs/uist-25.02.pdf)). So Groove has no targets.
- **Touching must not act.** Screen readers for blind people separate exploring from activating, and activate with a second finger or a tap anywhere, never by aiming again ([VoiceOver](https://support.apple.com/guide/iphone/learn-voiceover-gestures-iph3e2e2281/ios); [Slide Rule, 2008](https://faculty.washington.edu/wobbrock/pubs/assets-08.pdf)). That is the resting finger and the second-finger tap.
- **Direction, not position; edges, not points.** Marks made by direction can be done eyes-free ([Kurtenbach & Buxton 1994](https://billbuxton.com/MMUserLearn.html); in a car, [pieTouch 2009](https://www.medien.ifi.lmu.de/pubdb/publications/pub/ecker2009mobilehci/ecker2009mobilehci.pdf)), and blind users prefer large gestures tied to edges and corners ([Kane et al. 2011](https://faculty.washington.edu/wobbrock/pubs/chi-11.05.pdf)). Zones are halves of the screen, bounded by its real edges; a setting is a direction.
- **A click is short.** About 10 ms of vibration reads as a click, 30 ms or more as a buzz; skin is most sensitive near 250 Hz; sound and vibration must arrive within about 24 ms of each other to feel like one event ([Adelstein et al. 2003](https://researchr.org/publication/AdelsteinBAW03); [Kaaresoja 2016](https://theses.gla.ac.uk/7075)). Hence `pulse` and `apart` in the settings.
- **Sight can stand in for force.** Making what is shown lag and then catch up with the hand is felt as friction and bumps ([Lécuyer 2009](https://typeset.io/pdf/simulating-haptic-feedback-using-vision-a-survey-of-research-4b3p0h5i0p.pdf)); that is `stick`. Sound adds to how strong a touch feels ([Altinsoy 2020](https://www.jstage.jst.go.jp/article/ast/41/1/41_E19205/_article/-char/en)).
- **Feedback does help drivers.** Friction feedback on a touch surface cut eyes-off-road time by 19–39% in a driving simulator ([Colgate & Peshkin 2013](https://rosap.ntl.bts.gov/view/dot/26086)); spoken and sound cues restored driving performance lost to menu use ([Jeon et al. 2009](https://sites.lafayette.edu/neesm/files/2011/10/2009AAUI-JeonDavisonNeesWilsonWalker-cameraready.pdf)).

On an iPhone, `ios/Groove` is a thin app round the same page (it loads it from the site). The page tells the app what the finger just met (`land`, `notch`, `heavy`, `stop`, `on`, `off`, and how high the value is), and the app plays a shaped click on the Taptic Engine: how strong and how sharp each one is, is the `clicks(for:part:)` table in `GrooveApp.swift`. Open `ios/Groove/Groove.xcodeproj` in Xcode, choose your own team under Signing, and run it on a real iPhone (the simulator has no haptics). Its Swift source type-checks; the project itself has not been built yet.

What this page cannot show: a phone's motor is far cruder than a car's actuators. Android Chrome vibrates; iPhones give web pages no vibration (the page flips a hidden switch for a tick where that still works); a desktop gives sound only. And none of it has been tried by a driver: fewer glances do not by themselves mean better driving ([Christiansen et al. 2011](https://rd.springer.com/chapter/10.1007/978-3-642-23771-3_49)).

## Car screen page (Groove as a whole screen)

`car.html` is a full car screen built only from Groove zones (`src/car/main.ts`, `src/car/car.css`; the sound, vibration and voice are shared with the Groove page in `src/tactile/feel.ts`). There is no button on it to aim at. The screen has four zones, each found by where it is against the screen's edges:

| Zone | Slide up or down | Slide sideways | Second-finger tap |
|---|---|---|---|
| Stage (upper part) | The scene's own setting: map zoom, playlist, drive mode, contact | The next or previous scene: Map, Media, Car, Phone. The scenes are the sides of a block that turns with the finger, slid like a page | The scene's one action: mute guidance, pause, lock, call |
| Driver (bottom, driver's side) | Temperature | Fan | A/C |
| Sound (bottom, middle) | Volume | Track | Mute |
| Passenger (bottom, far side) | Temperature | Seat heat | A/C |

How it is laid out, and why:

- **Read above, work below.** What is only read (time, gear and speed, range, the map) is high, near the driver's line of sight; the rollers are along the bottom edge, where a resting hand falls, and each climate roller is on its own occupant's side (`settings.driver` swaps them for right-hand drive).
- **One grammar everywhere.** Every zone is worked the same way, so it is learned once: rest (nothing changes, the zone is spoken), up/down, sideways, second finger. Nothing depends on where inside a zone the finger lands.
- **A fixed place for everything.** No menus and no pages of settings: a function is always the same zone and the same direction, which is what lets the hand learn it.
- **The screen shows what is changing.** The setting being changed brightens and thickens, its number grows and its name appears beside it; the zone's other setting and everything else on the screen step back.
- **Each scene has one accent** and little on it: a turn card and arrival time on the map, one track, four numbers for the car, one contact.

- **Glass above, a machined sill below** (`src/car/sill.ts`). The lower part of the screen is one slab of dark brushed metal drawn in real 3D with three.js, seen from a little above and lit by a soft room. It is modern rendering, not a picture of an old control: the slab is a single sheet whose relief is worked out for every pixel from one height function, which turns the light, darkens the hollows and dips under a finger. Its settings are shapes cut into it, and they move:
  - temperature is a knurled roller lying in a slot, turning one ridge per notch, its end bands coloured like heated metal from blue through straw to red;
  - the fan is a field of waves milled across its bay, taller and faster with every notch;
  - volume is rings turned into the metal round a point, spreading further the louder it is;
  - the track is a row of dimples with a polished ball resting in the one that is playing;
  - seat heat is three slots that glow from inside, one more with each level.
  What stands up is worked up and down; what runs across is worked sideways. While a setting is being changed the light stays on it and the rest of the slab falls back. The numbers for all of this are in `look` at the top of the file.
- **Why the sill is a third of the screen and not a strip** (studied 2026-11-24). Reach costs more than look-down: moving a control from near and high to far and low raised task time by 79% ([Fuller & Tsimhoni, UMTRI 2009](https://rosap.ntl.bts.gov/view/dot/16997/dot_16997_DS1.pdf)), so the controls sit at the edge nearest the hand and what is read sits above. Big buttons alone do not make touch eyes-free, physical landmarks do ([Rümelin & Butz 2013](https://www.medien.ifi.lmu.de/pubdb/publications/pub/ruemelin2013autoui2/ruemelin2013autoui2.pdf)), and features should be at least 17.5 mm ([Kim et al. 2014](https://oasis.postech.ac.kr/handle/2014.oak/27330)). Today's cars give this job a strip of small icons 8–12% of the screen's height, and none gives its touch controls a machined form.
- **Icons everywhere.** Every setting carries its usual icon beside its value, each roller's switch is a lit icon (a snowflake for A/C, a speaker for sound), and the stage's scenes are named with icons along its bottom edge.
- **The stage's scenes sit on a wide drum** with the next and previous scene in view at its edges, so it is plain there is more that way.

It is a study of the idea, not a product: the map, the tracks and the car's numbers are made up, and nothing has been tried by a driver.

## Air page (where it blows in the cabin)

`air.html` is a study for the car screen's climate: it shows where the air comes out in the cabin, which way it goes, and what it reaches.

**The cabin is baked in Blender** (`blender/make_cabin.py`, run with `npm run cabin`, a few minutes). It uses an open, high-detail car model: Khronos's ["Car Concept"](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept) sample, CC-BY 4.0, made from a public-domain design by Unity Fan. The model is not kept in this repository (download `CarConcept.glb` into `blender/models/car-concept/`), and its Khronos logos, which that licence does not cover, are left out of the picture. The car seats its driver in the middle, with a seat each side just behind and one at the back. The script takes off its roof and glass, quietens its coloured trim, and renders from straight above, front of the car up:

- `public/air/cabin.webp`: the cabin under soft studio light (a wide lamp overhead, a long low one each side);
- `public/air/light-face.webp`, `-feet`, `-screen`, `-back`: for each set of vents, only the light its air throws on the cabin, cool on the left and warm on the right, on black;
- `src/air/vents.json`: where each vent is in the picture and which way it blows.

**The air is drawn live** (`src/air/strands.ts`) from those vent positions, as a clear breeze: an even glow in the shape of the air's path, fine near-straight lines of light running outward in order, and small bright motes carried along. There is no cloud in it.

**The page** (`src/air/main.ts`) lays them together. When a set of vents is switched on its air appears and its baked light comes up on the seats and trim it reaches, so the cabin itself shows where the cool and the warm air land. The fan sets how much of both. The vents, and how strongly the air lights the cabin, are in `VENTS` and `LOOK` at the top of `make_cabin.py`.

**The controls are on the car.** Its three flat panels are the controls: the one in front of each side seat sets that side's temperature (16–28 °C in half degrees), the one behind the driver sets the fan (off to 7). Slide up or down on a panel, tap its top or bottom half for one notch, or use the arrow keys. Each notch ticks and is felt, with a stop at each end, as on the Groove pages. The air and its baked light take their colour from the temperature: cool blue, through a clear near-white half-way, to warm amber (`tint` in `src/air/strands.ts`). For that, the baked light is shown as grey and coloured on the page, once for each half of the car. Where the panels lie on the picture is in `settings.panels` in `src/air/main.ts`.

Also here, switched off: looping films of air simulated with Blender's fluid solver (`blender/make_air.py`, `haze` in `main.ts`). They were made for an earlier, hand-built cabin and read as smoke. Earlier live versions are in the history.

## Lab canvas (the entry page)

`index.html` is the way in: one open canvas, like a design tool's board, with the eight studies laid out on it as frames in three groups (Scenes, Cards, Switches) beside a short brief.

- **Moving about:** drag to move, scroll to pan, pinch or Ctrl/Cmd-scroll to zoom. Keys: `+` `−` zoom, `0` fit everything, `1` 100%, arrows pan, `[` `]` previous and next study.
- **Floating navigator** (top left): the list of studies. Choosing one flies to its frame. It folds away, and starts folded on phones.
- **Floating toolbar** (bottom): previous/next study, zoom out, zoom level (click for 100%), zoom in, fit everything, and a button that opens the chosen study.
- **Frames:** each shows a picture of its study. Choosing a study (click it, or pick it in the navigator) flies to it and, on a wide screen with a mouse, runs it live inside its frame; one runs at a time. Clicking the chosen study opens it. The address keeps the choice (`#glow`).
- Without JavaScript the same page is a plain grid of links.

| File | For |
|---|---|
| `index.html` | The board's contents. Each study is one `<a class="frame">`; `--x` and `--y` in its `style` are where it sits, in pixels. Add its name to the navigator's list too |
| `public/lab/*.webp` | The pictures in the frames (16:10 captures of each study) |
| `src/lab/lab.css` | The look: colours and the one accent (`--signal`) are at the top |
| `src/lab/main.ts` | Pan, zoom, flying and choosing; `settings` at the top holds the zoom range, flight time and margins |

The Blender scroll scene that used to be the entry page is now `styles.html`.

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
| `npm run switch-css` | Render the knurled switch as pictures for the CSS-only page (`blender/render_switch_css.py`) |
| `npm run illustration` | Build each illustration scene from its node network and export every variant (`blender/make_illustration.py`) |
| `npm run optimize` | Compress `public/scene.glb` (Meshopt + WebP) before shipping |

`export` and `demo` assume Blender at `/Applications/Blender.app`; edit `package.json` if yours is elsewhere.

## Good to know

- Only **Principled BSDF** materials with image textures survive export. Bake procedural node materials to textures, or recreate the effect as a fragment shader.
- Lights are exported in "compat" units so Blender strengths roughly match three.js. Area lights are not part of glTF.
- Hover scaling animates the object's scale; avoid tagging objects whose scale is also keyframed.
- `.blend` and `.glb` are binary. For big scenes, set up Git LFS before committing them.
