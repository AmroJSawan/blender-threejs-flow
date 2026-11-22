"""Builds the 3D switches: models each one, bakes its soft studio light, saves blender/switches/<name>.blend
and exports public/switch3d/<name>/ (switch.glb plus the baked light pictures). It also writes the list
of styles the page shows (src/switch3d/styles.json).

Run:  npm run switch              every style (about a minute each)
      npm run switch -- -- ball   only the named ones

The page (switch3d.html) shows a model unlit and multiplies each part's colour by the baked light.
A baked shadow cannot follow a moving knob, so a sliding knob's shadow is baked as its own picture,
which the page slides along the floor with the knob. The knob itself is baked on, halfway and off.

Each style is one function below, with its own numbers at the top. Sizes are in Blender units;
1 unit = 100 of the design pixels used by the drawn switches. The light is shared by every style.
"""

import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "switch3d")
BLENDS = os.path.join(HERE, "switches")
LIST = os.path.join(HERE, "..", "src", "switch3d", "styles.json")

# ---- The control panel shared by every style -----------------------------------------------------
LIGHT_FROM = (-0.26, 0.72, 0.64)  # direction to the light: above, slightly left (the same as the drawn switches)
LIGHT_SOFT = 30.0     # how wide the light is, degrees: wider = softer shadows
LIGHT_POWER = 3.2
ROOM = 0.2            # even light from the whole room, which fills the shadows
GLOW = 9.0            # how brightly a lit lamp shines on the parts round it
MAP = 1024            # size of each baked light picture, px
SAMPLES = 192
SHADOW_SPAN = (3.4, 2.2)  # size of the patch of floor a sliding knob's shadow picture covers
QUALITY = 90          # how closely the saved pictures keep the bake (WebP, 0-100): lower = smaller files
OPEN = 0.6            # brightness the open, unshaded sheet is stored at (leaves headroom for brighter parts)
SHEET = 0.4           # how far the modelled sheet reaches beyond a switch (the page continues it in the same colour)

scene = None
SPECS = {}  # material name -> (colour when on, colour when off or None, glows)


# ---- Materials -----------------------------------------------------------------------------------
def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def material(name, colour, off=None, glow=False, gloss=0.0):
    """A matt material. `off` = its colour while the switch is off (if that differs); `glow` = it is a
    lamp, lit when on; `gloss` = strength of the soft reflection of the light the page adds."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    principled(mat).inputs["Roughness"].default_value = 0.9
    SPECS[name] = (colour, off, glow)
    # Read by the page from the exported model.
    if off:
        mat["off"] = off
    if glow:
        mat["glow"] = 1.0
    if gloss:
        mat["gloss"] = gloss
    return mat


def set_state(k):
    """Colours and lamps for the switch k of the way on (0 off, 1 on)."""
    for mat in bpy.data.materials:
        if mat.name not in SPECS:
            continue
        on, off, glow = SPECS[mat.name]
        colour = [a + (b - a) * k for a, b in zip(off, on)] if off else on
        inputs = principled(mat).inputs
        inputs["Base Color"].default_value = (*colour, 1.0)
        if glow:
            (inputs.get("Emission Color") or inputs["Emission"]).default_value = (*on, 1.0)
            inputs["Emission Strength"].default_value = GLOW * k


# ---- Shapes ----------------------------------------------------------------------------------------
def rounded(hx, hy, r, z=0.0, corner=12, sides=0):
    """One outline of a rounded rectangle, half size (hx, hy), corner radius r. hy = r gives a pill,
    hx = hy = r a circle. `sides` adds points along the straight sides."""
    hx, hy = max(hx, 0.0), max(hy, 0.0)
    r = max(min(r, hx, hy), 0.0)
    arcs = []
    for (sx, sy), start in (((1, -1), -90.0), ((1, 1), 0.0), ((-1, 1), 90.0), ((-1, -1), 180.0)):
        arc = []
        for i in range(corner):
            a = math.radians(start + 90.0 * i / (corner - 1))
            arc.append((sx * (hx - r) + r * math.cos(a), sy * (hy - r) + r * math.sin(a)))
        arcs.append(arc)
    points = []
    for index, arc in enumerate(arcs):
        points += arc
        (ax, ay), (bx, by) = arc[-1], arcs[(index + 1) % 4][0]
        for step in range(1, sides + 1):
            t = step / (sides + 1)
            points.append((ax + (bx - ax) * t, ay + (by - ay) * t))
    return [(x, y, z) for x, y in points]


def loft(bm, rows, slot_of, offset=(0.0, 0.0), lift=None, smooth=True):
    """Joins a list of outlines (each a list of points) into a surface, row to row."""
    rings = []
    for index, row in enumerate(rows):
        ring = []
        for x, y, z in row:
            x, y = x + offset[0], y + offset[1]
            ring.append(bm.verts.new((x, y, z + (lift(x, y, index) if lift else 0.0))))
        rings.append(ring)
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


def shell(bm, half, r, steps, close=True, corner=12, sides=0, offset=(0.0, 0.0), lift=None, smooth=True):
    """A surface made of outlines of one rounded rectangle, each moved in from its edge.
    `steps` is a list of (how far in, height, material slot): the strip from one step to the next
    takes the first one's slot. `close` fills the middle at the last step's height."""
    rows, slots = [], []
    for inset, z, slot in steps:
        rows.append(rounded(half[0] - inset, half[1] - inset, r - inset, z, corner, sides))
        slots.append(slot)
    inset, z, slot = steps[-1]
    left = min(half) - inset
    if close and left > 1e-6:
        for share in (0.6, 0.25, 0.0):
            further = inset + left * (1.0 - share)
            rows.append(rounded(half[0] - further, half[1] - further, r - further, z, corner, sides))
            slots.append(slot)
    loft(bm, rows, lambda i: slots[i], offset, lift, smooth)


def puck(bm, profile, corner=24, offset=(0.0, 0.0)):
    """A round shape turned from a profile: a list of (radius, height, material slot), outside first."""
    widest = profile[0][0]
    shell(bm, (widest, widest), widest, [(widest - radius, z, slot) for radius, z, slot in profile], close=False, corner=corner, offset=offset)


def sheet_steps(slot=0, reach=SHEET):
    """The flat sheet round a switch, from its outer edge to just outside the switch's outline."""
    return [(-reach, 0.0, slot), (-0.4 * reach, 0.0, slot), (-0.02, 0.0, slot)]


def ease(t):
    return t * t * (3.0 - 2.0 * t)


def face_up(bm):
    """Turns every separate piece so its faces look up and outward."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    seen = set()
    for first in bm.faces:
        if first in seen:
            continue
        piece, queue = [], [first]
        seen.add(first)
        while queue:
            face = queue.pop()
            piece.append(face)
            for edge in face.edges:
                for other in edge.link_faces:
                    if other not in seen:
                        seen.add(other)
                        queue.append(other)
        if sum(face.normal.z * face.calc_area() for face in piece) < 0.0:
            bmesh.ops.reverse_faces(bm, faces=piece)


def finish(name, bm, materials, cutters=(), flat_slot=None, crease=None):
    """Turns the shape into an object. `cutters` are pressed into it; `crease` (degrees) keeps edges
    sharper than that crisp instead of shading across them."""
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    if cutters:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    else:
        face_up(bm)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for mat in materials:
        mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for cutter in cutters:
        cut = obj.modifiers.new("Press", "BOOLEAN")
        cut.operation = "DIFFERENCE"
        cut.object = cutter
        bpy.ops.object.modifier_apply(modifier=cut.name)
        bpy.data.objects.remove(cutter)
    if cutters:  # the underside was only there to make the shape solid for pressing
        under = bmesh.new()
        under.from_mesh(mesh)
        bmesh.ops.delete(under, geom=[f for f in under.faces if f.calc_center_median().z < -0.4], context="FACES")
        for f in under.faces:  # the floor and the marks' walls are flat: shade each face on its own, with crisp edges
            if f.material_index == flat_slot:
                f.smooth = False
        under.to_mesh(mesh)
        under.free()
    if crease:
        split = obj.modifiers.new("Crease", "EDGE_SPLIT")
        split.split_angle = math.radians(crease)
        bpy.ops.object.modifier_apply(modifier=split.name)
    # Its own layout for the baked light picture.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(50), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)
    return obj


# ---- The styles ------------------------------------------------------------------------------------
# Each returns: the fixed part, the moving part, and how the page should treat them.
def knurled():
    STRAIGHT = 0.72   # half length of the straight part of the track (also how far the knob travels)
    TRACK = 0.78      # half height of the track floor
    LIP = 0.12        # width of the sloping wall between sheet and floor
    DEPTH = 0.22      # how deep the track is cut
    KNOB = 0.72       # knob radius
    FACE = 0.57       # radius of the knurled face
    RISE = 0.05       # how far the knob's top stands above the sheet
    CELL = 0.062      # size of one knurl pyramid
    TIP = 0.013       # its height
    PRESS = 0.045     # how deep the two marks are pressed into the floor
    base_mats = [material("Sheet", (0.83, 0.83, 0.84)), material("Wall", (0.86, 0.85, 0.84)), material("Floor", (0.96, 0.22, 0.004), off=(0.073, 0.073, 0.078))]
    knob_mats = [material("Knob", (0.9, 0.89, 0.88)), material("Grip", (0.78, 0.77, 0.76))]
    rim = TRACK + LIP
    half = (STRAIGHT + rim, rim)

    def solid(name, steps_of, offset):
        """A closed shape (used to press a mark into the floor), painted like the floor."""
        shape = bmesh.new()
        steps_of(shape, offset)
        bmesh.ops.remove_doubles(shape, verts=shape.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(shape, faces=shape.faces)
        mesh = bpy.data.meshes.new(name)
        shape.to_mesh(mesh)
        shape.free()
        for mat in base_mats:
            mesh.materials.append(mat)
        obj = bpy.data.objects.new(name, mesh)
        scene.collection.objects.link(obj)
        return obj

    low, high = -DEPTH - PRESS, -DEPTH + 0.06
    # A slot on the on side and a ring on the off side.
    slot = solid("Slot", lambda bm, at: shell(bm, (0.034, 0.164), 0.034, [(0.034, low, 2), (0.0, low, 2), (0.0, high, 2), (0.034, high, 2)], close=False, corner=6, offset=at, smooth=False), (-1.0, 0.0))
    ring = solid("Ring", lambda bm, at: shell(bm, (0.2, 0.2), 0.2, [(0.065, low, 2), (0.0, low, 2), (0.0, high, 2), (0.065, high, 2), (0.065, low, 2)], close=False, corner=8, offset=at, smooth=False), (1.0, 0.0))

    bm = bmesh.new()
    steps = [(rim, -1.0, 0), (-SHEET, -1.0, 0), (-SHEET, 0.0, 0), (-0.15, 0.0, 0), (-0.02, 0.0, 1)]  # with an underside, so the marks can be pressed in
    steps += [(LIP * t / 12, -DEPTH * ease(t / 12), 1) for t in range(12)]
    steps.append((LIP, -DEPTH, 2))
    shell(bm, half, rim, steps, corner=20)
    base = finish("Base", bm, base_mats, cutters=(slot, ring), flat_slot=2)

    # The knob: a gently domed puck with a knurled face set slightly in.
    bm = bmesh.new()
    face_z = RISE - 0.014
    puck(bm, [
        (KNOB, -DEPTH, 0), (KNOB, 0.0, 0), (KNOB - 0.004, 0.016, 0), (KNOB - 0.014, 0.03, 0), (KNOB - 0.032, 0.04, 0),  # side and rounded shoulder
        (KNOB - 0.07, 0.046, 0), (FACE + 0.03, RISE, 0), (FACE + 0.006, RISE - 0.001, 0),                              # the wide, nearly flat ring
        (FACE, face_z, 1), (FACE - 0.02, face_z - 0.004, 1), (0.0, face_z - 0.004, 1),                               # the face, set in (its middle sits just under the knurl)
    ])
    # The knurl: rows of small pyramids on a lattice turned 45°, kept inside the face.
    reach = int(FACE / CELL) + 2
    for i in range(-reach, reach + 1):
        for j in range(-reach, reach + 1):
            cx, cy = (i - j) * CELL * 0.7071, (i + j) * CELL * 0.7071
            if math.hypot(cx, cy) + CELL * 0.72 > FACE - 0.012:
                continue
            h = CELL * 0.5
            turned = [bm.verts.new((cx + (x - y) * 0.7071, cy + (x + y) * 0.7071, face_z)) for x, y in ((-h, -h), (h, -h), (h, h), (-h, h))]
            tip = bm.verts.new((cx, cy, face_z + TIP))
            for k in range(4):
                bm.faces.new((turned[k], turned[(k + 1) % 4], tip)).material_index = 1
    knob = finish("Knob", bm, knob_mats)
    return dict(title="Knurled", note="A knurled knob in an enamelled track. Two marks are pressed into the floor, which turns orange when on.",
                base=base, knob=knob, travel=STRAIGHT, rim=(*half, rim), pit=(*half, rim), floor=-DEPTH)


def soft():
    HALF = (1.6, 0.8)  # half size of the track's outline
    SLOPE = 0.2        # width of its sloping wall
    DEPTH = 0.1        # how deep the track is pressed in
    KNOB = 0.57        # knob radius
    SWELL = 0.085      # how far the knob's top stands above the sheet
    LAMP_AT = -0.98    # where the lamp is along the track (the knob covers it while off)
    LAMP = 0.055       # its radius
    clay = (0.8, 0.815, 0.85)
    base_mats = [material("Sheet", clay), material("Lamp", (0.04, 1.0, 0.2), off=(0.42, 0.43, 0.45), glow=True)]
    knob_mats = [material("Knob", clay)]

    bm = bmesh.new()
    shell(bm, HALF, HALF[1], sheet_steps() + [(SLOPE * t / 14, -DEPTH * ease(t / 14), 0) for t in range(15)], corner=20)
    # The lamp: a small domed lens standing on the floor.
    puck(bm, [(LAMP, -DEPTH, 1), (LAMP * 0.96, -DEPTH + 0.012, 1), (LAMP * 0.8, -DEPTH + 0.022, 1), (LAMP * 0.45, -DEPTH + 0.029, 1), (0.0, -DEPTH + 0.031, 1)], corner=8, offset=(LAMP_AT, 0.0))
    base = finish("Base", bm, base_mats, crease=50)

    bm = bmesh.new()
    crown = KNOB - 0.05  # where the shoulder ends and the swelling top begins
    profile = [(KNOB, -DEPTH, 0), (KNOB, -0.03, 0), (KNOB - 0.005, -0.006, 0), (KNOB - 0.02, 0.014, 0), (crown, 0.03, 0)]
    profile += [(crown * (1.0 - i / 12), SWELL - (SWELL - 0.03) * (1.0 - i / 12) ** 2, 0) for i in range(1, 13)]
    puck(bm, profile)
    knob = finish("Knob", bm, knob_mats)
    travel = HALF[0] - HALF[1]
    return dict(title="Soft", note="One material throughout: the track is pressed into the sheet and the knob swells out of it, told apart by light alone. A small lamp shows when it is on.",
                base=base, knob=knob, travel=travel, rim=(*HALF, HALF[1]), pit=(*HALF, HALF[1]), floor=-DEPTH)


def rocker():
    HALF = (1.28, 0.78)   # half size of the opening in the panel
    ROUND = 0.2           # its corner radius
    DEPTH = 0.2           # how deep the opening is
    PLATE = (1.2, 0.7)    # half size of the rocker plate
    PLATE_ROUND = 0.13
    STAND = 0.03          # how far the plate's middle stands above the panel
    HOLLOW = 0.035        # how much higher its two ends are than its middle
    TILT = 6.5            # how far it tips each way, degrees
    MARK_AT = 0.64        # distance of the two marks from the middle
    base_mats = [material("Sheet", (0.045, 0.047, 0.053)), material("Well", (0.01, 0.01, 0.012))]
    knob_mats = [material("Plate", (0.06, 0.062, 0.07)), material("Mark", (0.3, 0.31, 0.33)), material("Bar", (1.0, 0.25, 0.012), off=(0.3, 0.31, 0.33), glow=True)]

    bm = bmesh.new()
    shell(bm, HALF, ROUND, sheet_steps() + [(-0.012, 0.0, 0), (-0.004, -0.004, 1), (0.0, -0.014, 1), (0.004, -DEPTH, 1)])
    base = finish("Base", bm, base_mats, crease=45)

    # The plate: slightly hollow along its length, with rounded shoulders. It pivots on its middle.
    bm = bmesh.new()
    hollow = lambda x, y, row=1: HOLLOW * (x / PLATE[0]) ** 2 if row else 0.0
    shell(bm, PLATE, PLATE_ROUND, [(0.0, -0.17, 0), (0.0, STAND - 0.034, 0), (0.005, STAND - 0.014, 0), (0.016, STAND - 0.003, 0), (0.034, STAND, 0)], sides=18, lift=hollow)
    # The marks, inlaid a hair proud of the plate: a bar on the on side, a ring on the off side.
    proud = lambda x, y, row=0: STAND + 0.004 + hollow(x, y)
    shell(bm, (0.03, 0.18), 0.03, [(0.0, 0.0, 2)], corner=6, sides=4, offset=(MARK_AT, 0.0), lift=proud)
    shell(bm, (0.17, 0.17), 0.17, [(0.0, 0.0, 1), (0.06, 0.0, 1)], close=False, corner=14, offset=(-MARK_AT, 0.0), lift=proud)
    knob = finish("Knob", bm, knob_mats, crease=45)
    return dict(title="Rocker", note="A rocker plate in a dark panel. It pivots on its middle: the pressed side sinks into the panel, the other side lifts, and the bar on the pressed side lights.",
                ink="light", base=base, knob=knob, tilt=math.radians(TILT), rim=(*HALF, ROUND), floor=-DEPTH)


def slider():
    HALF = (1.52, 0.52)   # half size of the slot's outline
    ROUND = 0.28          # its corner radius: the block's own, plus the gap round the block and the wall
    LIP = 0.05            # width of its wall
    DEPTH = 0.16          # how deep the slot is
    BLOCK = (0.6, 0.39)   # half size of the sliding block
    BLOCK_ROUND = 0.15
    STAND = 0.045         # how far the block stands above the sheet
    TRAVEL = 0.79
    RIDGE = 0.11          # spacing of the three finger ridges
    LAMP_AT = -1.24
    base_mats = [material("Sheet", (0.82, 0.8, 0.77)), material("Well", (0.02, 0.02, 0.022)), material("Lamp", (0.05, 1.0, 0.16), off=(0.035, 0.04, 0.035), glow=True)]
    knob_mats = [material("Block", (0.9, 0.89, 0.87))]

    bm = bmesh.new()
    shell(bm, HALF, ROUND, sheet_steps() + [(-0.012, 0.0, 0), (-0.003, -0.004, 1), (0.004, -0.016, 1), (LIP * 0.6, -DEPTH + 0.03, 1), (LIP, -DEPTH, 1)])
    # The lamp: a short lit bar standing on the floor at the far end.
    shell(bm, (0.03, 0.16), 0.03, [(0.0, -DEPTH, 2), (0.003, -DEPTH + 0.012, 2), (0.012, -DEPTH + 0.021, 2), (0.03, -DEPTH + 0.024, 2)], close=False, corner=6, offset=(LAMP_AT, 0.0))
    base = finish("Base", bm, base_mats, crease=45)

    bm = bmesh.new()
    shell(bm, BLOCK, BLOCK_ROUND, [(0.0, -DEPTH, 0), (0.0, STAND - 0.05, 0), (0.006, STAND - 0.024, 0), (0.02, STAND - 0.008, 0), (0.046, STAND, 0)])
    for index in (-1, 0, 1):  # finger ridges across the top
        shell(bm, (0.03, 0.25), 0.03, [(0.0, STAND - 0.002, 0), (0.005, STAND + 0.011, 0), (0.015, STAND + 0.019, 0), (0.03, STAND + 0.022, 0)], close=False, corner=6, offset=(index * RIDGE, 0.0))
    knob = finish("Knob", bm, knob_mats, crease=45)
    return dict(title="Slider", note="A block with three finger ridges sliding in a dark slot. Pushed across, it uncovers a green lamp at the far end.",
                base=base, knob=knob, travel=TRAVEL, rim=(*HALF, ROUND), pit=(*HALF, ROUND), floor=-DEPTH)


def ball():
    HALF = (1.56, 0.7)  # half size of the groove's outline
    ROUND = 0.24        # how far in from the rim its wall keeps curving
    DEPTH = 0.2         # how deep the groove is
    BALL = 0.44         # radius of the ball
    TALL = 0.34         # how high it stands from the floor (lower than its radius: a full ball would throw a very long shadow)
    base_mats = [material("Sheet", (0.76, 0.81, 0.88)), material("Groove", (0.02, 0.155, 1.0), off=(0.47, 0.52, 0.62))]
    knob_mats = [material("Ball", (0.93, 0.93, 0.94), gloss=0.5)]

    bm = bmesh.new()
    steps = sheet_steps() + [(-0.008, 0.0, 0), (-0.002, -0.002, 1)]
    steps += [(ROUND * t / 16, -0.006 - (DEPTH - 0.006) * (1.0 - (1.0 - t / 16) ** 2), 1) for t in range(17)]  # steep at the rim, levelling out to the floor
    shell(bm, HALF, HALF[1], steps, corner=20)
    base = finish("Base", bm, base_mats, crease=40)

    bm = bmesh.new()
    puck(bm, [(BALL * math.cos(math.radians(a)), -DEPTH + TALL * math.sin(math.radians(a)), 0) for a in range(0, 91, 5)])
    knob = finish("Knob", bm, knob_mats)
    travel = HALF[0] - HALF[1]
    return dict(title="Ball", note="A glazed white ball rolling in a rounded groove. The groove fills with blue as the ball crosses to the on side.",
                base=base, knob=knob, travel=travel, rim=(*HALF, HALF[1]), pit=(*HALF, HALF[1]), floor=-DEPTH)


def dish():
    HALF = (1.56, 0.74)  # half size of the raised bar
    RAISE = 0.13         # how far the bar stands above the sheet
    EDGE = 0.13          # width of its rounded edge
    RIM = 0.25           # width of bar left round the channel cut into its top
    DISH = 0.465         # radius of the dished thumb rest that slides in the channel
    LIP = 0.02           # height of the fine raised rim round the dish
    HOLLOW = 0.11        # how deep the dish is (less than RAISE + LIP, or it would dip through the channel floor)
    REACH = 0.6          # how far the modelled sheet reaches (further than the others: the bar throws a shadow on it)
    clay = (0.6, 0.32, 0.21)
    base_mats = [material("Sheet", clay)]
    knob_mats = [material("Dish", (0.93, 0.8, 0.64), off=(0.55, 0.29, 0.19))]

    bm = bmesh.new()
    steps = sheet_steps(reach=REACH)
    steps += [(EDGE * t / 10, RAISE * math.sqrt(1.0 - (1.0 - t / 10) ** 2), 0) for t in range(11)]  # the bar's rounded edge
    steps += [(RIM - 0.014, RAISE, 0), (RIM - 0.004, RAISE - 0.003, 0), (RIM, RAISE - 0.013, 0), (RIM + 0.003, 0.012, 0), (RIM + 0.012, 0.0, 0)]  # the channel
    shell(bm, HALF, HALF[1], steps, corner=20)
    base = finish("Base", bm, base_mats, crease=40)

    bm = bmesh.new()
    top = RAISE + LIP
    bowl = DISH - 0.026  # where the rim ends and the hollow begins
    profile = [(DISH, 0.0, 0), (DISH, RAISE - 0.012, 0), (DISH - 0.004, top - 0.004, 0), (DISH - 0.013, top, 0), (bowl, top - 0.004, 0)]
    profile += [(bowl * (1.0 - i / 14), top - 0.004 - HOLLOW * (1.0 - (1.0 - i / 14) ** 2), 0) for i in range(1, 15)]
    puck(bm, profile)
    knob = finish("Knob", bm, knob_mats, crease=45)
    channel = (HALF[0] - RIM, HALF[1] - RIM, HALF[1] - RIM)
    return dict(title="Dish", note="The reverse of the others: the bar stands up from the sheet and the thumb rest is a shallow dish sliding in a channel in its top. One clay; the dish turns cream when on.",
                base=base, knob=knob, travel=channel[0] - channel[1], rim=(*HALF, HALF[1]), pit=channel, floor=0.0, sheet=REACH)


STYLES = {"knurled": knurled, "soft": soft, "rocker": rocker, "slider": slider, "ball": ball, "dish": dish}


# ---- Light and bake --------------------------------------------------------------------------------
def fresh():
    """An empty scene with the studio light: one wide, soft light from far away, and an evenly lit room.
    Far away, so the open sheet is lit the same everywhere and the page can continue it in one colour."""
    global scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    SPECS.clear()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "Standard"
    scene.render.bake.margin = 16
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = QUALITY
    scene.render.image_settings.color_mode = "RGB"
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


def bake(obj, label, size=MAP):
    """The light falling on one object, as a picture (without the object's own colour)."""
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
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"})
    return image


def values(image):
    return np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4)


def to_hex(colour):
    """A linear colour as the page writes it (sRGB)."""
    return "#" + "".join(f"{round(255 * (12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055)):02x}" for c in colour)


def build(name):
    fresh()
    made = STYLES[name]()
    base, knob = made["base"], made["knob"]
    slides = "travel" in made
    out = os.path.join(OUT, name)
    os.makedirs(out, exist_ok=True)
    neutral = material("Neutral", (0.8, 0.8, 0.8))

    def pose(k):
        """The moving part k of the way on, with the colours and lamps to match."""
        if slides:
            knob.location.x = (2.0 * k - 1.0) * made["travel"]
        else:
            knob.rotation_euler.y = (2.0 * k - 1.0) * made["tilt"]
        set_state(k)
        bpy.context.view_layer.update()

    images = {}
    # A sliding knob's shadow is baked separately (below) so it can travel with the knob, and the base
    # is baked without the knob. A part that tips in place stays in the base's bake.
    # Either way the base is baked on and off: its colours and lamps change the light that bounces round.
    knob.hide_render = slides
    for label, k in (("on", 1.0), ("off", 0.0)):
        pose(k)
        images[("base", label)] = bake(base, label)
    knob.hide_render = False
    for label, k in (("on", 1.0), ("mid", 0.5), ("off", 0.0)):
        pose(k)
        images[("knob", label)] = bake(knob, label)
    pose(0.0)

    if slides:
        # The knob's shadow: how much darker a flat floor is around the knob than with no knob there.
        knob.location.x = 0.0
        base.hide_render = True
        bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.0, 0.0, made["floor"] + 0.0005))
        ground = bpy.context.active_object
        ground.scale = (SHADOW_SPAN[0], SHADOW_SPAN[1], 1.0)
        ground.data.materials.append(neutral)
        bpy.context.view_layer.update()
        with_knob = values(bake(ground, "with", 512))
        knob.hide_render = True
        without = values(bake(ground, "without", 512))
        shadow = bpy.data.images.new("knob-shadow", 512, 512, float_buffer=True)
        ratio = np.ones_like(with_knob)
        ratio[:, :3] = np.clip(with_knob[:, :3].mean(axis=1, keepdims=True) / np.maximum(without[:, :3].mean(axis=1, keepdims=True), 1e-4), 0.0, 1.0)
        shadow.pixels.foreach_set(ratio.ravel())
        shadow.save_render(os.path.join(out, "knob-shadow.webp"), scene=scene)
        bpy.data.objects.remove(ground)
        knob.hide_render = False
        base.hide_render = False

    # Store every picture on the same scale, with the open sheet at OPEN.
    # A small square of open sheet, far from the switch, measures how bright "unshaded" is.
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(30.0, 0.0, 0.0))
    probe = bpy.context.active_object
    probe.data.materials.append(neutral)
    sheet_light = float(values(bake(probe, "probe", 16))[:, :3].mean())
    bpy.data.objects.remove(probe)
    for (part, label), image in images.items():
        data = values(image)
        data[data[:, 3] < 0.5, :3] = sheet_light  # unused parts of the picture: plain, so nothing dark bleeds in at small sizes
        data[:, :3] = np.clip(data[:, :3] * (OPEN / sheet_light), 0.0, 1.0)
        data[:, 3] = 1.0
        image.pixels.foreach_set(data.ravel())
        image.update()
        image.save_render(os.path.join(out, f"{part}-{label}.webp"), scene=scene)

    # Save and export, with the switch on and the moving part at rest in the middle.
    knob.location.x = 0.0
    knob.rotation_euler.y = 0.0
    set_state(1.0)
    for mat in bpy.data.materials:  # the bake pictures are saved beside the model, not inside it
        node = mat.node_tree.nodes.get("Bake") if mat.node_tree else None
        if node:
            mat.node_tree.nodes.remove(node)
    for mat in bpy.data.materials:  # the page lights lamps itself
        if mat.name in SPECS and SPECS[mat.name][2]:
            principled(mat).inputs["Emission Strength"].default_value = 0.0
    # Numbers the page needs.
    for key in ("travel", "tilt", "rim", "pit"):
        if key in made:
            base[key] = made[key]
    base["open"] = OPEN
    base["sheet"] = made.get("sheet", SHEET)
    if slides:
        base["shadowSpan"] = SHADOW_SPAN
    os.makedirs(BLENDS, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BLENDS, f"{name}.blend"))
    bpy.ops.object.select_all(action="DESELECT")
    base.select_set(True)
    knob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, "switch.glb"), use_selection=True, export_extras=True, export_yup=True, export_apply=True)
    print(f"{name}: built (open sheet light before scaling {sheet_light:.3f})")
    return dict(name=name, title=made["title"], note=made["note"], ink=made.get("ink", "dark"), sheet=to_hex(SPECS["Sheet"][0]))


asked = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
unknown = [name for name in asked if name not in STYLES]
if unknown:
    sys.exit(f"No such style: {', '.join(unknown)}. Styles: {', '.join(STYLES)}")
listed = {}
if os.path.exists(LIST):
    with open(LIST) as file:
        listed = {entry["name"]: entry for entry in json.load(file)}
for name in asked or STYLES:
    listed[name] = build(name)
with open(LIST, "w") as file:  # the styles the page offers, in the order above
    json.dump([listed[name] for name in STYLES if name in listed], file, indent=2)
    file.write("\n")
print("switches built")
