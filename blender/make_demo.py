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
scene.frame_start, scene.frame_end = 1, 120


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


floor = add(bpy.ops.mesh.primitive_plane_add, "Floor", material("Floor", (0.08, 0.09, 0.12), roughness=0.8), size=14)

cube = add(bpy.ops.mesh.primitive_cube_add, "Cube", material("Coral", (0.95, 0.35, 0.3), roughness=0.4), size=1.2, location=(-2.4, 0, 0.6))
cube["hover"] = True
cube["label"] = "Cube: hover tag set in Blender"

orb = add(bpy.ops.mesh.primitive_uv_sphere_add, "Orb", material("Blue", (0.25, 0.5, 1.0)), radius=0.8, location=(0, 0, 0.8), segments=128, ring_count=64)
orb["hover"] = True
orb["shader"] = "pulse"
orb["label"] = "Orb: noise displacement + fragment shader"

ring = add(bpy.ops.mesh.primitive_torus_add, "Ring", material("Gold", (1.0, 0.75, 0.3), metallic=1.0, roughness=0.25), major_radius=0.75, minor_radius=0.22, location=(2.4, 0, 1.1))
ring["hover"] = True
ring["label"] = "Ring: looping Blender animation"
ring["link"] = "https://threejs.org"

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

# --- Scroll action: the camera path. Any action not named "Loop…" follows the scrollbar.
prefs.keyframe_new_interpolation_type = "BEZIER"
bpy.ops.object.camera_add()
camera = bpy.context.active_object
camera.name = "Camera"
camera.data.lens = 35
scene.camera = camera
shots = [  # frame, camera position, point it looks at
    (1, (0, -9, 3.2), (0, 0, 0.8)),
    (40, (-4.2, -3.2, 1.6), (-2.4, 0, 0.6)),
    (80, (0.6, -3.4, 1.4), (0, 0, 0.8)),
    (120, (4.6, -3.0, 2.4), (2.4, 0, 1.1)),
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
