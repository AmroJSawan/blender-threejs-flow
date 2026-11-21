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
scene.frame_start, scene.frame_end = 1, 200


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


floor = add(bpy.ops.mesh.primitive_plane_add, "Floor", material("Floor", (0.08, 0.09, 0.12), roughness=0.8), size=28, location=(3.6, 0, 0))

cube = add(bpy.ops.mesh.primitive_cube_add, "Cube", material("Coral", (0.95, 0.35, 0.3), roughness=0.4), size=1.2, location=(-2.4, 0, 0.6))
cube["hover"] = True
cube["label"] = "Cube: hover tag set in Blender"

orb = add(bpy.ops.mesh.primitive_uv_sphere_add, "Orb", material("Blue", (0.25, 0.5, 1.0)), radius=0.8, location=(0, 0, 0.8), segments=128, ring_count=64)
orb["hover"] = True
orb["shader"] = "pulse"
orb["label"] = "Orb: wave displacement + fragment shader"

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
    (1, (2.6, -15.5, 4.2), (2.6, 0, 0.9)),
    (40, (-4.2, -3.2, 1.6), (-2.4, 0, 0.6)),
    (80, (0.6, -3.4, 1.4), (0, 0, 0.8)),
    (120, (3.6, -3.0, 2.2), (2.4, 0, 1.1)),
    (160, (5.3, -3.3, 1.65), (4.8, 0, 1.55)),
    (200, (7.6, -6.2, 2.9), (7.6, 0, 1.05)),
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
