"""
Air in the cabin, as a real 3D effect: the car's interior modelled simply, and air let out of each vent as simulated
smoke (Blender's fluid solver), so it behaves like air. It leaves the vent as a jet, slows, spreads, rolls where it
meets the seats and still air, and thins out. Nothing in it is a drawn line.

Run:  npm run air               the cabin picture and the air loop, at full quality
      npm run air -- --test     a quick low-quality pass, to check the set-up (two frames)

Writes public/air/cabin.webp   the cabin from straight above, front of the car up, softly lit
       public/air/<set>.mp4    one looping film of air on black for each set of vents (face, feet, screen, back),
                               framed exactly as the cabin picture, to be laid over it
Lengths are in metres times 0.62: the cabin is 1.24 wide and 1.9 long here, the same units the page uses.
"""
import math
import shutil
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "air"
WORK = ROOT / "blender" / "frames" / "air"
TEST = "--test" in sys.argv

AIR = {
    "picture": 420 if TEST else 1400,   # the cabin picture, px square
    "film": 300 if TEST else 720,       # the air films, px square
    "cells": 48 if TEST else 144,       # the solver's grid along the cabin's length
    "settle": 12 if TEST else 70,       # frames the air is given to reach its shape before filming
    "frames": 2 if TEST else 96,        # frames filmed (24 a second)
    "blend": 0 if TEST else 20,         # frames at the end melted into the start, so the film loops
    "samples": 8 if TEST else 40,
    "speed": 3.6,                       # how fast air leaves a dashboard vent
    "thins": 46,                        # frames for air to thin out to nothing: this sets how far it reaches
    "swirl": 0.22,                      # how readily the air rolls up into eddies
    "density": 9.0,                     # how thick the air is drawn
    "cool": (0.34, 0.66, 1.0),          # the driver's side
    "warm": (1.0, 0.56, 0.3),           # the passenger's side
}

# Each vent: which set it belongs to, where it is (x across, y along, z up), which way it blows, its width across, and how hard (1 = AIR["speed"]).
VENTS = [
    ("face", (-0.5, 0.4, 0.46), (0.16, -1.0, 0.05), 0.07, 1.0),
    ("face", (-0.11, 0.4, 0.46), (-0.4, -1.0, 0.05), 0.07, 1.0),
    ("face", (0.11, 0.4, 0.46), (0.4, -1.0, 0.05), 0.07, 1.0),
    ("face", (0.5, 0.4, 0.46), (-0.16, -1.0, 0.05), 0.07, 1.0),
    ("screen", (0.0, 0.56, 0.6), (0.0, 0.25, 1.0), 0.8, 0.55),
    ("feet", (-0.31, 0.46, 0.12), (0.0, -1.0, -0.05), 0.2, 0.6),
    ("feet", (0.31, 0.46, 0.12), (0.0, -1.0, -0.05), 0.2, 0.6),
    ("back", (-0.05, -0.32, 0.3), (-0.4, -1.0, 0.25), 0.05, 0.75),
    ("back", (0.05, -0.32, 0.3), (0.4, -1.0, 0.25), 0.05, 0.75),
]
SETS = ["face"] if TEST else ["face", "feet", "screen", "back"]


def material(name, colour, rough=0.6, metal=0.0, glow=None, strength=0.0):
    made = bpy.data.materials.new(name)
    made.use_nodes = True
    shader = next(node for node in made.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = (*colour, 1.0)
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Metallic"].default_value = metal
    if glow:
        shader.inputs["Emission Color"].default_value = (*glow, 1.0)
        shader.inputs["Emission Strength"].default_value = strength
    return made


def block(name, size, at, mat, round_=0.03, turn=0.0):
    """A soft-cornered block: seats, the dashboard, the console."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    made = bpy.data.objects.new(name, mesh)
    made.location = at
    made.rotation_euler = (turn, 0.0, 0.0)
    bpy.context.scene.collection.objects.link(made)
    mesh.materials.append(mat)
    bevel = made.modifiers.new("Soft", "BEVEL")
    bevel.width = round_
    bevel.segments = 5
    for face in mesh.polygons:
        face.use_smooth = True
    return made


def lamp(name, at, size, power, toward=(0.0, 0.0, 0.0)):
    light = bpy.data.lights.new(name, "AREA")
    light.shape = "RECTANGLE"
    light.size, light.size_y = size
    light.energy = power
    made = bpy.data.objects.new(name, light)
    made.location = at
    made.rotation_euler = (Vector(toward) - Vector(at)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(made)
    return made


def stage():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = AIR["samples"]
    scene.cycles.use_denoising = True
    scene.cycles.volume_bounces = 1
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for device in prefs.devices:
            device.use = True
        scene.cycles.device = "GPU"
    except Exception as problem:  # noqa: BLE001
        print("rendering on the processor:", problem)
    scene.view_settings.view_transform = "AgX"
    scene.render.fps = 24
    world = bpy.data.worlds.new("Room")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.0, 0.0, 0.0, 1.0)
    scene.world = world
    # Seen from straight above, two units across: exactly the square the page lays it in.
    eye = bpy.data.objects.new("Eye", bpy.data.cameras.new("Eye"))
    eye.data.type = "ORTHO"
    eye.data.ortho_scale = 2.0
    eye.location = (0.0, 0.0, 6.0)
    scene.collection.objects.link(eye)
    scene.camera = eye
    return scene


def floor(mat):
    """The cabin's floor: a rectangle with well-rounded corners, as a car's body is from above."""
    bm = bmesh.new()
    half, corner = (0.62, 0.95), 0.3
    edge = []
    for sx, sy, start in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        for step in range(17):
            angle = math.radians(start + 90 * step / 16)
            edge.append(bm.verts.new((sx * (half[0] - corner) + corner * math.cos(angle), sy * (half[1] - corner) + corner * math.sin(angle), 0.02)))
    bm.faces.new(edge)
    mesh = bpy.data.meshes.new("Floor")
    bm.to_mesh(mesh)
    bm.free()
    made = bpy.data.objects.new("Floor", mesh)
    bpy.context.scene.collection.objects.link(made)
    mesh.materials.append(mat)
    made.modifiers.new("Thick", "SOLIDIFY").thickness = 0.04
    return made


def cabin():
    """The interior, simply: floor, dashboard, wheel, two seats, the console between them, the bench behind."""
    trim = material("Trim", (0.035, 0.038, 0.042), rough=0.7)
    seat = material("Seat", (0.06, 0.064, 0.07), rough=0.85)
    bright = material("Vent", (0.8, 0.8, 0.8), rough=0.4, glow=(1.0, 1.0, 1.0), strength=1.2)
    parts = [
        floor(trim),
        block("Dashboard", (1.18, 0.2, 0.3), (0.0, 0.54, 0.4), trim, round_=0.07),  # a shelf: the footwells under it are open
        block("Console", (0.17, 0.62, 0.3), (0.0, 0.04, 0.16), trim, round_=0.05),
        block("Bench", (1.0, 0.34, 0.22), (0.0, -0.58, 0.14), seat, round_=0.07),
        block("Bench back", (1.0, 0.12, 0.5), (0.0, -0.8, 0.32), seat, round_=0.05, turn=math.radians(12)),
    ]
    for x in (-0.31, 0.31):
        parts.append(block("Cushion", (0.34, 0.34, 0.2), (x, 0.06, 0.13), seat, round_=0.07))
        parts.append(block("Back", (0.34, 0.11, 0.52), (x, -0.16, 0.36), seat, round_=0.05, turn=math.radians(12)))
        parts.append(block("Head", (0.2, 0.07, 0.14), (x, -0.215, 0.7), seat, round_=0.03, turn=math.radians(12)))
    bm = bmesh.new()
    ring = []
    for a in range(48):
        angle = math.tau * a / 48
        ring.append([bm.verts.new(((0.105 + 0.016 * math.cos(math.tau * b / 12)) * math.cos(angle), 0.016 * math.sin(math.tau * b / 12), (0.105 + 0.016 * math.cos(math.tau * b / 12)) * math.sin(angle))) for b in range(12)])
    for a in range(48):
        for b in range(12):
            bm.faces.new((ring[a][b], ring[(a + 1) % 48][b], ring[(a + 1) % 48][(b + 1) % 12], ring[a][(b + 1) % 12]))
    mesh = bpy.data.meshes.new("Wheel")
    bm.to_mesh(mesh)
    bm.free()
    wheel = bpy.data.objects.new("Wheel", mesh)
    wheel.location = (-0.31, 0.38, 0.42)
    wheel.rotation_euler = (math.radians(-22), 0.0, 0.0)
    mesh.materials.append(trim)
    bpy.context.scene.collection.objects.link(wheel)
    parts.append(wheel)
    marks = []
    for _, at, _, wide, _ in VENTS:
        marks.append(block("Vent", (wide, 0.02, 0.022), (at[0], at[1], at[2] + 0.04), bright, round_=0.008))
    return parts, marks


def air_material():
    """Air: it only scatters the light that falls on it, cool on the driver's side and warm on the passenger's. It gives off none."""
    made = bpy.data.materials.new("Air")
    made.use_nodes = True
    tree = made.node_tree
    tree.nodes.clear()
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    volume = tree.nodes.new("ShaderNodeVolumePrincipled")
    volume.inputs["Density"].default_value = AIR["density"]
    where = tree.nodes.new("ShaderNodeNewGeometry")
    split = tree.nodes.new("ShaderNodeSeparateXYZ")
    side = tree.nodes.new("ShaderNodeMapRange")
    side.inputs["From Min"].default_value = -0.1
    side.inputs["From Max"].default_value = 0.1
    blend = tree.nodes.new("ShaderNodeMix")
    blend.data_type = "RGBA"
    blend.inputs["A"].default_value = (*AIR["cool"], 1.0)
    blend.inputs["B"].default_value = (*AIR["warm"], 1.0)
    tree.links.new(where.outputs["Position"], split.inputs[0])
    tree.links.new(split.outputs["X"], side.inputs["Value"])
    tree.links.new(side.outputs["Result"], blend.inputs["Factor"])
    tree.links.new(blend.outputs["Result"], volume.inputs["Color"])
    tree.links.new(volume.outputs[0], out.inputs["Volume"])
    return made


def simulate(scene, parts, which):
    """Air from one set of vents, solved, and left ready to film."""
    for each in parts:
        if "Fluid" not in each.modifiers:
            each.modifiers.new("Fluid", "FLUID").fluid_type = "EFFECTOR"
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    mesh = bpy.data.meshes.new("Air")
    bm.to_mesh(mesh)
    bm.free()
    box = bpy.data.objects.new("Air", mesh)
    box.location = (0.0, 0.0, 0.46)
    box.scale = (1.36, 2.02, 0.94)
    scene.collection.objects.link(box)
    mesh.materials.append(air_material())
    domain = box.modifiers.new("Fluid", "FLUID")
    domain.fluid_type = "DOMAIN"
    settings = domain.domain_settings
    settings.domain_type = "GAS"
    settings.resolution_max = AIR["cells"]
    settings.alpha = 0.0  # the air neither rises nor sinks by itself: it goes where it is blown
    settings.beta = 0.0
    settings.vorticity = AIR["swirl"]
    settings.use_dissolve_smoke = True
    settings.dissolve_speed = AIR["thins"]
    settings.use_dissolve_smoke_log = False
    settings.use_adaptive_domain = False
    settings.cache_type = "ALL"
    last = AIR["settle"] + AIR["frames"]
    settings.cache_frame_start, settings.cache_frame_end = 1, last
    cache = ROOT / "blender" / "cache_air" / which
    shutil.rmtree(cache, ignore_errors=True)
    settings.cache_directory = str(cache)
    for side in ("use_collision_border_front", "use_collision_border_back", "use_collision_border_left", "use_collision_border_right", "use_collision_border_top", "use_collision_border_bottom"):
        setattr(settings, side, False)
    mouths = []
    for group, at, way, wide, hard in VENTS:
        if group != which:
            continue
        mouth = block("Mouth", (wide, 0.03, 0.03), at, material("Mouth", (0.0, 0.0, 0.0)), round_=0.0)
        mouth.modifiers.clear()
        flow = mouth.modifiers.new("Fluid", "FLUID")
        flow.fluid_type = "FLOW"
        flow.flow_settings.flow_type = "SMOKE"
        flow.flow_settings.flow_behavior = "INFLOW"
        flow.flow_settings.density = 1.0
        flow.flow_settings.surface_distance = 0.5
        flow.flow_settings.use_initial_velocity = True
        flow.flow_settings.velocity_coord = tuple(Vector(way).normalized() * AIR["speed"] * hard)
        mouth.hide_render = True
        mouths.append(mouth)
    scene.frame_start, scene.frame_end = 1, last
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = box
    box.select_set(True)
    bpy.ops.fluid.bake_all()
    return box, mouths


def main():
    scene = stage()
    parts, marks = cabin()
    OUT.mkdir(parents=True, exist_ok=True)

    # ---- The cabin by itself: soft light from above and a little from the front, nothing bright ----
    lights = [lamp("Above", (0.0, 0.3, 3.0), (2.4, 2.8), 90.0), lamp("Front", (0.0, 2.6, 1.6), (2.0, 0.5), 30.0, toward=(0.0, 0.2, 0.3))]
    scene.render.resolution_x = scene.render.resolution_y = AIR["picture"]
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 92
    scene.render.filepath = str(OUT / "cabin.webp")
    bpy.ops.render.render(write_still=True)
    print("wrote", scene.render.filepath)

    # ---- The air by itself, on black: the cabin is still there to be blown against and to hide what is under it, but shows as black ----
    for each in parts + marks:
        each.is_holdout = True
    for light in lights:
        light.data.energy *= 9.0  # air scatters little; this is the same soft light, only stronger, and it falls on nothing else
    scene.render.resolution_x = scene.render.resolution_y = AIR["film"]
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"  # the hidden cabin shows as black, not as a hole
    for which in SETS:
        box, mouths = simulate(scene, parts, which)
        scene.frame_start, scene.frame_end = AIR["settle"] + 1, AIR["settle"] + AIR["frames"]
        shutil.rmtree(WORK / which, ignore_errors=True)
        scene.render.filepath = str(WORK / which / "f")
        bpy.ops.render.render(animation=True)
        print("frames for", which)
        for gone in [box, *mouths]:
            bpy.data.objects.remove(gone)


main()
print("frames ready in", WORK, "(blender/finish_air.py turns them into looping films)")
