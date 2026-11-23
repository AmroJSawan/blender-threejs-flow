"""
The thumbwheel for the car screen's rollers (car.html): the control drivers already know from steering wheels and
dashboards, so its shape says how it moves before it is touched.

- A knurled barrel on an axle says "roll me up or down": one ridge per notch.
- The slot it sits in is wider than the barrel, the axle runs on past both ends with detent rings on it, and an arrow is
  cut into the plate at each side: "I also nudge left and right".

Run:  npm run wheel      (Blender, no window)
Writes public/car/wheel.glb. The page lights it itself, so nothing is baked here.

Seen from the front: x is across, z is up, and −y is toward the viewer (the page sees that as x, y and toward-the-camera z).
The parts are separate objects named Barrel, Caps, Axle, Housing and Marks, each with a material of the same name;
Barrel, Caps and Axle turn about the axle, which is where their origins are.
"""
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parent.parent

WHEEL = {
    "radius": 1.0,        # of the barrel
    "long": 2.7,          # the barrel's length
    "ridges": 36,         # one per notch: the page turns it 360/ridges degrees a notch
    "deep": 0.06,         # depth of the grooves between ridges
    "land": 0.6,          # share of each ridge that is its flat top
    "chamfer": 0.12,      # the barrel's ends are cut back this far
    "axle": 0.14,         # radius of the axle
    "slot": (4.9, 2.5),   # the opening the barrel sits in: wider than the barrel, so it visibly has room to shift
    "plate": (6.6, 3.9),  # the plate round the opening
    "sunk": 0.42,         # how far behind the plate's face the axle is
    "well": 1.5,          # how deep the opening is
    "rings": 3,           # detent rings on the axle, each side
}


def material(name):
    return bpy.data.materials.get(name) or bpy.data.materials.new(name)


def made(name, bm, smooth=False, at=(0.0, 0.0, 0.0)):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material(name))
    for face in mesh.polygons:
        face.use_smooth = smooth
    thing = bpy.data.objects.new(name, mesh)
    thing.location = at
    bpy.context.scene.collection.objects.link(thing)
    return thing


ALONG_X = Matrix.Rotation(math.radians(90), 4, "Y")  # a cylinder made standing up, laid along the axle


def barrel():
    """Ridges with flat tops and narrow grooves between them, running the barrel's length; ends cut back."""
    w = WHEEL
    step = math.tau / w["ridges"]
    outline = []  # (angle, radius) round the barrel
    for ridge in range(w["ridges"]):
        start = ridge * step
        low = w["radius"] - w["deep"]
        outline += [(start, w["radius"]), (start + step * w["land"], w["radius"]), (start + step * (w["land"] + 0.1), low), (start + step * 0.9, low)]
    half = w["long"] / 2
    stations = [(-half, 0.86), (-half + w["chamfer"], 1.0), (half - w["chamfer"], 1.0), (half, 0.86)]  # (x, scale of the outline)
    bm = bmesh.new()
    rings = [[bm.verts.new((x, math.sin(angle) * radius * scale, math.cos(angle) * radius * scale)) for angle, radius in outline] for x, scale in stations]
    count = len(outline)
    for near, far in zip(rings, rings[1:]):
        for index in range(count):
            bm.faces.new((near[index], near[(index + 1) % count], far[(index + 1) % count], far[index]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return made("Barrel", bm, at=(0.0, w["sunk"], 0.0))


def caps():
    """A bright ring let into each end of the barrel."""
    w = WHEEL
    bm = bmesh.new()
    for side in (-1, 1):
        place = Matrix.Translation((side * (w["long"] / 2 + 0.012), 0.0, 0.0)) @ ALONG_X
        bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=w["radius"] * 0.62, radius2=w["radius"] * 0.62, depth=0.03, matrix=place)
    return made("Caps", bm, smooth=False, at=(0.0, w["sunk"], 0.0))


def axle():
    """The rod the barrel runs on, carrying on to the ends of the slot, with detent rings on the bare part each side."""
    w = WHEEL
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=w["axle"], radius2=w["axle"], depth=w["slot"][0], matrix=ALONG_X)
    bare = (w["slot"][0] - w["long"]) / 2
    for side in (-1, 1):
        for ring in range(w["rings"]):
            x = side * (w["long"] / 2 + bare * (ring + 1.2) / (w["rings"] + 1.0))
            bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=w["axle"] * 1.55, radius2=w["axle"] * 1.55, depth=0.05, matrix=Matrix.Translation((x, 0.0, 0.0)) @ ALONG_X)
    return made("Axle", bm, smooth=True, at=(0.0, w["sunk"], 0.0))


def housing():
    """A plate with a deep opening: its face, the opening's four walls, and its floor."""
    w = WHEEL
    bm = bmesh.new()

    def corners(size, y):
        return [bm.verts.new((sx * size[0] / 2, y, sz * size[1] / 2)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]

    outer, lip, floor = corners(w["plate"], 0.0), corners(w["slot"], 0.0), corners(w["slot"], w["well"])
    for index in range(4):
        after = (index + 1) % 4
        bm.faces.new((outer[index], outer[after], lip[after], lip[index]))
        bm.faces.new((lip[index], lip[after], floor[after], floor[index]))
    bm.faces.new(floor)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    plate = made("Housing", bm)
    soften = plate.modifiers.new("Soften", "BEVEL")  # the opening's edge catches a little light
    soften.width = 0.05
    soften.segments = 3
    soften.limit_method = "ANGLE"
    return plate


def marks():
    """An arrow cut proud of the plate at each side of the opening, pointing outward: the barrel also goes this way."""
    w = WHEEL
    bm = bmesh.new()
    reach = (w["plate"][0] + w["slot"][0]) / 4  # half way between the opening and the plate's edge
    for side in (-1, 1):
        tip, back, tall = side * (reach + 0.14), side * (reach - 0.12), 0.26
        front = [bm.verts.new((x, -0.02, z)) for x, z in ((tip, 0.0), (back, tall), (back, -tall))]
        bm.faces.new(front if side < 0 else list(reversed(front)))
    return made("Marks", bm)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for part in (barrel, caps, axle, housing, marks):
        part().select_set(True)
    target = ROOT / "public" / "car" / "wheel.glb"
    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(target), use_selection=True, export_apply=True, export_yup=True, export_materials="EXPORT")
    print(f"wrote {target} ({target.stat().st_size // 1024} KB), {WHEEL['ridges']} ridges")


main()
