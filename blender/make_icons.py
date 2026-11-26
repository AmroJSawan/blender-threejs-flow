"""
The Icons set: one small system of vibrant 3D illustrations, rendered in Blender.

The system, taken from the references (single floating objects in frosted glass, glossy gradient plastic, leather and metal):
  - every icon is ONE object made of a few rounded slabs, stacked or fanned, so the layers are what is read;
  - a fixed kit of materials (see `materials`): gradient gloss, stitched leather, frosted glass, frosted coloured crystal,
    holographic foil, brushed metal, chrome, gold, speckled stone, a lit layer, paper and ink;
  - one palette at a time: a main pair of colours and a second, contrasting pair for the gradients, one accent, one backdrop;
  - one camera and one studio for all of them: a soft even main light, and coloured lamps that are seen only as reflections,
    which is where the glass, crystal and metal get their colour;
  - small made details (stitches, printed lines, a card's chip, screws) and one or two loose pieces for life.

It writes public/icons/<palette>/<icon>.webp for every icon in every palette, and src/icons/icons.json for the page.

Run:  npm run icons                       (Blender, no window; about half an hour)
      npm run icons -- --test             small and quick, first palette only
      npm run icons -- --just wallet      one icon only (the others' pictures are left as they are)
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons"
TEST = "--test" in sys.argv
JUST = sys.argv[sys.argv.index("--just") + 1] if "--just" in sys.argv else None

LOOK = {
    "picture": 460 if TEST else 1200,
    "samples": 48 if TEST else 220,
    "lens": 90.0,
    "from": (0.62, -1.0, 0.5),   # the direction the camera stands in, seen from the object
    "away": 9.6,                 # how far (m)
    "at": (0.0, 0.0, 1.3),       # what it looks at: the middle of every icon
    "floor": -0.2,               # height of the backdrop's floor: the object floats above it
    "sun": 1.3,                  # the main light: even over the whole backdrop, from up and to the left, very soft (`soft` degrees wide)
    "soft": 50.0,
    "fill": 150.0,               # a soft white lamp from the right
    "rim": 380.0,                # one from behind, for the bright edges
    "kick": 900.0,               # the two coloured lamps, left and right-behind: they light nothing matt, and show only in what reflects or lets light through
    "room": 0.4,                 # even light from everywhere. With the sun it adds up to about 1 on the floor, so the backdrop comes out its own colour
    "matte": 0.5,                # how rough every metal is (0 = mirror … 1 = chalk): all of them are matte
    "frost": 0.3,                # how frosted every glass is (0 = clear … 1 = milky): none of it is clear
    "bevel": 0.035,              # how rounded a slab's edges are
}
# A palette: the main pair of colours (a → b), a second pair that contrasts with it (c → d), the accent, the tint of frosted glass,
# the backdrop, and the colour of plain metal.
PALETTES = [
    {"name": "cobalt", "title": "Cobalt", "a": "#1f3fff", "b": "#8a3dff", "c": "#ff4d2e", "d": "#ffa53c", "accent": "#b9f227", "glass": "#a9c2ff", "back": "#e9ebf3", "metal": "#dfe4ee"},
    {"name": "coral", "title": "Coral", "a": "#ff3d24", "b": "#ff8a3d", "c": "#6a2bff", "d": "#ff4fa8", "accent": "#ffe033", "glass": "#ffb7a3", "back": "#f9c9bb", "metal": "#fff1ea"},
    {"name": "lime", "title": "Lime", "a": "#86dd00", "b": "#0fbf73", "c": "#1e9bff", "d": "#7a4dff", "accent": "#ff4f8b", "glass": "#bff7cf", "back": "#101312", "metal": "#c9d2cc"},
]


def linear(hex_colour, alpha=1.0):
    """A colour written as on the web, as the numbers Blender works in."""
    value = hex_colour.lstrip("#")
    parts = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*[c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in parts], alpha)


# ---------------------------------------------------------------- materials ----
def shader_of(material):
    return next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")


def plain(name, colour, rough=0.4, metal=0.0, coat=0.0, glow=0.0):
    made = bpy.data.materials.new(name)
    made.use_nodes = True
    shader = shader_of(made)
    shader.inputs["Base Color"].default_value = colour
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Coat Weight"].default_value = coat
    shader.inputs["Coat Roughness"].default_value = 0.08
    if glow:
        shader.inputs["Emission Color"].default_value = colour
        shader.inputs["Emission Strength"].default_value = glow
    return made


def graded(name, first, second, rough=0.28, coat=1.0, glow=0.0):
    """Two colours running corner to corner across each piece (measured on the piece itself, so every piece has the whole run)."""
    made = plain(name, first, rough=rough, coat=coat)
    tree = made.node_tree
    shader = shader_of(made)
    where = tree.nodes.new("ShaderNodeTexCoord")
    split = tree.nodes.new("ShaderNodeSeparateXYZ")
    tree.links.new(where.outputs["Generated"], split.inputs[0])
    run = tree.nodes.new("ShaderNodeMath")
    run.operation = "ADD"
    tree.links.new(split.outputs["X"], run.inputs[0])
    tree.links.new(split.outputs["Z"], run.inputs[1])
    half = tree.nodes.new("ShaderNodeMath")
    half.operation = "MULTIPLY"
    half.inputs[1].default_value = 0.5
    tree.links.new(run.outputs[0], half.inputs[0])
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = first
    ramp.color_ramp.elements[1].color = second
    ramp.color_ramp.elements[0].position = 0.15
    ramp.color_ramp.elements[1].position = 0.85
    tree.links.new(half.outputs[0], ramp.inputs[0])
    tree.links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    if glow:
        tree.links.new(ramp.outputs["Color"], shader.inputs["Emission Color"])
        shader.inputs["Emission Strength"].default_value = glow
    return made


def put(shader, name, value):
    """Sets one of a shader's numbers, if this Blender has it under that name."""
    if name in shader.inputs:
        shader.inputs[name].default_value = value


def grain(material, kind="NOISE", scale=60.0, deep=0.25, stretch=(1.0, 1.0, 1.0), detail=3.0):
    """A fine relief on a material's surface: leather's grain, brushed metal's lines."""
    tree = material.node_tree
    shader = shader_of(material)
    where = tree.nodes.new("ShaderNodeTexCoord")
    mapped = tree.nodes.new("ShaderNodeMapping")
    mapped.inputs["Scale"].default_value = stretch
    tree.links.new(where.outputs["Object"], mapped.inputs["Vector"])
    if kind == "CELLS":
        texture = tree.nodes.new("ShaderNodeTexVoronoi")
        texture.feature = "DISTANCE_TO_EDGE"
        height = texture.outputs["Distance"]
    else:
        texture = tree.nodes.new("ShaderNodeTexNoise")
        texture.inputs["Detail"].default_value = detail
        height = texture.outputs[0]
    texture.inputs["Scale"].default_value = scale
    tree.links.new(mapped.outputs["Vector"], texture.inputs["Vector"])
    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = deep
    bump.inputs["Distance"].default_value = 0.02
    tree.links.new(height, bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return material


def glass(name, tint, rough=0.22, through=0.5):
    """Glass. Its shadow is let through, tinted, so what stands behind it stays lit and the ground under it takes its colour."""
    made = plain(name, tint, rough=rough, coat=0.6)
    tree = made.node_tree
    shader = shader_of(made)
    shader.inputs["Transmission Weight"].default_value = 1.0
    shader.inputs["IOR"].default_value = 1.46
    out = next(node for node in tree.nodes if node.type == "OUTPUT_MATERIAL")
    path = tree.nodes.new("ShaderNodeLightPath")
    clear = tree.nodes.new("ShaderNodeBsdfTransparent")
    clear.inputs["Color"].default_value = (*[through + (1.0 - through) * c for c in tint[:3]], 1.0)
    both = tree.nodes.new("ShaderNodeMixShader")
    tree.links.new(path.outputs["Is Shadow Ray"], both.inputs["Fac"])
    tree.links.new(shader.outputs[0], both.inputs[1])
    tree.links.new(clear.outputs[0], both.inputs[2])
    tree.links.new(both.outputs[0], out.inputs["Surface"])
    return made


def foil(name, colours):
    """Holographic foil: a metal whose colour runs through `colours` as the surface turns away from the eye, a little unevenly."""
    made = plain(name, colours[0], rough=LOOK["matte"] * 0.8, metal=1.0)
    tree = made.node_tree
    shader = shader_of(made)
    facing = tree.nodes.new("ShaderNodeLayerWeight")
    facing.inputs["Blend"].default_value = 0.35
    where = tree.nodes.new("ShaderNodeTexCoord")
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1.6
    tree.links.new(where.outputs["Object"], noise.inputs["Vector"])
    sum_ = tree.nodes.new("ShaderNodeMath")
    sum_.operation = "ADD"
    tree.links.new(facing.outputs["Facing"], sum_.inputs[0])
    tree.links.new(noise.outputs[0], sum_.inputs[1])
    wrap = tree.nodes.new("ShaderNodeMath")
    wrap.operation = "FRACT"
    tree.links.new(sum_.outputs[0], wrap.inputs[0])
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = colours[0]
    ramp.color_ramp.elements[1].color = colours[0]
    for index, colour in enumerate(colours[1:], start=1):
        ramp.color_ramp.elements.new(index / len(colours)).color = colour
    tree.links.new(wrap.outputs[0], ramp.inputs[0])
    tree.links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    tree.links.new(ramp.outputs["Color"], shader.inputs["Emission Color"])
    shader.inputs["Emission Strength"].default_value = 0.12
    return made


def speckled(name, ground, specks):
    """Stone with coloured specks in it."""
    made = plain(name, ground, rough=0.5, coat=0.3)
    tree = made.node_tree
    shader = shader_of(made)
    where = tree.nodes.new("ShaderNodeTexCoord")
    cells = tree.nodes.new("ShaderNodeTexVoronoi")
    cells.inputs["Scale"].default_value = 26.0
    tree.links.new(where.outputs["Object"], cells.inputs["Vector"])
    near = tree.nodes.new("ShaderNodeMath")
    near.operation = "LESS_THAN"
    near.inputs[1].default_value = 0.16
    tree.links.new(cells.outputs["Distance"], near.inputs[0])
    hue = tree.nodes.new("ShaderNodeValToRGB")
    hue.color_ramp.interpolation = "CONSTANT"
    hue.color_ramp.elements[0].color = specks[0]
    hue.color_ramp.elements[1].color = specks[1]
    hue.color_ramp.elements[1].position = 0.5
    split = tree.nodes.new("ShaderNodeSeparateColor")
    tree.links.new(cells.outputs["Color"], split.inputs[0])
    tree.links.new(split.outputs[0], hue.inputs[0])
    mix = tree.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    tree.links.new(near.outputs[0], mix.inputs["Factor"])
    mix.inputs["A"].default_value = ground
    tree.links.new(hue.outputs["Color"], mix.inputs["B"])
    tree.links.new(mix.outputs["Result"], shader.inputs["Base Color"])
    return made


def materials(palette):
    a, b, c, d, accent = (linear(palette[key]) for key in ("a", "b", "c", "d", "accent"))
    dim = lambda colour, by: tuple(v * by for v in colour[:3]) + (1.0,)
    leather = grain(graded("Leather", dim(a, 0.8), b, rough=0.5, coat=0.15), kind="CELLS", scale=110.0, deep=0.5)
    put(shader_of(leather), "Sheen Weight", 0.6)
    brushed = grain(plain("Brushed", dim(linear(palette["metal"]), 0.78), rough=LOOK["matte"], metal=1.0), scale=9.0, deep=0.08, stretch=(1.0, 1.0, 90.0), detail=1.0)
    put(shader_of(brushed), "Anisotropic", 0.4)
    gloss = graded("Gloss", a, b)
    put(shader_of(gloss), "Subsurface Weight", 0.15)
    return {
        "gloss": gloss,                                                                  # plastic in the main pair of colours
        "second": graded("Second", c, d),                                               # … in the second pair
        "deep": graded("Deep", dim(a, 0.35), dim(a, 0.9)),                              # the main colour, darker: the piece behind
        "leather": leather,                                                             # grained, soft; takes stitches
        "frost": glass("Frost", linear(palette["glass"]), rough=LOOK["frost"]),                              # frosted glass, tinted
        "crystal": glass("Crystal", tuple(0.35 + 0.65 * v for v in b[:3]) + (1.0,), rough=LOOK["frost"], through=0.25),   # coloured, thick, frosted like the rest
        "crystal2": glass("Crystal Two", tuple(0.35 + 0.65 * v for v in d[:3]) + (1.0,), rough=LOOK["frost"], through=0.25),
        "foil": foil("Foil", [d, accent, a, b, c]),                                     # holographic
        "brushed": brushed,                                                             # metal with a fine brushed line
        "chrome": plain("Chrome", (0.86, 0.87, 0.9, 1.0), rough=LOOK["matte"], metal=1.0),   # plain metal, bead-blasted: no mirror shine
        "gold": plain("Gold", linear("#ffc23d"), rough=LOOK["matte"], metal=1.0),
        "stone": speckled("Stone", linear("#d9dbe2") if palette["name"] != "lime" else linear("#2a2f2c"), [a, d]),
        "glow": graded("Glow", c, d, rough=0.5, coat=0.0, glow=0.7),                    # the lit layer
        "accent": plain("Accent", accent, rough=0.3, coat=1.0, glow=0.15),
        "paper": plain("Paper", (0.9, 0.9, 0.92, 1.0), rough=0.6),
        "print": plain("Print", (0.45, 0.47, 0.55, 1.0), rough=0.7),                    # the lines printed on paper
        "ink": plain("Ink", (0.012, 0.014, 0.02, 1.0), rough=0.35, coat=0.5),
        "floor": plain("Floor", linear(palette["back"]), rough=0.9),
        "_lamps": (a, d),
    }


# ---------------------------------------------------------------- shapes ----
def rounded(points, steps=10):
    """An outline with its corners rounded. Each point is (x, z, radius)."""
    done = []
    count = len(points)
    for index, (x, z, radius) in enumerate(points):
        here = Vector((x, z))
        before = Vector(points[index - 1][:2]) - here
        after = Vector(points[(index + 1) % count][:2]) - here
        reach = min(radius, before.length * 0.48, after.length * 0.48)
        if reach <= 1e-5:
            done.append(here)
            continue
        start, end = here + before.normalized() * reach, here + after.normalized() * reach
        for step in range(steps + 1):
            t = step / steps
            done.append(start * (1 - t) ** 2 + here * 2 * t * (1 - t) + end * t * t)
    return done


def box(wide, tall, corner):
    w, h = wide / 2, tall / 2
    return rounded([(-w, -h, corner), (w, -h, corner), (w, h, corner), (-w, h, corner)])


def stroke(path, wide):
    """A line of three points drawn `wide` thick, as an outline."""
    a, b, c = (Vector(p) for p in path)
    first, second = (b - a).normalized(), (c - b).normalized()
    side = lambda way: Vector((-way.y, way.x)) * (wide / 2)
    mitre = (side(first) + side(second)).normalized() * (wide / 2) / max(math.cos(first.angle(second) / 2), 0.3)
    outline = [a + side(first), b + mitre, c + side(second), c - side(second), b - mitre, a - side(first)]
    return rounded([(p.x, p.y, wide * 0.3) for p in outline], steps=4)


def dashes(outline, long, gap, wide, start=0.0):
    """Short strokes laid end to end round a closed outline: a row of stitches, a dashed line."""
    made = []
    points = outline + [outline[0]]
    lengths = [(points[i + 1] - points[i]).length for i in range(len(outline))]
    whole = sum(lengths)

    def at(distance):
        distance %= whole
        for index, length in enumerate(lengths):
            if distance <= length:
                return points[index].lerp(points[index + 1], distance / max(length, 1e-9))
            distance -= length
        return points[0]

    count = int(whole / (long + gap))
    pitch = whole / count
    for index in range(count):
        first, last = at(start + index * pitch), at(start + index * pitch + long)
        way = (last - first).normalized()
        side = Vector((-way.y, way.x)) * (wide / 2)
        made.append([first + side, last + side, last - side, first - side])
    return made


def rows(wide, count, pitch, thick, short=0.6):
    """Lines of print: `count` thin bars one under another, the last one shorter."""
    return [[Vector((x, -i * pitch + z)) for x, z in ((-wide / 2, -thick / 2), ((wide * (short if i == count - 1 else 1.0)) - wide / 2, -thick / 2), ((wide * (short if i == count - 1 else 1.0)) - wide / 2, thick / 2), (-wide / 2, thick / 2))] for i in range(count)]


def disc(radius, steps=64):
    return [Vector((math.cos(t) * radius, math.sin(t) * radius)) for t in (math.tau * i / steps for i in range(steps))]


def arc(inner, outer, start, end, steps=40):
    """A slice of a ring, between two angles (degrees)."""
    turn = [math.radians(start + (end - start) * i / steps) for i in range(steps + 1)]
    ring = [Vector((math.cos(t) * outer, math.sin(t) * outer)) for t in turn] + [Vector((math.cos(t) * inner, math.sin(t) * inner)) for t in reversed(turn)]
    return ring


class Icon:
    """What an icon is built with. Slabs are drawn upright, facing the front (x across, z up), and are `thick` front to back."""

    def __init__(self, made, turn=0.0, lean=0.0):
        self.made = made
        self.root = bpy.data.objects.new("Icon", None)
        self.root.location = LOOK["at"]
        self.root.rotation_euler = (math.radians(lean), 0.0, math.radians(turn))
        bpy.context.scene.collection.objects.link(self.root)

    def _place(self, thing, material, at, roll, tip, flat):
        thing.data.materials.append(self.made[material])
        thing.parent = self.root
        thing.location = at
        thing.rotation_euler = (math.radians(tip + (90.0 if flat else 0.0)), math.radians(roll), 0.0)
        bpy.context.scene.collection.objects.link(thing)
        return thing

    def slab(self, outline, thick, material, at=(0.0, 0.0, 0.0), roll=0.0, tip=0.0, flat=False, bevel=None):
        """`roll` turns it in its own plane, `tip` leans its top back; `flat` lays it down."""
        mesh = bpy.data.meshes.new("Slab")
        bm = bmesh.new()
        for one in (outline if isinstance(outline[0], (list, tuple)) else [outline]):   # one outline, or several in the same plane
            bm.faces.new([bm.verts.new((p.x, 0.0, p.y)) for p in one])
        bm.to_mesh(mesh)
        bm.free()
        for face in mesh.polygons:
            face.use_smooth = True
        thing = bpy.data.objects.new("Slab", mesh)
        solid = thing.modifiers.new("Thick", "SOLIDIFY")
        solid.thickness = thick
        solid.offset = 0.0
        edge = thing.modifiers.new("Edge", "BEVEL")
        edge.width = min(LOOK["bevel"] if bevel is None else bevel, thick * 0.45)
        edge.segments = 5
        edge.limit_method = "ANGLE"
        edge.angle_limit = math.radians(50)
        thing.modifiers.new("Faces", "WEIGHTED_NORMAL")
        return self._place(thing, material, at, roll, tip, flat)

    def ball(self, radius, material, at):
        mesh = bpy.data.meshes.new("Ball")
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=radius)
        bm.to_mesh(mesh)
        bm.free()
        for face in mesh.polygons:
            face.use_smooth = True
        return self._place(bpy.data.objects.new("Ball", mesh), material, at, 0.0, 0.0, False)

    def tube(self, path, radius, material, at=(0.0, 0.0, 0.0)):
        """A round bar along a path of (x, z) points."""
        curve = bpy.data.curves.new("Tube", "CURVE")
        curve.dimensions = "3D"
        curve.bevel_depth = radius
        curve.bevel_resolution = 8
        curve.use_fill_caps = True
        line = curve.splines.new("POLY")
        line.points.add(len(path) - 1)
        for point, (x, z) in zip(line.points, path):
            point.co = (x, 0.0, z, 1.0)
        return self._place(bpy.data.objects.new("Tube", curve), material, at, 0.0, 0.0, False)

    def coin(self, radius, material, at, roll=0.0, tip=0.0, mark="ink"):
        """A coin: a rim, a raised middle, and a ring of small dots struck into each face."""
        self.slab(disc(radius), 0.075, material, at, roll, tip, bevel=0.02)
        self.slab(disc(radius * 0.8), 0.1, material, at, roll, tip, bevel=0.012)
        self.slab(dashes(disc(radius * 0.6), 0.03, 0.05, 0.03), 0.112, mark, at, roll, tip, bevel=0.004)
        return self.slab(disc(radius * 0.3), 0.125, material, at, roll, tip, bevel=0.012)


# ---------------------------------------------------------------- the icons ----
def folder(made):
    icon = Icon(made, turn=-8)
    back = rounded([(-1.0, -0.75, 0.14), (1.0, -0.75, 0.14), (1.0, 0.55, 0.14), (-0.05, 0.55, 0.1), (-0.25, 0.8, 0.1), (-1.0, 0.8, 0.14)])
    icon.slab(back, 0.1, "leather", at=(0.0, 0.32, 0.0))
    icon.slab(dashes(box(1.84, 1.16, 0.08), 0.06, 0.045, 0.014), 0.012, "paper", at=(0.0, 0.265, -0.11), bevel=0.003)
    icon.slab(box(1.66, 1.4, 0.09), 0.03, "paper", at=(0.1, 0.2, 0.22), roll=4.0)
    icon.slab(box(1.66, 1.4, 0.09), 0.03, "foil", at=(-0.03, 0.12, 0.16), roll=-2.5)
    icon.slab(box(1.66, 1.4, 0.09), 0.03, "glow", at=(0.06, 0.04, 0.09), roll=1.5)
    icon.slab(box(1.66, 1.4, 0.09), 0.03, "paper", at=(0.0, -0.04, 0.02))
    icon.slab(rows(1.2, 4, 0.11, 0.035), 0.008, "print", at=(-0.05, -0.058, 0.6), bevel=0.002)
    icon.slab(box(2.0, 1.18, 0.14), 0.13, "frost", at=(0.0, -0.24, -0.16), tip=-7)
    icon.slab(box(0.62, 0.2, 0.06), 0.03, "second", at=(-0.56, -0.35, 0.16), tip=-7, bevel=0.012)
    icon.slab(rows(0.4, 1, 0.1, 0.03, short=1.0), 0.012, "paper", at=(-0.58, -0.372, 0.162), tip=-7, bevel=0.003)
    icon.slab(disc(0.075), 0.05, "chrome", at=(0.74, -0.33, 0.2), tip=-7, bevel=0.015)
    icon.ball(0.1, "accent", (1.28, -0.2, 0.62))
    icon.ball(0.06, "crystal2", (-1.25, -0.3, -0.35))
    icon.slab(arc(0.1, 0.17, 0, 359.9), 0.05, "gold", at=(-1.22, -0.1, 0.72), roll=20, tip=30, bevel=0.02)


def wallet(made):
    icon = Icon(made, turn=-6)
    icon.slab(box(2.0, 1.45, 0.24), 0.17, "deep", at=(0.0, 0.28, 0.0))
    icon.slab(box(1.6, 1.0, 0.1), 0.035, "second", at=(-0.14, 0.11, 0.52), roll=6.0)
    icon.slab(box(0.26, 0.2, 0.045), 0.02, "gold", at=(-0.62, 0.085, 0.72), roll=6.0, bevel=0.008)
    icon.slab(rows(0.26, 3, 0.05, 0.008, short=1.0), 0.004, "ink", at=(-0.62, 0.073, 0.77), roll=6.0, bevel=0.001)
    icon.slab(dashes(box(0.9, 0.001, 0.0), 0.05, 0.04, 0.05), 0.012, "paper", at=(0.2, 0.088, 0.88), roll=6.0, bevel=0.004)
    icon.slab(box(1.6, 1.0, 0.1), 0.035, "foil", at=(0.12, 0.02, 0.33), roll=-3.0)
    icon.slab(box(1.6, 1.0, 0.1), 0.035, "frost", at=(-0.02, -0.06, 0.16), roll=1.0)
    icon.slab(box(2.0, 1.05, 0.24), 0.19, "leather", at=(0.0, -0.24, -0.2))
    icon.slab(dashes(box(1.84, 0.89, 0.17), 0.06, 0.045, 0.016), 0.014, "paper", at=(0.0, -0.335, -0.2), bevel=0.004)
    icon.slab(box(0.66, 0.38, 0.17), 0.1, "leather", at=(0.74, -0.38, -0.12))
    icon.slab(dashes(box(0.54, 0.26, 0.11), 0.05, 0.04, 0.014), 0.012, "paper", at=(0.74, -0.432, -0.12), bevel=0.003)
    icon.slab(disc(0.085), 0.05, "chrome", at=(0.58, -0.45, -0.12), bevel=0.016)
    icon.slab(disc(0.2), 0.035, "accent", at=(-0.55, -0.34, -0.38), bevel=0.012)
    icon.slab([disc(0.028), [p + Vector((0.075, 0.0)) for p in disc(0.028)], arc(0.085, 0.115, 200, 340)], 0.01, "ink", at=(-0.588, -0.36, -0.36), bevel=0.003)
    icon.coin(0.27, "gold", (-0.55, -0.05, 1.36), tip=38)
    icon.coin(0.24, "gold", (0.32, 0.0, 1.56), tip=-55, roll=20)
    icon.ball(0.07, "crystal", (1.3, -0.2, 0.9))


def shield(made):
    icon = Icon(made, turn=-4)
    outline = rounded([(-0.88, 0.86, 0.1), (0.0, 1.04, 0.5), (0.88, 0.86, 0.1), (0.88, -0.05, 0.6), (0.0, -1.08, 0.2), (-0.88, -0.05, 0.6)], steps=14)
    small = [p * 0.8 for p in outline]
    icon.slab(outline, 0.1, "glow", at=(0.66, 0.34, -0.04), roll=22)
    icon.slab(outline, 0.1, "stone", at=(0.34, 0.14, -0.01), roll=11)
    icon.slab(outline, 0.2, "crystal", at=(0.0, -0.1, 0.0), bevel=0.06)
    icon.slab(small, 0.05, "frost", at=(0.0, -0.215, 0.0), bevel=0.02)
    icon.slab(stroke([(-0.34, 0.06), (-0.1, -0.2), (0.36, 0.34)], 0.16), 0.09, "second", at=(0.0, -0.26, 0.0), bevel=0.03)
    icon.slab([[p * 0.045 + Vector((x, 0.78)) for p in disc(1.0, 20)] for x in (-0.1, 0.0, 0.1)], 0.02, "chrome", at=(0.0, -0.245, 0.0), bevel=0.006)
    icon.ball(0.085, "accent", (-1.2, -0.2, 0.75))
    icon.ball(0.05, "gold", (-1.05, -0.3, -0.8))


def layers(made):
    icon = Icon(made, turn=45, lean=14)
    plate = box(1.9, 1.9, 0.42)
    icon.slab(plate, 0.26, "brushed", at=(0.0, 0.0, -0.52), flat=True)
    icon.slab(box(1.66, 1.66, 0.36), 0.12, "glow", at=(0.0, 0.0, -0.2), flat=True)
    icon.slab(box(1.76, 1.76, 0.38), 0.07, "ink", at=(0.0, 0.0, 0.03), flat=True)
    icon.slab(dashes(box(1.5, 1.5, 0.3), 0.07, 0.05, 0.02), 0.012, "accent", at=(0.0, 0.0, 0.07), flat=True, bevel=0.003)
    icon.slab(box(1.84, 1.84, 0.4), 0.05, "foil", at=(0.0, 0.0, 0.22), flat=True)
    icon.slab(plate, 0.26, "crystal", at=(0.0, 0.0, 0.5), flat=True, bevel=0.07)
    icon.slab(box(0.8, 0.8, 0.22), 0.07, "gloss", at=(0.0, 0.0, 0.66), flat=True, bevel=0.025)
    icon.slab(arc(0.16, 0.24, 0, 359.9), 0.02, "paper", at=(0.0, 0.0, 0.705), flat=True, bevel=0.006)
    for x, y in ((-0.7, -0.7), (0.7, -0.7), (0.7, 0.7), (-0.7, 0.7)):
        icon.slab(disc(0.06, 24), 0.04, "chrome", at=(x, y, -0.385), flat=True, bevel=0.012)
    icon.ball(0.09, "accent", (1.1, -1.0, 0.75))
    icon.ball(0.055, "gold", (-1.15, -0.9, -0.2))


def lock(made):
    icon = Icon(made, turn=-10)
    icon.slab(box(2.05, 2.05, 0.46), 0.1, "frost", at=(0.0, 0.44, 0.05))
    icon.slab(dashes(box(1.8, 1.8, 0.36), 0.07, 0.06, 0.02), 0.012, "second", at=(0.0, 0.385, 0.05), bevel=0.003)
    arch = [(-0.42, -0.1)] + [(-math.cos(math.pi * i / 24) * 0.42, 0.45 + math.sin(math.pi * i / 24) * 0.42) for i in range(25)] + [(0.42, -0.1)]
    icon.tube(arch, 0.11, "chrome", at=(0.0, 0.0, 0.0))
    icon.slab(box(1.5, 1.2, 0.28), 0.5, "gloss", at=(0.0, 0.0, -0.4), bevel=0.07)
    icon.slab(box(1.5, 0.16, 0.05), 0.52, "gold", at=(0.0, 0.0, 0.08), bevel=0.02)
    icon.slab(disc(0.26), 0.05, "gold", at=(0.0, -0.27, -0.42), bevel=0.015)
    icon.slab(disc(0.1, 40), 0.03, "ink", at=(0.0, -0.3, -0.37), bevel=0.008)
    icon.slab(box(0.075, 0.2, 0.03), 0.03, "ink", at=(0.0, -0.3, -0.5), bevel=0.008)
    for x, z in ((-0.6, -0.86), (0.6, -0.86), (-0.6, -0.1), (0.6, -0.1)):
        icon.slab(disc(0.04, 20), 0.03, "chrome", at=(x, -0.26, z), bevel=0.01)
    icon.ball(0.1, "accent", (1.15, -0.3, 0.8))
    icon.ball(0.06, "crystal2", (-1.2, -0.2, -0.6))


def chart(made):
    icon = Icon(made, turn=20, lean=40)
    for start, end, tall, material in [(8, 112, 0.62, "gloss"), (122, 196, 0.36, "crystal2"), (206, 286, 0.5, "foil"), (296, 358, 0.28, "stone")]:
        icon.slab(arc(0.46, 1.08, start, end), tall, material, at=(0.0, 0.0, -0.35 + tall / 2), flat=True, bevel=0.045)
    icon.slab(dashes(disc(1.24, 96), 0.05, 0.05, 0.02), 0.012, "print", at=(0.0, 0.0, -0.34), flat=True, bevel=0.003)
    icon.ball(0.16, "chrome", (0.0, 0.0, -0.1))
    icon.ball(0.08, "accent", (1.25, -0.6, 0.5))


ICONS = [
    ("folder", "Folder", "Documents kept together", folder),
    ("wallet", "Wallet", "Cards and money", wallet),
    ("shield", "Shield", "Protection, in layers", shield),
    ("layers", "Layers", "A platform, built up", layers),
    ("lock", "Lock", "Private and secure", lock),
    ("chart", "Chart", "Shares of a whole", chart),
]


# ---------------------------------------------------------------- the studio ----
def lamp(name, at, size, power, toward, colour=(1.0, 1.0, 1.0), matt=True):
    """A soft rectangular lamp. With `matt` off it lights nothing matt: it is there to be reflected and seen through glass."""
    light = bpy.data.lights.new(name, "AREA")
    light.shape = "RECTANGLE"
    light.size, light.size_y = size
    light.energy = power
    light.color = colour[:3]
    made = bpy.data.objects.new(name, light)
    made.location = at
    made.rotation_euler = (Vector(toward) - Vector(at)).to_track_quat("-Z", "Y").to_euler()
    made.visible_diffuse = matt
    bpy.context.scene.collection.objects.link(made)


def studio(made, dark):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.use_denoising = True
    scene.cycles.samples = LOOK["samples"]
    scene.cycles.transmission_bounces = 16
    scene.cycles.transparent_max_bounces = 16
    scene.cycles.max_bounces = 16
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for device in prefs.devices:
            device.use = True
        scene.cycles.device = "GPU"
    except Exception as problem:  # noqa: BLE001
        print("rendering on the processor:", problem)
    scene.view_settings.view_transform = "Standard"   # colours come out as set: the film-like transforms wash a vivid palette out
    scene.render.resolution_x = scene.render.resolution_y = LOOK["picture"]
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 90
    scene.render.image_settings.color_mode = "RGB"
    world = bpy.data.worlds.new("Room")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
    world.node_tree.nodes["Background"].inputs[1].default_value = LOOK["room"] * (0.7 if dark else 1.0)
    scene.world = world
    at = Vector(LOOK["at"])
    eye = bpy.data.objects.new("Eye", bpy.data.cameras.new("Eye"))
    eye.data.lens = LOOK["lens"]
    eye.location = at + Vector(LOOK["from"]).normalized() * LOOK["away"]
    eye.rotation_euler = (at - eye.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(eye)
    scene.camera = eye
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = LOOK["sun"] * (0.8 if dark else 1.0)
    sun.data.angle = math.radians(LOOK["soft"])
    sun.rotation_euler = (Vector((0.0, 0.0, 0.0)) - Vector((-0.45, -0.5, 1.0))).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(sun)
    lamp("Fill", (5.0, -3.0, 3.0), (4.0, 4.0), LOOK["fill"], at)
    lamp("Rim", (1.5, 5.5, 4.5), (6.0, 2.0), LOOK["rim"], at)
    left, right = made["_lamps"]
    lamp("Kick Left", (-6.0, -1.0, 2.0), (2.0, 6.0), LOOK["kick"], at, colour=left, matt=False)
    lamp("Kick Right", (5.0, 4.0, 1.0), (2.0, 6.0), LOOK["kick"], at, colour=right, matt=False)
    mesh = bpy.data.meshes.new("Floor")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=120.0)
    bm.to_mesh(mesh)
    bm.free()
    floor = bpy.data.objects.new("Floor", mesh)
    floor.location = (0.0, 0.0, LOOK["floor"])
    mesh.materials.append(made["floor"])
    scene.collection.objects.link(floor)


def main():
    listed = []
    for palette in PALETTES[:1] if TEST and not JUST else PALETTES:
        for name, title, about, build in ICONS:
            if JUST and name != JUST:
                continue
            bpy.ops.wm.read_factory_settings(use_empty=True)
            made = materials(palette)
            studio(made, dark=palette["name"] == "lime")
            build(made)
            target = OUT / palette["name"] / f"{name}.webp"
            target.parent.mkdir(parents=True, exist_ok=True)
            bpy.context.scene.render.filepath = str(target)
            bpy.ops.render.render(write_still=True)
            print("wrote", target)
    for palette in PALETTES:
        # The backdrop as it came out under the studio's light, read off a picture's edges: the page takes this colour, so a
        # picture's edges can fade into it.
        seen = bpy.data.images.load(str(OUT / palette["name"] / f"{ICONS[0][0]}.webp"))
        wide, tall = seen.size
        pixels = seen.pixels[:]
        spots = [(int(wide * x), int(tall * y)) for x, y in ((0.03, 0.5), (0.97, 0.5), (0.5, 0.97), (0.5, 0.03), (0.04, 0.04), (0.96, 0.04))]
        mean = [sum(pixels[(y * wide + x) * seen.channels + c] for x, y in spots) / len(spots) for c in range(3)]
        page = "#" + "".join(f"{round(max(0.0, min(1.0, v)) * 255):02x}" for v in mean)
        listed.append({**{key: palette[key] for key in ("name", "title", "a", "b", "c", "d", "accent", "glass", "back")}, "page": page})
    manifest = {"palettes": listed, "icons": [{"name": name, "title": title, "about": about} for name, title, about, _ in ICONS]}
    (ROOT / "src" / "icons").mkdir(parents=True, exist_ok=True)
    (ROOT / "src" / "icons" / "icons.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("wrote icons.json")


main()
