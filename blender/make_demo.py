"""Builds the demo scene, saves blender/demo.blend and exports public/scene.glb.

Run:  npm run demo
It is only a starting point: open demo.blend, change anything, press Export.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import threejs_bridge  # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 320


def material(name, color, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def add(op, name, mat, **kwargs):
    op(**kwargs)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    if hasattr(obj.data, "polygons"):
        for poly in obj.data.polygons:
            poly.use_smooth = name != "Cube"
    return obj


floor = add(bpy.ops.mesh.primitive_plane_add, "Floor", material("Floor", (0.08, 0.09, 0.12), roughness=0.8), size=48, location=(8, 0, 0))

cube = add(bpy.ops.mesh.primitive_cube_add, "Cube", material("Coral", (0.95, 0.35, 0.3), roughness=0.4), size=1.2, location=(-2.4, 0, 0.6))
cube["hover"] = True
cube["label"] = "Cube: hover tag set in Blender"

orb = add(bpy.ops.mesh.primitive_uv_sphere_add, "Orb", material("Blue", (0.1, 0.22, 1.0)), radius=0.8, location=(0, 0, 0.8), segments=128, ring_count=64)
orb["hover"] = True
orb["shader"] = "pulse"
orb["label"] = "Orb: wakes into ripples; hover or press"

ring = add(bpy.ops.mesh.primitive_torus_add, "Ring", material("Gold", (1.0, 0.75, 0.3), metallic=1.0, roughness=0.25), major_radius=0.75, minor_radius=0.22, location=(2.4, 0, 1.1))
ring["hover"] = True
ring["label"] = "Ring: looping Blender animation"
ring["link"] = "https://threejs.org"


def capsule(name, location, radius=0.55, half_length=0.6, tube=0.12, bulge=0.12):
    """A pill-shaped mirror with a glass rim: two meshes under one empty."""
    outline = []  # (x, z, outward x, outward z), standing upright and facing the camera (-Y)
    steps = 48
    for centre, start in ((half_length, 0.0), (-half_length, math.pi)):
        for i in range(steps + 1):
            a = start + math.pi * i / steps
            outline.append((radius * math.cos(a), centre + radius * math.sin(a), math.cos(a), math.sin(a)))
    count = len(outline)

    def mesh_object(suffix, verts, faces, mat):
        mesh = bpy.data.meshes.new(f"{name}_{suffix}")
        mesh.from_pydata(verts, [], faces)
        for poly in mesh.polygons:
            poly.use_smooth = True
        mesh.materials.append(mat)
        obj = bpy.data.objects.new(f"{name}_{suffix}", mesh)
        scene.collection.objects.link(obj)
        return obj

    # Mirror face: concentric rings so it can bulge slightly toward the camera.
    # The bulge is one smooth dome (not tied to the outline), so reflections flow without kinks.
    def dome(x, z):
        return -bulge * (1 - (x / radius) ** 2 * 0.5 - (z / (half_length + radius)) ** 2 * 0.5)

    rings = 32
    verts = [(0.0, dome(0, 0), 0.0)]
    for k in range(1, rings + 1):
        s = k / rings
        verts += [(x * s, dome(x * s, z * s), z * s) for x, z, _, _ in outline]
    faces = [(0, 1 + i, 1 + (i + 1) % count) for i in range(count)]
    for k in range(rings - 1):
        a, b = 1 + k * count, 1 + (k + 1) * count
        faces += [(a + i, b + i, b + (i + 1) % count, a + (i + 1) % count) for i in range(count)]
    mirror = mesh_object("Mirror", verts, faces, material(f"{name}_Mirror", (0.05, 0.35, 1.0), metallic=1.0, roughness=0.05))
    # Exact normals from the dome formula; averaged mesh normals leave faint creases in a mirror.
    slope_x, slope_z = bulge / radius ** 2, bulge / (half_length + radius) ** 2
    mirror.data.normals_split_custom_set_from_vertices([Vector((x * slope_x, -1.0, z * slope_z)).normalized() for x, _, z in verts])

    # Glass rim: a tube swept around the outline.
    sides = 20
    verts = []
    for x, z, nx, nz in outline:
        for j in range(sides):
            a = math.tau * j / sides
            verts.append((x + nx * math.cos(a) * tube, math.sin(a) * tube, z + nz * math.cos(a) * tube))
    faces = []
    for i in range(count):
        for j in range(sides):
            i2, j2 = (i + 1) % count, (j + 1) % sides
            faces.append((i * sides + j, i2 * sides + j, i2 * sides + j2, i * sides + j2))
    glass = mesh_object("Glass", verts, faces, material(f"{name}_Glass", (1.0, 0.05, 0.75), roughness=0.05))

    parent = bpy.data.objects.new(name, None)
    scene.collection.objects.link(parent)
    parent.location = location
    mirror.parent = glass.parent = parent
    mirror["shader"] = "mirror"
    glass["shader"] = "glass"
    return parent


pill = capsule("Capsule", (4.8, 0, 1.55))
pill["hover"] = True
pill["label"] = "Capsule: mirror + glass shaders"


def stack(name, location):
    """Flat 2D line-art style: stepped boxes as single strokes, with a floating lamp on top."""
    parent = bpy.data.objects.new(name, None)
    scene.collection.objects.link(parent)
    parent.location = location

    def child(obj, shader):
        obj.parent = parent
        obj["shader"] = shader
        return obj

    tops = [material(f"{name}_Pink", (1.0, 0.16, 0.42)), material(f"{name}_Blue", (0.36, 0.46, 1.0))]
    z = 0.0
    for index, (width, depth, height) in enumerate(((2.6, 1.5, 0.55), (1.8, 1.15, 0.42), (1.2, 0.85, 0.34), (0.8, 0.6, 0.28))):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z + height / 2))
        box = bpy.context.active_object
        box.name = f"{name}_Step{index + 1}"
        box.scale = (width, depth, height)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)  # real sizes for the outline shader
        box.data.materials.append(tops[index % 2])  # the colour of the step's top face
        child(box, "lineart")
        z += height

    # Lamp: a small pill made by revolving a profile.
    radius, half, around, rows = 0.16, 0.13, 32, 8
    verts, faces = [(0, 0, -half - radius)], []
    for sign in (-1, 1):
        for r in range(rows + 1):
            a = (math.pi / 2) * (r / rows) * 0.98 + 0.01
            a = a - math.pi / 2 if sign < 0 else a
            ring_r, ring_z = radius * math.cos(a), sign * half + radius * math.sin(a)
            verts += [(ring_r * math.cos(math.tau * i / around), ring_r * math.sin(math.tau * i / around), ring_z) for i in range(around)]
    verts.append((0, 0, half + radius))
    ring_count = 2 * (rows + 1)
    faces += [(0, 1 + (i + 1) % around, 1 + i) for i in range(around)]
    for r in range(ring_count - 1):
        a, b = 1 + r * around, 1 + (r + 1) * around
        faces += [(a + i, a + (i + 1) % around, b + (i + 1) % around, b + i) for i in range(around)]
    last, top = 1 + (ring_count - 1) * around, len(verts) - 1
    faces += [(last + i, last + (i + 1) % around, top) for i in range(around)]
    mesh = bpy.data.meshes.new(f"{name}_Lamp")
    mesh.from_pydata(verts, [], faces)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.materials.append(material(f"{name}_Lamp", (1.0, 1.0, 1.0)))
    lamp = bpy.data.objects.new(f"{name}_Lamp", mesh)
    scene.collection.objects.link(lamp)
    child(lamp, "lamp")
    lamp.location = (0, 0, z + 0.42)

    return parent, lamp


tower, lamp = stack("Stack", (7.6, 0, 0))
tower["hover"] = True
tower["label"] = "Stack: 2D line-art shader on 3D boxes"


def box(name, size, location, mat):
    """A box with its real size in the mesh (the outline shaders measure the mesh itself)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def slab(name, half, height, radius, mat, segments=24):
    """A flat rounded square with exact normals, for the "slab" shader."""
    outline = []  # (x, y, outward x, outward y), counter-clockwise seen from above
    inner = half - radius
    for corner, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        for i in range(segments + 1):
            a = (corner + i / segments) * math.pi / 2
            outline.append((sx * inner + radius * math.cos(a), sy * inner + radius * math.sin(a), math.cos(a), math.sin(a)))
    n, top, bottom = len(outline), height / 2, -height / 2
    # Caps and sides use separate vertices so the rim stays a crisp edge.
    verts = [(x, y, top) for x, y, _, _ in outline] + [(x, y, bottom) for x, y, _, _ in outline]
    verts += [(x, y, top) for x, y, _, _ in outline] + [(x, y, bottom) for x, y, _, _ in outline]
    normals = [Vector((0, 0, 1))] * n + [Vector((0, 0, -1))] * n + [Vector((nx, ny, 0)) for _, _, nx, ny in outline] * 2
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
    faces += [(2 * n + i, 3 * n + i, 3 * n + (i + 1) % n, 2 * n + (i + 1) % n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.normals_split_custom_set_from_vertices(normals)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj["shader"] = "slab"
    obj["radius"] = radius
    return obj


def sheet(name, parent, mat, size, cell):
    """Dark drawing paper with a faint grid, lying under a group."""
    bpy.ops.mesh.primitive_plane_add(size=size)
    grid = bpy.context.active_object
    grid.name = f"{name}_Sheet"
    grid.data.materials.append(mat)
    grid.parent = parent
    grid.location = (0, 0, -0.005)
    grid["shader"] = "grid"
    grid["cell"] = cell
    grid["shade"] = 0.92


def module(name, location):
    """Exploded technical drawing: a holographic slab between two ghost wireframes, tied by dashed guides."""
    parent = bpy.data.objects.new(name, None)
    scene.collection.objects.link(parent)
    parent.location = location
    parent.rotation_euler = (0, 0, math.radians(45))  # corner toward the camera, like an isometric drawing

    half, height, radius, gap = 0.7, 0.3, 0.16, 0.5
    line = material(f"{name}_Line", (1.0, 1.0, 1.0))
    levels = [0.16 + height / 2 + i * (height + gap) for i in range(3)]
    parts = []
    for index, z in enumerate(levels):
        part = slab(f"{name}_Level{index + 1}", half, height, radius, line)
        part.parent = parent
        part.location = (0, 0, z)
        if index != 1:
            part["shader"] = "wire"  # the levels above and below are see-through
        parts.append(part)

    # Dashed guides between the three levels.
    lift = 0.08  # how far the top level floats (see Loop_Lift below)
    low, high = levels[0] + height / 2, levels[2] - height / 2 - lift
    for index, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        post = box(f"{name}_Guide{index + 1}", (0.012, 0.012, high - low), (0, 0, 0), line)
        post.parent = parent
        post.location = (sx * half * 0.72, sy * half * 0.72, (low + high) / 2)
        post["shader"] = "dash"
    sheet(name, parent, line, size=5.6, cell=0.7)
    return parent, parts[2], lift


device, device_top, device_lift = module("Module", (10.8, 0, 0.03))
device["hover"] = True
device["label"] = "Module: ghost wireframes + holographic slab"


def blocks(name, location):
    """Blueprint drawing: outlined buildings on a grid, one highlighted with floor lines."""
    parent = bpy.data.objects.new(name, None)
    scene.collection.objects.link(parent)
    parent.location = location
    parent.rotation_euler = (0, 0, math.radians(45))

    white = material(f"{name}_White", (1.0, 1.0, 1.0))
    red = material(f"{name}_Red", (1.0, 0.27, 0.2))
    base = 0.1  # plinth height
    # name, size (x, y, z), centre (x, y), bottom z, material, extra number properties
    parts = [
        ("Plinth", (3.0, 1.7, base), (0, 0), 0.0, white, {}),
        ("West_Low", (0.95, 1.25, 0.6), (-0.9, 0), base, white, {}),
        ("West_High", (0.95, 1.25, 0.55), (-0.9, 0), base + 0.64, white, {}),
        ("Hall", (0.5, 0.55, 0.42), (-0.05, -0.4), base, white, {}),
        ("Wing", (0.5, 0.95, 0.72), (0.0, 0.3), base, white, {}),
        ("Tower_Low", (0.8, 1.2, 1.15), (0.95, 0.1), base, red, {"floors": 12.0}),
        ("Tower_High", (0.8, 1.2, 1.05), (0.95, 0.1), base + 1.2, red, {"floors": 11.0}),
    ]
    for part, size, (x, y), z, mat, numbers in parts:
        obj = box(f"{name}_{part}", size, (0, 0, 0), mat)
        obj.parent = parent
        obj.location = (x, y, z + size[2] / 2)
        obj["shader"] = "blueprint"
        for key, value in numbers.items():
            obj[key] = value

    sheet(name, parent, white, size=7, cell=0.4)
    return parent


district = blocks("Blocks", (14.4, 0, 0.03))
district["hover"] = True
district["label"] = "Blocks: blueprint shader with floor lines"

def halo(name, location, radius=0.85, segments=160, copies=140):
    """A tumbling ring of light with a fading tail: one thin strip, drawn `copies` times by the echo shader."""
    # The strip only carries "where along the ring" (u) and "which side of the line" (v);
    # echo.vert places and widens it on screen.
    verts, uvs = [], []
    for i in range(segments + 1):
        a = math.tau * i / segments
        for side in (0.0, 1.0):
            verts.append((radius * math.cos(a), radius * math.sin(a), (side - 0.5) * 0.002))
            uvs.append((i / segments, side))
    faces = [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(segments)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        layer.data[loop.index].uv = uvs[loop.vertex_index]
    mesh.materials.append(material(f"{name}_Light", (1.0, 1.0, 1.0)))
    ring_of_light = bpy.data.objects.new(f"{name}_Ring", mesh)
    scene.collection.objects.link(ring_of_light)
    ring_of_light["shader"] = "echo"
    ring_of_light["copies"] = float(copies)

    # A soft dark ball behind it, so the light shows up against the bright floor.
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius * 1.45, segments=48, ring_count=24)
    dark = bpy.context.active_object
    dark.name = f"{name}_Shade"
    for poly in dark.data.polygons:
        poly.use_smooth = True
    dark.data.materials.append(material(f"{name}_Shade", (0.0, 0.0, 0.0)))
    dark["shader"] = "shade"
    dark["shade"] = 0.92

    parent = bpy.data.objects.new(name, None)
    scene.collection.objects.link(parent)
    parent.location = location
    ring_of_light.parent = dark.parent = parent
    return parent


orbit = halo("Halo", (18.2, 0, 1.45))
orbit["label"] = "Halo: orbiting ring with a tail of light"

bpy.ops.object.light_add(type="SUN", location=(3, -3, 6), rotation=(math.radians(40), 0, math.radians(35)))
bpy.context.active_object.name = "Sun"
bpy.context.active_object.data.energy = 3.0

# --- Looping action: name starts with "Loop", so the web side plays it continuously.
prefs = bpy.context.preferences.edit
prefs.keyframe_new_interpolation_type = "LINEAR"
ring.rotation_euler = (math.radians(90), 0, 0)
ring.keyframe_insert("rotation_euler", frame=1)
ring.rotation_euler = (math.radians(90), 0, math.tau)
ring.keyframe_insert("rotation_euler", frame=97)
ring.animation_data.action.name = "Loop_Spin"

prefs.keyframe_new_interpolation_type = "BEZIER"
# The capsule sways so its reflections keep moving.
tilt = math.radians(-35)
for frame, turn in ((1, -22), (61, 22), (121, -22)):
    pill.rotation_euler = (0, tilt, math.radians(turn))
    pill.keyframe_insert("rotation_euler", frame=frame)
pill.animation_data.action.name = "Loop_Sway"

# The lamp floats up and down.
rest = lamp.location.z
for frame, lift in ((1, 0.0), (49, 0.12), (97, 0.0)):
    lamp.location.z = rest + lift
    lamp.keyframe_insert("location", frame=frame)
lamp.animation_data.action.name = "Loop_Float"

# The top level of the module floats.
rest = device_top.location.z
for frame, lift in ((1, 0.0), (61, -device_lift), (121, 0.0)):
    device_top.location.z = rest + lift
    device_top.keyframe_insert("location", frame=frame)
device_top.animation_data.action.name = "Loop_Lift"

# The module and the blocks turn slowly, starting from their isometric pose.
prefs.keyframe_new_interpolation_type = "LINEAR"
for obj, action in ((device, "Loop_Orbit"), (district, "Loop_Survey")):
    for frame, turn in ((1, 0.0), (385, math.tau)):
        obj.rotation_euler = (0, 0, math.radians(45) + turn)
        obj.keyframe_insert("rotation_euler", frame=frame)
    obj.animation_data.action.name = action

# The whole stack turns slowly: one full turn every 16 seconds.
prefs.keyframe_new_interpolation_type = "LINEAR"
tower.rotation_euler = (0, 0, 0)
tower.keyframe_insert("rotation_euler", frame=1)
tower.rotation_euler = (0, 0, math.tau)
tower.keyframe_insert("rotation_euler", frame=385)
tower.animation_data.action.name = "Loop_Turn"
prefs.keyframe_new_interpolation_type = "BEZIER"

# --- Scroll action: the camera path. Any action not named "Loop…" follows the scrollbar.
bpy.ops.object.camera_add()
camera = bpy.context.active_object
camera.name = "Camera"
camera.data.lens = 35
scene.camera = camera
shots = [  # frame, camera position, point it looks at
    (1, (7.9, -25.0, 6.2), (7.9, 0, 0.9)),
    (40, (-4.2, -3.2, 1.6), (-2.4, 0, 0.6)),
    (80, (0.6, -3.4, 1.4), (0, 0, 0.8)),
    (120, (3.6, -3.0, 2.2), (2.4, 0, 1.1)),
    (160, (5.3, -3.3, 1.65), (4.8, 0, 1.55)),
    (200, (7.6, -6.2, 2.9), (7.6, 0, 1.05)),
    (240, (10.8, -4.4, 3.7), (10.8, 0, 1.1)),
    (280, (14.4, -6.2, 5.2), (14.4, 0, 1.0)),
    (320, (18.2, -5.6, 2.3), (18.2, 0, 1.45)),
]
for frame, position, look_at in shots:
    camera.location = position
    direction = Vector(look_at) - Vector(position)
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler("XYZ", camera.rotation_euler)
    camera.keyframe_insert("location", frame=frame)
    camera.keyframe_insert("rotation_euler", frame=frame)
camera.animation_data.action.name = "CameraPath"

threejs_bridge.register()
scene.threejs.export_on_save = False  # export explicitly below
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "demo.blend"))
scene.threejs.export_on_save = True
bpy.ops.wm.save_mainfile()
print("[demo] exported", os.path.abspath(bpy.path.abspath(scene.threejs.filepath)))
