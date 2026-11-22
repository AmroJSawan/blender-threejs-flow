"""Builds the 3D switch: models it, bakes its soft studio light, saves blender/switch.blend and
exports public/switch3d/ (switch.glb plus four baked light pictures).

Run:  npm run switch
The page (switch3d.html) shows the model unlit and multiplies each part's colour by the baked light.
Because a baked shadow cannot follow a moving knob, the light is baked twice, with the knob on and
off, and the page blends between the two as the knob travels.

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
LIP = 0.11        # width of the sloping wall between sheet and floor
DEPTH = 0.22      # how deep the track is cut
KNOB = 0.72       # knob radius
FACE = 0.57       # radius of the knurled face
RISE = 0.05       # how far the knob's top stands above the sheet
CELL = 0.07       # size of one knurl pyramid
TIP = 0.015       # its height
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
LIGHT_SOFT = 38.0     # how wide the light is, degrees: wider = softer shadows
LIGHT_POWER = 3.2
ROOM = 0.26           # even light from the whole room, which fills the shadows
MAP = 1024            # size of each baked light picture, px
SAMPLES = 192
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


def finish(name, bm, materials):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for mat in materials:
        mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    # Its own layout for the baked light picture.
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(50), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)
    return obj


# ---- Base: the sheet, the sloping wall, the track floor and the two marks on it ---------------
bm = bmesh.new()
rows = [stadium(TRACK + LIP + SHEET, 0.0), stadium(TRACK + LIP + 0.15, 0.0), stadium(TRACK + LIP + 0.02, 0.0)]
wall_from = len(rows) - 1
WALL_STEPS = 10
for step in range(WALL_STEPS + 1):
    t = step / WALL_STEPS
    rows.append(stadium(TRACK + LIP * (1.0 - t), -DEPTH * (t * t * (3.0 - 2.0 * t))))
floor_from = len(rows) - 1
rows += [stadium(TRACK * 0.6, -DEPTH), stadium(TRACK * 0.25, -DEPTH), stadium(0.0, -DEPTH)]
loft(bm, rows, lambda i: SLOT["Sheet"] if i < wall_from else SLOT["Wall"] if i < floor_from else SLOT["Floor"])
# A slot mark on the on side and a ring mark on the off side, standing a little proud of the floor.
proud = -DEPTH + 0.014
slot = [stadium(0.05, -DEPTH, 0.13, 10, True), stadium(0.03, proud, 0.13, 10, True), stadium(0.0, proud, 0.13, 10, True)]
loft(bm, slot, lambda i: SLOT["Floor"], offset=(-1.0, 0.0))
circle = lambda radius, z: stadium(radius, z, 0.0, 24)
ring = [circle(0.215, -DEPTH), circle(0.198, proud), circle(0.147, proud), circle(0.13, -DEPTH)]
loft(bm, ring, lambda i: SLOT["Floor"], offset=(1.0, 0.0))
base = finish("Base", bm, [MATS["Sheet"], MATS["Wall"], MATS["Floor"]])

# ---- Knob: a gently domed puck with a knurled face set slightly in ------------------------------
bm = bmesh.new()
face_z = RISE - 0.016
profile = [
    (KNOB, -DEPTH), (KNOB, -0.03), (KNOB - 0.006, 0.006), (KNOB - 0.022, 0.026), (KNOB - 0.05, 0.039),
    (KNOB - 0.09, 0.046), (FACE + 0.02, RISE), (FACE + 0.004, RISE - 0.002), (FACE, face_z), (0.0, face_z),
]
face_from = len(profile) - 2
loft(bm, [circle(r, z) for r, z in profile], lambda i: 1 if i >= face_from else 0)
# The knurl: rows of small pyramids on a lattice turned 45°, kept inside the face.
reach = int(FACE / CELL) + 2
for i in range(-reach, reach + 1):
    for j in range(-reach, reach + 1):
        cx, cy = (i - j) * CELL * 0.7071, (i + j) * CELL * 0.7071
        if math.hypot(cx, cy) + CELL * 0.72 > FACE:
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


# ---- Bake: the light that falls on each part, with the knob on and with it off ------------------
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
for label, x, floor in (("on", STRAIGHT, "FloorOn"), ("off", -STRAIGHT, "FloorOff")):
    knob.location.x = x
    set_colour(MATS["Floor"], COLOURS[floor])  # so the light bouncing off the floor carries its colour
    bpy.context.view_layer.update()
    for obj in (base, knob):
        images[(obj.name, label)] = bake(obj, label)

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
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "switch.blend"))
bpy.ops.object.select_all(action="DESELECT")
base.select_set(True)
knob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "switch.glb"), use_selection=True, export_extras=True, export_yup=True, export_apply=True)
print("switch built")
