"""Builds the 3D switch: models it, bakes its soft studio light, saves blender/switch.blend and
exports public/switch3d/ (switch.glb plus six baked light pictures).

Run:  npm run switch
The page (switch3d.html) shows the model unlit and multiplies each part's colour by the baked light.
A baked shadow cannot follow a moving knob, so the knob's shadow is baked as its own picture, which
the page slides along the floor with the knob. The knob itself is baked on, halfway and off.

Sizes are in Blender units; 1 unit = 100 of the design pixels used by the drawn switches.
"""

import math
import os

import bmesh
import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "switch3d")
os.makedirs(OUT, exist_ok=True)

# ---- The control panel -------------------------------------------------------------------------
STRAIGHT = 0.72   # half length of the straight part of the track (also how far the knob travels)
TRACK = 0.78      # half height of the track floor
LIP = 0.12        # width of the sloping wall between sheet and floor
DEPTH = 0.22      # how deep the track is cut
KNOB = 0.72       # knob radius
FACE = 0.57       # radius of the knurled face
RISE = 0.05       # how far the knob's top stands above the sheet
CELL = 0.046      # size of one knurl pyramid
TIP = 0.011       # its height
PRESS = 0.045     # how deep the two marks are pressed into the floor
SHEET = 0.4       # how far the modelled sheet reaches beyond the track (the page continues it in the same colour)
COLOURS = {       # what each part is made of (the page reads these from the exported model)
    "Sheet": (0.83, 0.83, 0.84),
    "Wall": (0.86, 0.85, 0.84),
    "FloorOff": (0.3, 0.3, 0.31),
    "FloorOn": (0.96, 0.22, 0.004),
    "Knob": (0.9, 0.89, 0.88),
    "Grip": (0.78, 0.77, 0.76),
}
LIGHT_FROM = (-0.26, 0.72, 0.64)  # direction to the light: above, slightly left (the same as the drawn switches)
LIGHT_SOFT = 30.0     # how wide the light is, degrees: wider = softer shadows
LIGHT_POWER = 3.2
ROOM = 0.2            # even light from the whole room, which fills the shadows
MAP = 1024            # size of each baked light picture, px
SAMPLES = 192
SHADOW_SPAN = (3.4, 2.2)  # size of the patch of floor the knob's shadow picture covers
OPEN = 0.6            # brightness the open, unshaded sheet is stored at (leaves headroom for brighter parts)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.view_settings.view_transform = "Standard"
scene.render.bake.margin = 16


def material(name, colour):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*colour, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat


MATS = {name: material(name, COLOURS[name]) for name in ("Sheet", "Wall", "Knob", "Grip")}
MATS["Floor"] = material("Floor", COLOURS["FloorOn"])
SLOT = {name: index for index, name in enumerate(("Sheet", "Wall", "Floor"))}


def stadium(radius, z, straight=STRAIGHT, count=40, turned=False):
    """One outline of the pill shape: two half circles of `radius` joined by straight sides."""
    points = []
    for side, start in ((1, -90.0), (-1, 90.0)):
        for i in range(count):
            a = math.radians(start + 180.0 * i / (count - 1))
            x, y = side * straight + radius * math.cos(a), radius * math.sin(a)
            points.append((y, x, z) if turned else (x, y, z))
    return points


def loft(bm, rows, slot_of, offset=(0.0, 0.0), smooth=True):
    """Joins a list of outlines (each a list of points) into a surface, row to row."""
    rings = [[bm.verts.new((x + offset[0], y + offset[1], z)) for x, y, z in row] for row in rows]
    for index in range(len(rings) - 1):
        a, b = rings[index], rings[index + 1]
        for i in range(len(a)):
            j = (i + 1) % len(a)
            try:
                face = bm.faces.new((a[i], a[j], b[j], b[i]))
            except ValueError:
                continue
            face.material_index = slot_of(index)
            face.smooth = smooth
    return rings


def finish(name, bm, materials, cutters=()):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for mat in materials:
        mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    # Shapes to press into it.
    for cutter in cutters:
        cut = obj.modifiers.new("Press", "BOOLEAN")
        cut.operation = "DIFFERENCE"
        cut.object = cutter
        bpy.ops.object.modifier_apply(modifier=cut.name)
        bpy.data.objects.remove(cutter)
    if cutters:  # the underside was only there to make the shape solid for pressing
        under = bmesh.new()
        under.from_mesh(mesh)
        bmesh.ops.delete(under, geom=[f for f in under.faces if f.calc_center_median().z < -DEPTH - 0.1], context="FACES")
        for f in under.faces:  # the floor and the marks' walls are flat: shade each face on its own, with crisp edges
            if f.material_index == SLOT["Floor"]:
                f.smooth = False
        under.to_mesh(mesh)
        under.free()
    # Its own layout for the baked light picture.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(50), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)
    return obj


# ---- Base: the sheet, the sloping wall, the track floor and the two marks pressed into it -------
def solid(name, rows, offset):
    """A closed shape (used to press a mark into the floor), painted like the floor."""
    shape = bmesh.new()
    loft(shape, rows, lambda i: SLOT["Floor"], offset=offset, smooth=False)
    bmesh.ops.remove_doubles(shape, verts=shape.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(shape, faces=shape.faces)
    mesh = bpy.data.meshes.new(name)
    shape.to_mesh(mesh)
    shape.free()
    for mat in (MATS["Sheet"], MATS["Wall"], MATS["Floor"]):
        mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


circle = lambda radius, z: stadium(radius, z, 0.0, 32)
low, high = -DEPTH - PRESS, -DEPTH + 0.06
# A slot on the on side and a ring on the off side.
slot = solid("Slot", [stadium(0.0, low, 0.13, 12, True), stadium(0.034, low, 0.13, 12, True), stadium(0.034, high, 0.13, 12, True), stadium(0.0, high, 0.13, 12, True)], (-1.0, 0.0))
ring = solid("Ring", [circle(0.135, low), circle(0.2, low), circle(0.2, high), circle(0.135, high), circle(0.135, low)], (1.0, 0.0))

bm = bmesh.new()
outer = TRACK + LIP + SHEET
rows = [stadium(0.0, -1.0), stadium(outer, -1.0), stadium(outer, 0.0), stadium(TRACK + LIP + 0.15, 0.0), stadium(TRACK + LIP + 0.02, 0.0)]
sheet_from = 2
wall_from = len(rows) - 1
WALL_STEPS = 12
for step in range(WALL_STEPS + 1):
    t = step / WALL_STEPS
    rows.append(stadium(TRACK + LIP * (1.0 - t), -DEPTH * (t * t * (3.0 - 2.0 * t))))
floor_from = len(rows) - 1
rows += [stadium(TRACK * 0.6, -DEPTH), stadium(TRACK * 0.25, -DEPTH), stadium(0.0, -DEPTH)]
loft(bm, rows, lambda i: SLOT["Sheet"] if i < wall_from else SLOT["Wall"] if i < floor_from else SLOT["Floor"])
base = finish("Base", bm, [MATS["Sheet"], MATS["Wall"], MATS["Floor"]], cutters=(slot, ring))

# ---- Knob: a gently domed puck with a knurled face set slightly in ------------------------------
bm = bmesh.new()
face_z = RISE - 0.014
circle = lambda radius, z: stadium(radius, z, 0.0, 48)
profile = [
    (KNOB, -DEPTH), (KNOB, 0.0), (KNOB - 0.004, 0.016), (KNOB - 0.014, 0.03), (KNOB - 0.032, 0.04),  # side and rounded shoulder
    (KNOB - 0.07, 0.046), (FACE + 0.03, RISE), (FACE + 0.006, RISE - 0.001),                         # the wide, nearly flat ring
    (FACE, face_z), (FACE - 0.02, face_z - 0.004), (0.0, face_z - 0.004),                          # the face, set in (its middle sits just under the knurl)
]
face_from = len(profile) - 3
loft(bm, [circle(r, z) for r, z in profile], lambda i: 1 if i >= face_from else 0)
# The knurl: rows of small pyramids on a lattice turned 45°, kept inside the face.
reach = int(FACE / CELL) + 2
for i in range(-reach, reach + 1):
    for j in range(-reach, reach + 1):
        cx, cy = (i - j) * CELL * 0.7071, (i + j) * CELL * 0.7071
        if math.hypot(cx, cy) + CELL * 0.72 > FACE - 0.012:
            continue
        half = CELL * 0.5
        corners = [(-half, -half), (half, -half), (half, half), (-half, half)]
        turned = [bm.verts.new((cx + (x - y) * 0.7071, cy + (x + y) * 0.7071, face_z)) for x, y in corners]
        tip = bm.verts.new((cx, cy, face_z + TIP))
        for k in range(4):
            bm.faces.new((turned[k], turned[(k + 1) % 4], tip)).material_index = 1

knob = finish("Knob", bm, [MATS["Knob"], MATS["Grip"]])

# ---- Light: one wide, soft light from far away, and an evenly lit room -------------------------
# Far away, so the open sheet is lit the same everywhere and the page can continue it in one colour.
light_data = bpy.data.lights.new("Light", "SUN")
light_data.angle = math.radians(LIGHT_SOFT)
light_data.energy = LIGHT_POWER
light = bpy.data.objects.new("Light", light_data)
light.location = [10.0 * v for v in LIGHT_FROM]
scene.collection.objects.link(light)
aim = bpy.data.objects.new("Aim", None)
scene.collection.objects.link(aim)
track = light.constraints.new("TRACK_TO")
track.target = aim
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"
world = bpy.data.worlds.new("Room")
world.use_nodes = True
background = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
background.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
background.inputs["Strength"].default_value = ROOM
scene.world = world


# ---- Bake: the light that falls on each part, with the knob on, halfway and off ------------------
def bake(obj, label, size=MAP):
    image = bpy.data.images.new(f"{obj.name}-{label}", size, size, float_buffer=True)
    for mat in obj.data.materials:
        nodes = mat.node_tree.nodes
        node = nodes.get("Bake") or nodes.new("ShaderNodeTexImage")
        node.name = "Bake"
        node.image = image
        nodes.active = node
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"})  # light only, without the part's own colour
    return image


def set_colour(mat, colour):
    next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (*colour, 1.0)


images = {}
mid_colour = [(a + b) / 2 for a, b in zip(COLOURS["FloorOn"], COLOURS["FloorOff"])]
# The base is baked without the knob (its shadow is baked separately, below, so it can travel with
# the knob), once for each floor colour, because light bouncing off the floor carries its colour.
knob.hide_render = True
for label, floor in (("on", COLOURS["FloorOn"]), ("off", COLOURS["FloorOff"])):
    set_colour(MATS["Floor"], floor)
    images[("Base", label)] = bake(base, label)
# The knob is baked in three places along its travel.
knob.hide_render = False
for label, x, floor in (("on", STRAIGHT, COLOURS["FloorOn"]), ("mid", 0.0, mid_colour), ("off", -STRAIGHT, COLOURS["FloorOff"])):
    knob.location.x = x
    set_colour(MATS["Floor"], floor)
    bpy.context.view_layer.update()
    images[("Knob", label)] = bake(knob, label)

# The knob's shadow: how much darker a flat floor is around the knob than with no knob there.
# The page slides this picture along with the knob, so the shadow is always under it.
knob.location.x = 0.0
base.hide_render = True
bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.0, 0.0, -DEPTH + 0.0005))
ground = bpy.context.active_object
ground.scale = (SHADOW_SPAN[0], SHADOW_SPAN[1], 1.0)
ground.data.materials.append(MATS["Sheet"])
bpy.context.view_layer.update()
with_knob = np.array(bake(ground, "with", 512).pixels[:], dtype=np.float32).reshape(-1, 4)
knob.hide_render = True
without = np.array(bake(ground, "without", 512).pixels[:], dtype=np.float32).reshape(-1, 4)
shadow = bpy.data.images.new("knob-shadow", 512, 512, float_buffer=True)
ratio = np.ones_like(with_knob)
ratio[:, :3] = np.clip(with_knob[:, :3].mean(axis=1, keepdims=True) / np.maximum(without[:, :3].mean(axis=1, keepdims=True), 1e-4), 0.0, 1.0)
shadow.pixels.foreach_set(ratio.ravel())
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
shadow.save_render(os.path.join(OUT, "knob-shadow.png"), scene=scene)
bpy.data.objects.remove(ground)
knob.hide_render = False
base.hide_render = False

# Store every picture on the same scale, with the open sheet at OPEN.
# A small square of open sheet, far from the switch, measures how bright "unshaded" is.
bpy.ops.mesh.primitive_plane_add(size=1.0, location=(30.0, 0.0, 0.0))
probe = bpy.context.active_object
probe.data.materials.append(MATS["Sheet"])
probe_pixels = np.array(bake(probe, "probe", 16).pixels[:], dtype=np.float32).reshape(-1, 4)
sheet_light = float(probe_pixels[:, :3].mean())
bpy.data.objects.remove(probe)
pixels = {key: np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4) for key, image in images.items()}
for key, image in images.items():
    data = pixels[key]
    data[data[:, 3] < 0.5, :3] = sheet_light  # unused parts of the picture: plain, so nothing dark bleeds in at small sizes
    data[:, :3] = np.clip(data[:, :3] * (OPEN / sheet_light), 0.0, 1.0)
    data[:, 3] = 1.0
    image.pixels.foreach_set(data.ravel())
    image.update()
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    image.save_render(os.path.join(OUT, f"{key[0].lower()}-{key[1]}.png"), scene=scene)
print(f"open sheet light before scaling: {sheet_light:.3f}")

# ---- Save and export ---------------------------------------------------------------------------
knob.location.x = 0.0
set_colour(MATS["Floor"], COLOURS["FloorOn"])
for mat in bpy.data.materials:  # the bake pictures are saved beside the model, not inside it
    node = mat.node_tree.nodes.get("Bake") if mat.node_tree else None
    if node:
        mat.node_tree.nodes.remove(node)
base["travel"] = STRAIGHT
base["floorOff"] = COLOURS["FloorOff"]
base["open"] = OPEN
base["shadowSpan"] = SHADOW_SPAN
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "switch.blend"))
bpy.ops.object.select_all(action="DESELECT")
base.select_set(True)
knob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "switch.glb"), use_selection=True, export_extras=True, export_yup=True, export_apply=True)
print("switch built")
