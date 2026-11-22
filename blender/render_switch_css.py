"""Renders a switch as pictures for the CSS-only version (switch-css.html): no 3D on the page at all.

Run:  npm run switch-css

It takes the model and light from make_switch.py, looks straight down at it, and renders the knob's
whole journey from off to on as FRAMES pictures, joined side by side into one strip. It does that
once per screen density, each at its exact pixel size, so the browser never scales a picture.
The page shows one frame of the strip at a time and steps through them with a CSS transition.

Writes public/switch-css/<name>-1x/2x/3x.webp and src/switch-css/<name>.css (sizes and addresses).
"""

import hashlib
import math
import os
import sys
import tempfile

import bmesh
import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
import make_switch as models  # noqa: E402

# ---- The control panel ---------------------------------------------------------------------------
NAME = "knurled"
UNIT = 50             # CSS pixels per Blender unit: sets the size of the switch on the page
MARGIN = 0.36         # sheet shown round the switch, units (room for its soft shadow)
FRAMES = 18           # pictures from off to on: at 0.3 s that is one per screen refresh
DENSITIES = (1, 2, 3) # screen densities to render for (3 = recent phones)
SAMPLES = 400
QUALITY = 92          # WebP quality of the strips
FEATHER = 0.1         # width of the edge, units, over which a picture fades into the page

OUT = os.path.join(HERE, "..", "public", "switch-css")
CSS = os.path.join(HERE, "..", "src", "switch-css", f"{NAME}.css")
os.makedirs(OUT, exist_ok=True)

models.fresh()
made = models.STYLES[NAME]()
scene = models.scene
knob = made["knob"]
for mat in bpy.data.materials:  # matt throughout, like the baked version
    inputs = models.principled(mat).inputs
    (inputs.get("Specular IOR Level") or inputs["Specular"]).default_value = 0.0

# The modelled sheet stops a little way out from the switch. Continue it, a hair lower, to well past the picture's corners.
reach = made.get("sheet", models.SHEET) - 0.02
hx, hy, radius = made["rim"]
more = bmesh.new()
models.loft(more, [models.rounded(hx + reach, hy + reach, radius + reach, -0.0003, 20), models.rounded(8.0, 8.0, 0.0, -0.0003, 20)], lambda i: 0)
models.finish("More sheet", more, [bpy.data.materials["Sheet"]])

half = (made["rim"][0] + MARGIN, made["rim"][1] + MARGIN)
width, height = round(2 * half[0] * UNIT), round(2 * half[1] * UNIT)  # CSS pixels

# The camera looks straight down, without perspective, so the picture is the switch's exact front view.
camera_data = bpy.data.cameras.new("Camera")
camera_data.type = "ORTHO"
camera_data.ortho_scale = 2 * half[0]
camera = bpy.data.objects.new("Camera", camera_data)
camera.location = (0.0, 0.0, 10.0)
scene.collection.objects.link(camera)
scene.camera = camera
scene.cycles.samples = SAMPLES
scene.cycles.seed = 7
scene.cycles.use_animated_seed = False  # the same grain in every frame, so the still parts do not shimmer
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.resolution_percentage = 100
shot = os.path.join(tempfile.mkdtemp(), "frame.png")


def render(k, density):
    """The switch k of the way on, as an array of rows of (r, g, b, a)."""
    knob.location.x = (2.0 * k - 1.0) * made["travel"]
    models.set_state(models.ease(min(max((k - 0.1) / 0.8, 0.0), 1.0)))  # colours change through the middle of the travel
    scene.render.resolution_x, scene.render.resolution_y = width * density, height * density
    scene.render.filepath = shot
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(shot)
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height * density, width * density, 4)
    bpy.data.images.remove(image)
    return pixels


# Brightness: the open sheet should come out as the sheet's own colour, as on the 3D page.
to_linear = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
sheet = models.SPECS["Sheet"][0]
seen = render(0.0, 1)[2, 2, :3]
scene.cycles.film_exposure = sheet[1] / to_linear(float(seen[1]))

marks = {}
for density in DENSITIES:
    frames = []
    for index in range(FRAMES):
        k = models.ease(index / (FRAMES - 1))  # frames are evenly spaced in time, so the knob eases in and out
        frame = render(k, density)
        if index == 0:
            corner = frame[2, 2, :3].copy()
        # Fade the picture's edge into the page, so no rectangle can show round it.
        rows, columns = np.mgrid[0:frame.shape[0], 0:frame.shape[1]]
        from_edge = np.minimum(np.minimum(rows, frame.shape[0] - 1 - rows), np.minimum(columns, frame.shape[1] - 1 - columns))
        t = np.clip(from_edge / (FEATHER * UNIT * density), 0.0, 1.0)
        frame[:, :, 3] = t * t * (3.0 - 2.0 * t)
        frames.append(frame)
    joined = np.concatenate(frames, axis=1)
    strip = bpy.data.images.new(f"{NAME}-{density}x", joined.shape[1], joined.shape[0], alpha=True)
    strip.pixels.foreach_set(joined.ravel())
    path = os.path.join(OUT, f"{NAME}-{density}x.webp")
    strip.file_format = "WEBP"
    strip.save(filepath=path, quality=QUALITY)
    with open(path, "rb") as file:
        marks[density] = hashlib.md5(file.read()).hexdigest()[:8]
    print(f"{NAME} {density}x: {joined.shape[1]}x{joined.shape[0]} px, {os.path.getsize(path) // 1024} kB")

# The numbers and addresses the page's CSS needs.
colour = "#" + "".join(f"{round(255 * float(c)):02x}" for c in corner)
address = lambda density: f"url('/switch-css/{NAME}-{density}x.webp?v={marks[density]}') {density}x"
inset = round(MARGIN * UNIT)
os.makedirs(os.path.dirname(CSS), exist_ok=True)
with open(CSS, "w") as file:
    file.write(f"""/* Written by blender/render_switch_css.py: do not edit by hand. */
:root {{ --{NAME}-sheet: {colour}; }}
.switch-css.{NAME} {{
  --w: {width}px;
  --h: {height}px;
  --inset: {inset}px; /* sheet round the switch inside the picture */
  --round: {round(made["rim"][2] * UNIT)}px;
  --frames: {FRAMES};
  --stepping: steps({FRAMES - 1});
}}
.switch-css.{NAME} .art {{
  background-image: url('/switch-css/{NAME}-1x.webp?v={marks[1]}');
  background-image: image-set({", ".join(address(density) for density in DENSITIES)});
}}
""")
print(f"sheet colour on the page: {colour}")
print("switch pictures rendered")
