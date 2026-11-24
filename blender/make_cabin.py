"""
The cabin for the air page: an open, high-fidelity car model, opened up and rendered from straight above, front of the car up.

The car is Khronos's "Car Concept" sample (CC-BY 4.0, made from a public-domain design by Unity Fan; its Khronos logos are
not covered by that licence and are left out of the picture). It is not kept in this repository: download CarConcept.glb from
https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept/glTF-Binary into blender/models/car-concept/.
It seats its driver in the middle, with a seat each side just behind and one more at the back.

It writes, all framed alike (the square the page lays them in):
  public/air/cabin.webp          the car with its roof and glass taken off, under soft studio light
  public/air/light-<set>.webp    for each set of vents (face, feet, screen, back): only the light its air throws on the cabin,
                                 cool on the left and warm on the right, on black. The page adds it when the set is on,
                                 so the seats and trim pick up the colour of the air that reaches them.
  src/air/vents.json             where each vent is in the picture and which way it blows, for the page to draw its air from

Run:  npm run cabin            (Blender, no window; a few minutes)
      npm run cabin -- --test  small and quick, to check the set-up

The model is in metres: x across, y toward the back (the bonnet is at −2.4), z up.
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "air"
TEST = "--test" in sys.argv

MODEL = ROOT / "blender" / "models" / "car-concept" / "CarConcept.glb"
LOOK = {
    "picture": 500 if TEST else 2000,
    "light": 300 if TEST else 1200,
    "samples": 16 if TEST else 220,
    "light_samples": 16 if TEST else 96,
    "across": 3.3,        # metres the picture is across
    "middle": -0.2,       # which y of the car is at the picture's middle
    "paint": "Graphite",  # the model comes in Carmine, Graphite and Pearl
    "trim": 0.28,         # how much of the trim's own colour is kept (0 = grey … 1 = as modelled)
    "cool": (0.25, 0.68, 1.0),
    "warm": (1.0, 0.56, 0.24),
    "wash": 26.0,         # how strongly a vent's air lights what it reaches
}
# Taken off so the cabin can be seen from above: the roof, the glass, and what holds them up.
OFF = ["BodyRoofPanel", "BodyPillars", "BodyWindshield", "BodyWindshieldGasket", "BodyRearwindow", "BodyWindowsRearSides", "BodyDoorLWindow", "BodyDoorRWindow",
       "BodyDoorLWindowGasket", "BodyDoorRWindowGasket", "InteriorCage", "InteriorRearHatch", "InteriorPillar", "BodyRearPanelsColor1", "License Plate", "InteriorSteeringEmblem"]

# The vents: set, where the air leaves (x, y, z in the car), which way it goes, how wide its mouth is (m), how far its air reaches (m).
VENTS = [
    ("face", (-0.3, -1.27, 0.74), (0.22, 1.0, 0.0), 0.12, 1.0),
    ("face", (0.3, -1.27, 0.74), (-0.22, 1.0, 0.0), 0.12, 1.0),
    ("face", (-0.66, -1.2, 0.74), (0.12, 1.0, 0.0), 0.12, 1.25),
    ("face", (0.66, -1.2, 0.74), (-0.12, 1.0, 0.0), 0.12, 1.25),
    ("screen", (0.0, -1.58, 0.86), (0.0, -1.0, 0.3), 1.2, 0.3),
    ("feet", (0.0, -1.42, 0.3), (0.0, 1.0, -0.3), 0.3, 0.6),
    ("feet", (-0.5, -0.95, 0.25), (0.0, 1.0, -0.2), 0.25, 0.55),
    ("feet", (0.5, -0.95, 0.25), (0.0, 1.0, -0.2), 0.25, 0.55),
    ("back", (-0.14, 0.42, 0.5), (0.1, 1.0, 0.0), 0.08, 0.8),
    ("back", (0.14, 0.42, 0.5), (-0.1, 1.0, 0.0), 0.08, 0.8),
]


def page(point):
    """Where a place in the car is in the picture: the picture is two units across, its middle at 0,0, the car's front up."""
    return [round(-point[0] / (LOOK["across"] / 2), 4), round(-(point[1] - LOOK["middle"]) / (LOOK["across"] / 2), 4)]


def cabin():
    """The car, in the chosen paint, with its roof and glass off."""
    bpy.ops.import_scene.gltf(filepath=str(MODEL))
    for name in OFF:
        if name in bpy.data.objects:
            bpy.data.objects[name].hide_render = True
    for thing in bpy.data.objects:
        if thing.type != "MESH":
            continue
        for slot in thing.material_slots:
            if slot.material and slot.material.name.endswith("Carmine"):
                other = bpy.data.materials.get(slot.material.name.replace("Carmine", LOOK["paint"]))
                if other:
                    slot.material = other
    # The model's coloured trim is strong; the air brings its own colour, so the trim is quietened to let that read.
    for made in bpy.data.materials:
        if not made.name.startswith("Interior 3") or not made.use_nodes:
            continue
        shader = next((node for node in made.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
        if not shader:
            continue
        colour = shader.inputs["Base Color"]
        if colour.is_linked:
            calm = made.node_tree.nodes.new("ShaderNodeHueSaturation")
            calm.inputs["Saturation"].default_value = LOOK["trim"]
            source = colour.links[0].from_socket
            made.node_tree.links.new(source, calm.inputs["Color"])
            made.node_tree.links.new(calm.outputs["Color"], colour)
        else:
            r, g, b, _ = colour.default_value
            grey = (r + g + b) / 3
            colour.default_value = (*(grey + (c - grey) * LOOK["trim"] for c in (r, g, b)), 1.0)
    # A lit slot at each vent that can be seen from above, so its place is marked on the picture.
    slot = bpy.data.materials.new("Slot")
    slot.use_nodes = True
    shader = next(node for node in slot.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Emission Color"].default_value = (0.85, 0.92, 1.0, 1.0)
    shader.inputs["Emission Strength"].default_value = 2.2
    for group, at, _, wide, _ in VENTS:
        if group == "feet":
            continue
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(wide, 0.02, 0.012), verts=bm.verts)
        mesh = bpy.data.meshes.new("Vent")
        bm.to_mesh(mesh)
        bm.free()
        mark = bpy.data.objects.new("Vent", mesh)
        mark.location = (at[0], at[1], at[2] + 0.14)
        bpy.context.scene.collection.objects.link(mark)
        mesh.materials.append(slot)


def lamp(name, at, size, power, toward=(0.0, 0.0, 0.0), colour=(1.0, 1.0, 1.0), spread=180.0):
    light = bpy.data.lights.new(name, "AREA")
    light.shape = "RECTANGLE"
    light.size, light.size_y = size
    light.energy = power
    light.color = colour
    light.spread = math.radians(spread)
    made = bpy.data.objects.new(name, light)
    made.location = at
    made.rotation_euler = (Vector(toward) - Vector(at)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(made)
    return made


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.use_denoising = True
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
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("Room")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.0, 0.0, 0.0, 1.0)
    scene.world = world
    eye = bpy.data.objects.new("Eye", bpy.data.cameras.new("Eye"))
    eye.data.type = "ORTHO"
    eye.data.ortho_scale = LOOK["across"]
    eye.location = (0.0, LOOK["middle"], 10.0)
    eye.rotation_euler = (0.0, 0.0, math.pi)  # the car's front is toward −y: turned half round, it is up in the picture
    scene.collection.objects.link(eye)
    scene.camera = eye
    cabin()
    OUT.mkdir(parents=True, exist_ok=True)
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 92
    scene.render.image_settings.color_mode = "RGB"

    # ---- The cabin: a wide soft light overhead, as through a glass roof, and a long low one each side to draw the edges ----
    studio = [
        lamp("Roof", (0.0, -0.2, 5.0), (3.6, 5.0), 620.0),
        lamp("Left", (-4.0, -0.2, 2.2), (0.6, 5.0), 240.0, toward=(0.0, -0.2, 0.5)),
        lamp("Right", (4.0, -0.2, 2.2), (0.6, 5.0), 240.0, toward=(0.0, -0.2, 0.5)),
        lamp("Front", (0.0, -5.0, 3.0), (4.0, 0.6), 130.0, toward=(0.0, -0.8, 0.6)),
    ]
    scene.render.resolution_x = scene.render.resolution_y = LOOK["picture"]
    scene.cycles.samples = LOOK["samples"]
    scene.render.filepath = str(OUT / "cabin.webp")
    bpy.ops.render.render(write_still=True)
    print("wrote", scene.render.filepath)

    # ---- The air's own light: for each set of vents, a soft coloured lamp at each vent shining the way its air goes ----
    for light in studio:
        light.hide_render = True
    for material_ in bpy.data.materials:
        if material_.name == "Slot":  # the lit slots belong to the cabin picture, not to the air's light
            next(node for node in material_.node_tree.nodes if node.type == "BSDF_PRINCIPLED").inputs["Emission Strength"].default_value = 0.0
    scene.render.resolution_x = scene.render.resolution_y = LOOK["light"]
    scene.cycles.samples = LOOK["light_samples"]
    for which in ["face"] if TEST else ["face", "feet", "screen", "back"]:
        lamps = []
        for group, at, way, wide, _ in VENTS:
            if group != which:
                continue
            heading = Vector(way).normalized()
            start = Vector(at) + heading * 0.08 + Vector((0.0, 0.0, 0.18))
            if abs(at[0]) < 0.01:  # a vent on the car's middle line blows both sides: one lamp for each
                for side, tint in ((-1, LOOK["warm"]), (1, LOOK["cool"])):
                    lamps.append(lamp("Air", start + Vector((side * wide * 0.25, 0.0, 0.0)), (wide * 0.5, 0.08), LOOK["wash"] * 0.6, toward=start + heading - Vector((0.0, 0.0, 0.25)), colour=tint, spread=110.0))
            else:
                lamps.append(lamp("Air", start, (max(wide, 0.1), 0.1), LOOK["wash"], toward=start + heading - Vector((0.0, 0.0, 0.25)), colour=LOOK["cool"] if at[0] > 0 else LOOK["warm"], spread=95.0))
        scene.render.filepath = str(OUT / f"light-{which}.webp")
        bpy.ops.render.render(write_still=True)
        print("wrote", scene.render.filepath)
        for gone in lamps:
            bpy.data.objects.remove(gone)


    # ---- For the page: where each vent is in the picture, which way it blows, how far, how wide ----
    half = LOOK["across"] / 2
    listed = []
    for group, at, way, wide, reach in VENTS:
        listed.append({"group": group, "side": "driver" if at[0] >= -0.01 else "passenger", "at": page(at), "points": round(math.degrees(math.atan2(-way[1], -way[0])), 1), "reach": round(reach / half, 3), "mouth": round(wide / half, 3)})
    (ROOT / "src" / "air" / "vents.json").write_text(json.dumps(listed, indent=2) + "\n")
    print("wrote vents.json")


main()
