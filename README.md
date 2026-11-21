# Blender → three.js flow

Design the scene in Blender, press Export (or just save), and the browser refreshes with the new scene.
Scroll, mouse, hover and fragment shaders are handled by a small vanilla three.js app.

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
| Set the scene camera | It becomes the web camera (framing is kept on phones) |

Tags are added with the buttons in the three.js panel (they are ordinary custom properties).

## Web side

| File | What it is for |
|---|---|
| `src/config.ts` | **The control panel**: background, lighting, scroll length and smoothing, mouse parallax, hover effect, plus `events` hooks (`onEnter`, `onLeave`, `onClick`, `onScroll`) for custom behaviour |
| `src/shaders/*.frag` | Fragment shaders. Drop a file in, reference it by name from Blender or from `config.look.backgroundShader` |
| `src/shaders/*.vert` | Optional. A `.vert` with the same name as a `.frag` also moves the surface (see `pulse.vert`: noise displacement) |
| `src/stage.ts` | Renderer, GLB loading, camera |
| `src/scroll.ts` | Blender animations ↔ scroll |
| `src/hover.ts` | Raycasting, hover, click |
| `src/shaders.ts` | Wires shaders to objects and feeds them uniforms |

Every shader receives: `uTime`, `uScroll` (0–1), `uMouse` (-1…1), `uResolution`, `uHover` (0–1), `uColor` (the Blender base colour), and varyings `vUv`, `vNormal`, `vWorldPosition`, `vNoise`.

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
