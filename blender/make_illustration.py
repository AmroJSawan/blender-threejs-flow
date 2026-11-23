"""
Illustrations: marketing stills, each built as one Geometry Nodes network.

    npm run illustration

Nothing here is modelled by hand. Each scene is one node group made from the parameters listed with it;
they are the group's inputs, so in Blender they appear on the object's modifier and can be changed there,
and every part follows. Open blender/illustrations/<scene>.blend to do that.

The scenes share their parts (PARTS below): the card, the chip, the tile with its ring, the dotted ground.

    Signal    one thick rounded card floating over a dotted ground, with one glowing line curving away
              from it through one or two chips.
    Gateway   a bigger scene from the same parts: a round hub in the middle with a bright ring, and
              bundles of thin lines flowing out of it, left and right, to small cards, a tile and labels.

The words are parameters too, and are made into geometry by the same network, set in Inter
(blender/fonts, under the SIL Open Font License).
The light is real: Blender works out how the glowing parts and one wide soft lamp light the ground and the solid
parts (cards, chips, the tile, the hub's plate), shadows included, and saves that as two pictures per variant
(see LIGHT below). The colour of each part and the moving light on
the lines are added by the page
(src/illustrations/main.ts), by material name; here there is only shape. Two things are handed to the page
with the shape, as extra numbers on each point: where a point lies on its card ("_card", "_shape"), and how
far along its line it is ("_flow").

The script writes
    blender/illustrations/<scene>.blend             the node network, to open and adjust
    public/illustrations/<scene>/<variant>.glb      the scene, once per variant
    public/illustrations/<scene>/<variant>.webp     the light falling on its ground
    public/illustrations/<scene>/<variant>-parts.webp   the light falling on its cards, chips, tile and plate
    src/illustrations/scenes.json                   what the page lists
"""
import hashlib
import json
import math
from pathlib import Path

import bmesh
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
# The typeface: Inter (SIL Open Font License, see blender/fonts/OFL.txt). Headline words use the heavier one.
FONTS = {"medium": "Inter-Medium.ttf", "bold": "Inter-SemiBold.ttf"}

MATERIALS = ["Ground", "Dot", "Outline", "Card", "Panel", "Tile", "Ink", "Dim", "Accent", "Glow", "Chip", "Plate", "Ring", "Wire"]

# The card's own layout, metres. These are proportions of the design rather than things to tune per variant.
PAD = 0.3            # from the card's edge to its contents
TILE = 0.5           # the small square at the top left
HEAD = 1.0           # depth of the strip that holds the tile, title and subtitle
FOOT = 0.62          # depth of the strip that holds the footer
INSET = 0.2          # from the card's edge to the panel
CHIP = (1.5, 0.5, 0.14)  # a chip: across, deep, thick

# ---- LIGHT: how the ground is lit. Worked out by Blender (Cycles) and saved as a picture the page lays on the ground. ----
LIGHT = {
    "lamp": 900.0,      # power of the one wide lamp overhead, which gives the soft pool of light and the soft shadows
    "lamp_size": 9.0,   # how wide that lamp is, metres: wider = softer shadows
    "lamp_height": 8.0,
    "room": 0.012,      # even light from everywhere, which keeps the shadows from going black
    "card": 0.55,       # how brightly a card shines on what is round it
    "glow": 4.0,        # … the glowing line and the hub's coloured arc
    "ring": 0.5,        # … the hub's ring
    "wire": 0.5,        # … the thin lines
    "samples": 128,     # more = a cleaner picture, slower to make
    "size": 1024,       # the ground picture's width and height, px
    "parts_size": 2048, # the same for the picture of the light on the solid parts
    "stored": 3.0,      # the brightest light the picture can hold (anything brighter is clipped)
    "quality": 92,      # how closely the saved picture keeps the result (WebP, 0-100)
}
# The colours the glowing parts shine with: a card's far-left and near-right corners, the line, the ring.
RECEIVES = ("Card", "Chip", "Plate")                      # materials whose light is worked out, besides the ground
UNSEEN = ("Ink", "Dim", "Accent", "Panel", "Tile")        # words and thin overlays: they cast no shadow and bounce no light
SHINES = {"card_far": "#3bcf7b", "card_near": "#1b8fa9", "glow": "#46f58a", "ring": "#eefff4", "wire": "#7dffb0"}


class Net:
    """A thin layer for writing a node tree: add nodes, and give each input either a value or another node's output."""

    def __init__(self, tree):
        self.tree = tree

    def add(self, kind, inputs=None, **settings):
        node = self.tree.nodes.new(kind)
        for key, value in settings.items():
            setattr(node, key, value)
        for key, value in (inputs or {}).items():
            socket = self.socket(node, key)
            if isinstance(value, bpy.types.NodeSocket):
                self.tree.links.new(value, socket)
            elif isinstance(value, (list, tuple)) and value and isinstance(value[0], bpy.types.NodeSocket):
                for source in value:
                    self.tree.links.new(source, socket)
            else:
                socket.default_value = value
        return node

    @staticmethod
    def socket(node, key):
        if isinstance(key, int):
            return node.inputs[key]
        found = [s for s in node.inputs if s.name == key and s.enabled]
        if not found:
            raise KeyError(f"{node.bl_idname} has no input {key!r}; it has {[s.name for s in node.inputs if s.enabled]}")
        return found[0]

    @staticmethod
    def out(node, key=0):
        if isinstance(key, int):
            return [s for s in node.outputs if s.enabled][key]
        return next(s for s in node.outputs if s.name == key and s.enabled)

    def choose(self, node, name, value, label=None):
        """Sets a node's option, whether this Blender keeps it as a property or as an input."""
        if hasattr(node, name):
            setattr(node, name, value)
        else:
            self.socket(node, name.replace("_", " ").title()).default_value = label or value.replace("_", " ").title()

    def math(self, operation, a, b=0.0, c=0.0):
        return self.add("ShaderNodeMath", {0: a, 1: b, 2: c}, operation=operation).outputs[0]

    def vector(self, x=0.0, y=0.0, z=0.0):
        return self.add("ShaderNodeCombineXYZ", {"X": x, "Y": y, "Z": z}).outputs[0]

    def join(self, *parts):
        return self.add("GeometryNodeJoinGeometry", {0: list(parts)}).outputs[0]

    def material(self, geometry, name):
        return self.add("GeometryNodeSetMaterial", {"Geometry": geometry, "Material": bpy.data.materials[name]}).outputs[0]

    def moved(self, geometry, translation):
        return self.add("GeometryNodeTransform", {"Geometry": geometry, "Translation": translation}).outputs[0]

    def only_if(self, condition, geometry):
        return self.add("GeometryNodeSwitch", {"Switch": condition, "True": geometry}, input_type="GEOMETRY").outputs[0]

    def tube(self, curve, radius, sides=10):
        """A curve given thickness, smooth round its length."""
        profile = self.add("GeometryNodeCurvePrimitiveCircle", {"Resolution": sides, "Radius": radius})
        mesh = self.add("GeometryNodeCurveToMesh", {"Curve": curve, "Profile Curve": self.out(profile, "Curve"), "Fill Caps": True})
        return self.add("GeometryNodeSetShadeSmooth", {0: mesh.outputs[0]}).outputs[0]

    def rounded(self, across, deep, radius, segments):
        """The outline of a rectangle with rounded corners, flat on the ground and centred."""
        outline = self.add("GeometryNodeCurvePrimitiveQuadrilateral", {"Width": across, "Height": deep})
        fillet = self.add("GeometryNodeFilletCurve", {"Curve": self.out(outline), "Radius": radius, "Limit Radius": True, "Count": segments})
        self.choose(fillet, "mode", "POLY")
        return fillet.outputs[0]

    def slab(self, outline, thick):
        """An outline made solid: a flat top, a flat bottom, and smooth sides. Its bottom is at height 0."""
        face = self.add("GeometryNodeFillCurve", {"Curve": outline})
        self.choose(face, "mode", "NGONS", label="N-gons")
        raised = self.add("GeometryNodeExtrudeMesh", {"Mesh": face.outputs[0], "Offset Scale": thick})
        smooth = self.add("GeometryNodeSetShadeSmooth", {0: self.out(raised, "Mesh"), "Selection": self.out(raised, "Side")})
        bottom = self.add("GeometryNodeFlipFaces", {"Mesh": face.outputs[0]})
        closed = self.add("GeometryNodeMergeByDistance", {"Geometry": self.join(smooth.outputs[0], bottom.outputs[0]), "Distance": 0.0001})
        return closed.outputs[0]

    def written(self, text, size, material, align="LEFT", weight="medium"):
        """Words as flat geometry lying on the ground, reading along +X from the origin (or up to it, or centred on it)."""
        curves = self.add("GeometryNodeStringToCurves", {"String": text, "Size": size})
        if hasattr(curves, "font"):
            curves.font = typeface(weight)
        else:  # from Blender 5.1 the font is an input of the node
            self.socket(curves, "Font").default_value = typeface(weight)
        self.choose(curves, "align_x", align)
        filled = self.add("GeometryNodeFillCurve", {"Curve": self.out(curves, "Curve Instances")})
        self.choose(filled, "mode", "NGONS", label="N-gons")
        return self.material(filled.outputs[0], material)

    def option(self, node, name, value, label):
        """As choose, for options whose menu label is not simply the value's name."""
        self.choose(node, name, value, label=label)

    def stored(self, geometry, name, value, domain=("POINT", "Point"), kind=("FLOAT_VECTOR", "Vector")):
        """The geometry with a named number (or three) kept on each of its points, for later nodes or for the page."""
        node = self.tree.nodes.new("GeometryNodeStoreNamedAttribute")
        self.option(node, "data_type", *kind)
        self.option(node, "domain", *domain)
        self.tree.links.new(geometry, self.socket(node, "Geometry"))
        self.socket(node, "Name").default_value = name
        target = self.socket(node, "Value")
        if isinstance(value, bpy.types.NodeSocket):
            self.tree.links.new(value, target)
        else:
            target.default_value = value
        return node.outputs[0]

    def named(self, name):
        """A number kept earlier with stored()."""
        node = self.tree.nodes.new("GeometryNodeInputNamedAttribute")
        self.option(node, "data_type", "FLOAT", "Float")
        self.socket(node, "Name").default_value = name
        return self.out(node, "Attribute")

    def place(self):
        """Each point's own x, y and z."""
        position = self.tree.nodes.new("GeometryNodeInputPosition")
        return self.add("ShaderNodeSeparateXYZ", {0: position.outputs[0]}).outputs

    def scaled(self, vector, by):
        return self.add("ShaderNodeVectorMath", {0: vector, "Scale": by}, operation="SCALE").outputs[0]

    def sized(self, geometry, scale, translation):
        return self.add("GeometryNodeTransform", {"Geometry": geometry, "Scale": (scale, scale, scale), "Translation": translation}).outputs[0]



def typeface(weight):
    """One of FONTS, loaded once and packed into the .blend so the file opens anywhere."""
    path = ROOT / "blender" / "fonts" / FONTS[weight]
    font = bpy.data.fonts.load(str(path), check_existing=True)
    if not font.packed_file:
        font.pack()
    return font


# ================================ PARTS: shared by every scene ================================

def ground(net, P):
    """A sheet, and a field of dots on it."""
    m = net.math
    sheet = net.add("GeometryNodeMeshGrid", {"Size X": P["Ground"], "Size Y": P["Ground"], "Vertices X": 2, "Vertices Y": 2})
    count = m("ADD", m("DIVIDE", P["Ground"], P["Dot Pitch"]), 1.0)
    field = net.add("GeometryNodeMeshGrid", {"Size X": P["Ground"], "Size Y": P["Ground"], "Vertices X": count, "Vertices Y": count})
    dot = net.add("GeometryNodeMeshCircle", {"Vertices": 8, "Radius": P["Dot Size"]})
    net.choose(dot, "fill_type", "NGON", label="N-Gon")
    dots = net.add("GeometryNodeInstanceOnPoints", {"Points": field.outputs[0], "Instance": dot.outputs[0]})
    dots = net.only_if(m("GREATER_THAN", P["Dots"], 0.5), net.material(net.moved(dots.outputs[0], (0.0, 0.0, 0.003)), "Dot"))
    return net.join(net.material(sheet.outputs[0], "Ground"), dots)


def ring_mark(net, resolution):
    """The small icon: a ring with a filled centre, lying flat."""
    ring = net.add("GeometryNodeCurvePrimitiveCircle", {"Resolution": resolution, "Radius": 0.11})
    ring = net.material(net.moved(net.tube(net.out(ring, "Curve"), 0.016, sides=8), (0.0, 0.0, 0.016)), "Ink")
    core = net.add("GeometryNodeMeshCircle", {"Vertices": 24, "Radius": 0.042})
    net.choose(core, "fill_type", "NGON", label="N-Gon")
    return net.join(ring, net.material(net.moved(core.outputs[0], (0.0, 0.0, 0.006)), "Ink"))


def tile(net, resolution, material="Tile", thick=0.02):
    """A small rounded square with the ring icon on it. Centred, its bottom at height 0."""
    plate = net.material(net.slab(net.rounded(TILE, TILE, 0.15, net.math("DIVIDE", resolution, 4.0)), thick), material)
    return net.join(plate, net.moved(ring_mark(net, resolution), (0.0, 0.0, thick)))


def chip(net, label, corners):
    """A small dark plate with a word on it. Centred, its bottom at height 0."""
    plate = net.material(net.slab(net.rounded(CHIP[0], CHIP[1], CHIP[1] / 2, corners), CHIP[2]), "Chip")
    words = net.moved(net.written(label, 0.17, "Dim", align="CENTER"), (0.0, -0.06, CHIP[2] + 0.004))
    return net.join(plate, words)


def stroke(net, a, b, radius=0.017):
    line = net.add("GeometryNodeCurvePrimitiveLine", {"Start": a, "End": b})
    return net.tube(net.out(line, "Curve"), radius, sides=8)


def card(net, size, words, resolution, foot=FOOT, outline=0.14):
    """
    The card: a thick rounded slab floating over the ground with an outline under it, and on it a tile, a title
    and a line under it, a tick, a sunk panel with one large figure, and a footer. Centred on the origin.
    `size` gives wide, deep, thick, corner and lift; `words` gives title, subtitle, figure, aside, caption, footer, mark.
    Any of them may be a number (or text) or a parameter of the network.
    """
    m = net.math
    wide, deep, thick, corner, lift = (size[key] for key in ("wide", "deep", "thick", "corner", "lift"))
    corners = m("DIVIDE", resolution, 4.0)                       # segments round one corner
    face = m("ADD", lift, thick)                                 # height of the card's top face
    left = m("ADD", m("MULTIPLY", wide, -0.5), PAD)              # where the card's contents start
    right = m("SUBTRACT", m("MULTIPLY", wide, 0.5), PAD)
    back = m("SUBTRACT", m("MULTIPLY", deep, 0.5), PAD)          # the far edge of the contents

    # The slab. Each of its points is told where on the card it is, and the card's size, for the page to colour it by.
    body = net.slab(net.rounded(wide, deep, corner, corners), thick)
    x, y, z = net.place()
    body = net.stored(body, "_card", net.vector(x, y, m("DIVIDE", z, thick)))
    body = net.stored(body, "_shape", net.vector(m("MULTIPLY", wide, 0.5), m("MULTIPLY", deep, 0.5), corner))
    body = net.material(net.moved(body, net.vector(0, 0, lift)), "Card")
    grown = m("MULTIPLY", outline, 2.0)
    edge = net.rounded(m("ADD", wide, grown), m("ADD", deep, grown), m("ADD", corner, outline), corners)
    edge = net.only_if(m("GREATER_THAN", outline, 0.001), net.tube(edge, 0.011, sides=6))
    edge = net.material(net.moved(edge, (0.0, 0.0, 0.011)), "Outline")

    # On the card. Everything here is laid out flat at height 0 and lifted onto the top face at the end.
    icon = net.moved(tile(net, resolution), net.vector(m("ADD", left, TILE / 2), m("SUBTRACT", back, TILE / 2)))
    words_at = m("ADD", left, TILE + 0.18)
    title = net.moved(net.written(words["title"], 0.27, "Ink", weight="bold"), net.vector(words_at, m("SUBTRACT", back, 0.24), 0.004))
    subtitle = net.moved(net.written(words["subtitle"], 0.155, "Dim"), net.vector(words_at, m("SUBTRACT", back, 0.47), 0.004))

    tick = net.join(stroke(net, (-0.12, 0.0, 0.0), (-0.035, -0.085, 0.0)), stroke(net, (-0.035, -0.085, 0.0), (0.12, 0.09, 0.0)))
    tick = net.only_if(m("GREATER_THAN", wide, 3.4), tick)   # a narrow card has no room for it beside the title
    tick = net.moved(net.material(tick, "Accent"), net.vector(m("SUBTRACT", right, 0.14), m("SUBTRACT", back, 0.25), 0.02))

    # The panel: fills the card between the head strip and the foot strip.
    panel_wide = m("SUBTRACT", wide, INSET * 2)
    panel_deep = m("SUBTRACT", deep, HEAD + foot)
    panel_mid = (foot - HEAD) / 2
    panel = net.slab(net.rounded(panel_wide, panel_deep, m("MAXIMUM", m("SUBTRACT", corner, INSET), 0.08), corners), 0.022)
    panel = net.moved(net.material(panel, "Panel"), (0.0, panel_mid, 0.002))
    inside = 0.028
    figure = net.moved(net.written(words["figure"], 0.58, "Ink", weight="bold"), net.vector(m("ADD", left, 0.02), panel_mid - 0.06, inside))
    aside = net.moved(net.written(words["aside"], 0.3, "Ink", align="RIGHT"), net.vector(m("SUBTRACT", right, 0.02), panel_mid - 0.06, inside))
    caption = net.moved(net.written(words["caption"], 0.15, "Dim"), net.vector(m("ADD", left, 0.02), m("ADD", m("MULTIPLY", panel_deep, -0.5), panel_mid + 0.2), inside))

    foot_at = m("ADD", m("MULTIPLY", deep, -0.5), 0.25)
    footer = net.moved(net.written(words["footer"], 0.155, "Dim"), net.vector(left, foot_at, 0.004))
    mark = net.moved(net.written(words["mark"], 0.155, "Accent", align="RIGHT"), net.vector(right, foot_at, 0.004))

    contents = net.moved(net.join(icon, title, subtitle, tick, panel, figure, aside, caption, footer, mark), net.vector(0, 0, face))
    return net.join(edge, body, contents)


COMMON = [
    ("Dot Pitch", "FLOAT", 0.26, 0.05, "Spacing of the dots on the ground"),
    ("Dot Size", "FLOAT", 0.014, 0.001, "Radius of a dot"),
    ("Ground", "FLOAT", 20.0, 4.0, "Across the dotted ground"),
    ("Resolution", "INT", 64, 8, "Segments round anything curved"),
    ("Dots", "INT", 1, 0, "1 makes the ground's dots as shapes, 0 leaves them out"),
]
# The files for the page are made with Dots at 0: thousands of dots would be most of each file, so the page
# draws them itself from Dot Pitch, Dot Size and Ground. In Blender they are there as shapes.
PAGE_DRAWS = {"Dots": 0}


# ======================================= SCENE: Signal =======================================

SIGNAL_PARAMETERS = [
    ("Card Width", "FLOAT", 3.7, 1.5, "Across the card, metres"),
    ("Card Depth", "FLOAT", 2.9, 1.5, "Front to back of the card"),
    ("Card Thick", "FLOAT", 0.2, 0.01, "Thickness of the card"),
    ("Corner", "FLOAT", 0.42, 0.0, "Radius of the card's corners"),
    ("Float", "FLOAT", 0.22, 0.0, "How high the card floats over the ground"),
    ("Outline", "FLOAT", 0.14, 0.0, "How far outside the card its outline on the ground runs"),
    ("Line", "FLOAT", 0.022, 0.002, "Radius of the glowing line"),
    ("Reach", "FLOAT", 5.2, 1.0, "How far back the line runs"),
    ("Drift", "FLOAT", -2.8, -10.0, "How far sideways the line has moved by its far end"),
    ("Bend", "FLOAT", 2.4, 0.0, "How strongly the line curves"),
    ("Chips", "INT", 2, 0, "Small chips along the line: 0, 1 or 2"),
    *COMMON,
    ("Title", "STRING", "Signal matched", None, "The card's title"),
    ("Subtitle", "STRING", "Routed to the right team", None, "The line under the title"),
    ("Figure", "STRING", "98%", None, "The large figure in the panel"),
    ("Aside", "STRING", "2.4 s", None, "The smaller figure at the panel's right"),
    ("Caption", "STRING", "match confidence", None, "The line under the large figure"),
    ("Footer", "STRING", "13 routed this cycle", None, "The card's bottom line"),
    ("Mark", "STRING", "+12%", None, "The small accent at the bottom right"),
    ("Chip One", "STRING", "Scored", None, "The nearer chip"),
    ("Chip Two", "STRING", "Received", None, "The far chip"),
]


def build_signal(net, P):
    m = net.math
    wide, deep = P["Card Width"], P["Card Depth"]
    corners = m("DIVIDE", P["Resolution"], 4.0)
    face = m("ADD", P["Float"], P["Card Thick"])
    hero = card(
        net,
        {"wide": wide, "deep": deep, "thick": P["Card Thick"], "corner": P["Corner"], "lift": P["Float"]},
        {"title": P["Title"], "subtitle": P["Subtitle"], "figure": P["Figure"], "aside": P["Aside"], "caption": P["Caption"], "footer": P["Footer"], "mark": P["Mark"]},
        P["Resolution"],
        outline=P["Outline"],
    )

    # The line: from the card's far edge, curving away, with a bright node where it meets the card.
    start = net.vector(m("MULTIPLY", wide, 0.16), m("MULTIPLY", deep, 0.5), face)
    path = net.add(
        "GeometryNodeCurvePrimitiveBezierSegment",
        {
            "Resolution": P["Resolution"],
            "Start": start,
            "Start Handle": net.vector(0, P["Bend"], 0),
            "End Handle": net.vector(m("MULTIPLY", P["Drift"], -0.55), m("MULTIPLY", P["Bend"], -0.5), 0),
            "End": net.vector(m("ADD", m("MULTIPLY", wide, 0.16), P["Drift"]), m("ADD", m("MULTIPLY", deep, 0.5), P["Reach"]), face),
        },
    )
    net.choose(path, "mode", "OFFSET")
    path = net.out(path, "Curve")
    line = net.tube(path, P["Line"])
    node = net.add("GeometryNodeMeshUVSphere", {"Segments": 24, "Rings": 12, "Radius": m("MULTIPLY", P["Line"], 3.2)})
    node = net.add("GeometryNodeSetShadeSmooth", {0: net.moved(net.out(node, "Mesh"), start)})
    glow = net.material(net.join(line, node.outputs[0]), "Glow")

    # Chips: small plates the line passes through.
    def on_line(label, where, wanted):
        at = net.add("GeometryNodeSampleCurve", {"Curves": path, "Factor": where})
        net.choose(at, "mode", "FACTOR")
        at.use_all_curves = True
        made = net.moved(net.moved(chip(net, label, corners), (0.0, 0.0, -CHIP[2] / 2)), net.out(at, "Position"))
        return net.only_if(m("GREATER_THAN", P["Chips"], wanted - 0.5), made)

    return net.join(ground(net, P), hero, glow, on_line(P["Chip One"], 0.5, 1), on_line(P["Chip Two"], 1.0, 2))


# ======================================= SCENE: Gateway ======================================

# Where things stand, metres from the hub (x to the right, y away from the viewer), before "Span" stretches them.
SATELLITE = {"wide": 3.4, "deep": 2.5, "thick": 0.2, "corner": 0.42, "lift": 0.22}
CARDS = [   # key, centre, size against the hero card
    ("One", (-5.6, -3.0), 0.56),
    ("Two", (6.0, 3.6), 0.5),
    ("Three", (-6.0, 3.2), 0.44),
]
TILE_AT = (5.0, -2.1)        # the lone tile, near right
NODE_AT = (-2.9, 4.5)         # the small ring with a label on a leader line
SEATED = 0.3               # how far along a line (0–1) the hub's ring still shapes it
ARC_FROM = math.radians(112) # where on the ring the coloured arc begins (0 = right, anticlockwise)
# The bundles of lines: the angle each leaves the hub at, where it ends, the way it is heading there, and how far its curve swings.
BUNDLES = [
    (200, (-4.62, -2.9), (-1.0, 0.0), 2.1),
    (160, (-5.22, 3.1), (-1.0, 0.0), 2.1),
    (22, (5.12, 3.5), (1.0, 0.0), 2.1),
    (-20, (4.95, -2.1), (1.0, 0.0), 1.9),
]

GATEWAY_PARAMETERS = [
    ("Hub Radius", "FLOAT", 1.6, 0.6, "Radius of the round hub in the middle"),
    ("Ring", "FLOAT", 0.026, 0.004, "Thickness of the hub's bright ring"),
    ("Arc", "FLOAT", 0.2, 0.0, "How much of the ring is coloured: 0 none, 1 all of it"),
    ("Dashes", "INT", 22, 0, "Dashes in the inner ring"),
    ("Lines", "INT", 9, 1, "Lines in each bundle"),
    ("Gap", "FLOAT", 0.085, 0.01, "Space between the lines where they leave the hub"),
    ("Loosen", "FLOAT", 1.5, 0.2, "How many times wider the bundle is by its far end"),
    ("Weave", "FLOAT", 0.2, 0.0, "How far the lines wander across each other on the way"),
    ("Wire", "FLOAT", 0.011, 0.001, "Radius of one line"),
    ("Span", "FLOAT", 1.0, 0.5, "How far out everything round the hub stands"),
    *[(name, kind, {"Ground": 70.0, "Dot Pitch": 0.34}.get(name, default), least, about) for name, kind, default, least, about in COMMON],
    ("Title", "STRING", "Every signal,", None, "First line on the hub"),
    ("Title Two", "STRING", "one gateway", None, "Second line on the hub"),
    ("Tag", "STRING", "Live", None, "The chip beside the hub"),
    ("One Title", "STRING", "Inbound", None, "Near-left card: title"),
    ("One Line", "STRING", "Mail, forms, chat", None, "Near-left card: line under the title"),
    ("One Figure", "STRING", "1,284", None, "Near-left card: figure"),
    ("One Caption", "STRING", "signals today", None, "Near-left card: line under the figure"),
    ("Two Title", "STRING", "Routed", None, "Far-right card: title"),
    ("Two Line", "STRING", "To the right team", None, "Far-right card: line under the title"),
    ("Two Figure", "STRING", "98%", None, "Far-right card: figure"),
    ("Two Caption", "STRING", "match confidence", None, "Far-right card: line under the figure"),
    ("Three Title", "STRING", "Scored", None, "Far-left card: title"),
    ("Three Line", "STRING", "By one model", None, "Far-left card: line under the title"),
    ("Three Figure", "STRING", "2.4 s", None, "Far-left card: figure"),
    ("Three Caption", "STRING", "median time", None, "Far-left card: line under the figure"),
    ("Tile Label", "STRING", "Archive", None, "The chip beside the lone tile"),
    ("Node Label", "STRING", "Gateway", None, "The word on the leader line"),
]


def build_gateway(net, P):
    m = net.math
    R, span, res = P["Hub Radius"], P["Span"], P["Resolution"]
    corners = m("DIVIDE", res, 4.0)
    plate_top = 0.03

    def out_at(x, y, z=0.0):
        """A place round the hub, pushed out by Span."""
        return net.vector(m("MULTIPLY", span, x), m("MULTIPLY", span, y), z)

    # ---- The hub: a dark round plate, a bright ring round it with one coloured arc, a dashed ring inside, two lines of words ----
    disc = net.add("GeometryNodeCurvePrimitiveCircle", {"Resolution": m("MULTIPLY", res, 2.0), "Radius": R})
    plate = net.material(net.slab(net.out(disc, "Curve"), plate_top), "Plate")
    sweep = m("MULTIPLY", P["Arc"], math.tau)

    def arc(start, turn, thickness, material):
        curve = net.add("GeometryNodeCurveArc", {"Resolution": m("MULTIPLY", res, 2.0), "Radius": R, "Start Angle": start, "Sweep Angle": turn})
        return net.material(net.tube(net.out(curve, "Curve"), thickness, sides=8), material)

    coloured = net.only_if(m("GREATER_THAN", P["Arc"], 0.005), arc(ARC_FROM, sweep, m("MULTIPLY", P["Ring"], 1.25), "Glow"))
    white = net.only_if(m("LESS_THAN", P["Arc"], 0.995), arc(m("ADD", sweep, ARC_FROM), m("SUBTRACT", math.tau, sweep), P["Ring"], "Ring"))
    ring = net.moved(net.join(coloured, white), net.vector(0, 0, m("ADD", P["Ring"], plate_top)))

    inner = net.add("GeometryNodeCurvePrimitiveCircle", {"Resolution": m("MULTIPLY", m("MAXIMUM", P["Dashes"], 1.0), 12.0), "Radius": m("MULTIPLY", R, 0.86)})
    inner = net.tube(net.out(inner, "Curve"), 0.011, sides=6)
    x, y, _ = net.place()
    turn = m("MULTIPLY", m("DIVIDE", m("ARCTAN2", y, x), math.tau), P["Dashes"])
    gaps = net.tree.nodes.new("GeometryNodeDeleteGeometry")
    net.option(gaps, "domain", "FACE", "Face")
    net.tree.links.new(inner, net.socket(gaps, "Geometry"))
    net.tree.links.new(m("GREATER_THAN", m("FRACT", turn), 0.6), net.socket(gaps, "Selection"))
    dashes = net.only_if(m("GREATER_THAN", P["Dashes"], 0.5), net.material(net.moved(gaps.outputs[0], (0.0, 0.0, plate_top + 0.011)), "Dim"))

    words = net.join(
        net.moved(net.written(P["Title"], 0.3, "Ink", align="CENTER", weight="bold"), (0.0, 0.09, plate_top + 0.004)),
        net.moved(net.written(P["Title Two"], 0.3, "Ink", align="CENTER", weight="bold"), (0.0, -0.32, plate_top + 0.004)),
    )
    tag = net.moved(chip(net, P["Tag"], corners), net.vector(m("MULTIPLY", R, 0.62), m("SUBTRACT", -0.62, R), 0.0))

    # ---- The bundles: one curve from the hub out, copied side by side, each copy pushed a little off the last ----
    def bundle(leaves, end, heading, swing):
        angle = math.radians(leaves)
        outward = (math.cos(angle), math.sin(angle))
        across_start = (-outward[1], outward[0])
        length = math.hypot(*heading)
        heading = (heading[0] / length, heading[1] / length)
        across_end = (-heading[1], heading[0])
        if across_start[0] * across_end[0] + across_start[1] * across_end[1] < 0:  # keep the copies in the same order at both ends
            across_end = (-across_end[0], -across_end[1])
        from_hub = m("ADD", R, 0.03)
        start = net.vector(m("MULTIPLY", from_hub, outward[0]), m("MULTIPLY", from_hub, outward[1]))
        start_handle = net.vector(m("MULTIPLY", m("ADD", from_hub, swing), outward[0]), m("MULTIPLY", m("ADD", from_hub, swing), outward[1]))
        finish = out_at(*end)
        finish_handle = net.add("ShaderNodeVectorMath", {0: finish, 1: (-heading[0] * swing, -heading[1] * swing, 0.0)}, operation="ADD").outputs[0]
        path = net.add("GeometryNodeCurvePrimitiveBezierSegment", {"Resolution": res, "Start": start, "Start Handle": start_handle, "End Handle": finish_handle, "End": finish})
        net.choose(path, "mode", "POSITION")
        copies = net.add("GeometryNodeMeshLine", {"Count": P["Lines"], "Offset": (0.0, 0.0, 0.0)})
        placed = net.add("GeometryNodeInstanceOnPoints", {"Points": copies.outputs[0], "Instance": net.out(path, "Curve")})
        index = net.tree.nodes.new("GeometryNodeInputIndex").outputs[0]
        numbered = net.stored(placed.outputs[0], "line", index, domain=("INSTANCE", "Instance"), kind=("FLOAT", "Float"))
        lines = net.add("GeometryNodeRealizeInstances", {"Geometry": numbered}).outputs[0]

        along = net.out(net.tree.nodes.new("GeometryNodeSplineParameter"), "Factor")
        which = net.named("line")
        from_middle = m("SUBTRACT", which, m("MULTIPLY", m("SUBTRACT", P["Lines"], 1.0), 0.5))
        eased = m("MULTIPLY", m("MULTIPLY", along, along), m("SUBTRACT", 3.0, m("MULTIPLY", along, 2.0)))   # eases out of the hub and into the far end
        gap = m("MULTIPLY", P["Gap"], m("ADD", 1.0, m("MULTIPLY", m("SUBTRACT", P["Loosen"], 1.0), eased)))
        wander = m("MULTIPLY", m("MULTIPLY", P["Weave"], m("SINE", m("MULTIPLY", along, math.pi))), m("SINE", m("ADD", m("MULTIPLY", along, 5.0), m("MULTIPLY", which, 1.9))))
        across = net.add("ShaderNodeMix", {"Factor": eased, "A": (*across_start, 0.0), "B": (*across_end, 0.0)}, data_type="VECTOR")
        offset = net.scaled(net.out(across, "Result"), m("ADD", m("MULTIPLY", from_middle, gap), wander))
        lines = net.add("GeometryNodeSetPosition", {"Geometry": lines, "Offset": offset}).outputs[0]
        # Side by side, the copies would end in a straight row. Draw each one in toward the hub so their ends sit on its ring,
        # following the curve; the pull eases off over the first part of the line.
        x, y, _ = net.place()
        reach = m("SQRT", m("ADD", m("MULTIPLY", x, x), m("MULTIPLY", y, y)))
        held = m("MINIMUM", m("DIVIDE", along, SEATED), 1.0)
        held = m("MULTIPLY", m("MULTIPLY", held, held), m("SUBTRACT", 3.0, m("MULTIPLY", held, 2.0)))
        pull = m("ADD", m("MULTIPLY", m("SUBTRACT", 1.0, held), m("DIVIDE", from_hub, m("MAXIMUM", reach, 0.001))), held)
        seated = net.vector(m("MULTIPLY", x, pull), m("MULTIPLY", y, pull), 0.0)
        # For the page: how far each point ends up from the middle of its bundle ("_off"), so the page can gather the lines into one strand.
        middle = net.add("ShaderNodeVectorMath", {0: net.vector(x, y, 0.0), 1: offset}, operation="SUBTRACT").outputs[0]
        lines = net.stored(lines, "_off", net.add("ShaderNodeVectorMath", {0: seated, 1: middle}, operation="SUBTRACT").outputs[0])
        lines = net.add("GeometryNodeSetPosition", {"Geometry": lines, "Position": seated}).outputs[0]
        lines = net.stored(lines, "_flow", net.vector(along, which, 0.0))   # for the page: how far along its line a point is, and which line

        wires = net.material(net.tube(lines, P["Wire"], sides=8), "Wire")
        ends = net.add("GeometryNodeCurveEndpointSelection", {"Start Size": 1, "End Size": 1})
        port = net.add("GeometryNodeMeshCircle", {"Vertices": 10, "Radius": m("MULTIPLY", P["Wire"], 2.6)})
        net.choose(port, "fill_type", "NGON", label="N-Gon")
        ports = net.add("GeometryNodeInstanceOnPoints", {"Points": lines, "Selection": net.out(ends, "Selection"), "Instance": port.outputs[0]})
        return net.moved(net.join(wires, net.material(net.moved(ports.outputs[0], (0.0, 0.0, 0.012)), "Dim")), (0.0, 0.0, 0.016))

    bundles = net.join(*[bundle(*each) for each in BUNDLES])

    # ---- Round the hub: three small cards, a tile with its chip, and a ring with a word on a leader line ----
    def satellite(key, centre, scale):
        made = card(
            net,
            SATELLITE,
            {"title": P[f"{key} Title"], "subtitle": P[f"{key} Line"], "figure": P[f"{key} Figure"], "aside": "", "caption": P[f"{key} Caption"], "footer": "", "mark": ""},
            res,
            foot=0.22,
        )
        return net.sized(made, scale, out_at(*centre))

    cards = net.join(*[satellite(*each) for each in CARDS])
    lone = net.join(
        net.sized(tile(net, res, material="Chip", thick=0.07), 1.9, out_at(TILE_AT[0] + 0.5, TILE_AT[1])),
        net.sized(chip(net, P["Tile Label"], corners), 0.8, out_at(TILE_AT[0] + 0.5, TILE_AT[1] - 0.95)),
    )
    leader = net.join(
        ring_mark(net, res),
        net.material(net.join(stroke(net, (0.12, 0.12, 0.012), (0.5, 0.5, 0.012), 0.008), stroke(net, (0.5, 0.5, 0.012), (1.55, 0.5, 0.012), 0.008)), "Dim"),
        net.moved(net.written(P["Node Label"], 0.19, "Dim"), (0.56, 0.6, 0.004)),
    )
    leader = net.moved(leader, out_at(*NODE_AT))

    return net.join(ground(net, P), plate, ring, dashes, words, tag, bundles, cards, lone, leader)


SCENES = [
    {
        "name": "signal",
        "title": "Signal",
        "note": "One card, one line, one figure. Everything in the picture, the words included, comes out of a single node network.",
        "parameters": SIGNAL_PARAMETERS,
        "build": build_signal,
        "span": 18.0,   # how much of the ground, round the middle, has its light worked out
        # The same network with different numbers and words. Each becomes one file the page can show.
        "variants": [
            {"name": "wide", "title": "Wide", "set": {}},
            {
                "name": "tall",
                "title": "Tall",
                "set": {"Card Width": 2.9, "Card Depth": 3.7, "Corner": 0.5, "Drift": 2.6, "Title": "Model ready", "Subtitle": "Connected to account 4", "Figure": "4o", "Aside": "mini", "Caption": "chosen for this step", "Footer": "3 steps use this model", "Mark": "live", "Chip One": "Model", "Chip Two": "Prompt"},
            },
            {
                "name": "quiet",
                "title": "Quiet",
                "set": {"Card Width": 4.4, "Card Depth": 2.9, "Corner": 0.7, "Chips": 0, "Dot Pitch": 0.4, "Reach": 6.5, "Drift": -1.2, "Bend": 3.0, "Title": "Meeting booked", "Subtitle": "Retry mail converted", "Figure": "30 Jun", "Aside": "2:30", "Caption": "thirty minute intro", "Footer": "13 booked this cycle", "Mark": "+21%"},
            },
        ],
    },
    {
        "name": "gateway",
        "title": "Gateway",
        "note": "The same card, chip, tile and dotted ground, set round a hub. Bundles of thin lines carry light in from the cards to the ring.",
        "parameters": GATEWAY_PARAMETERS,
        "build": build_gateway,
        "span": 28.0,
        "variants": [
            {"name": "flow", "title": "Flow", "set": {}},
            {"name": "calm", "title": "Calm", "set": {"Lines": 5, "Gap": 0.11, "Weave": 0.0, "Loosen": 1.0, "Arc": 0.12, "Dashes": 14, "Title": "Three sources,", "Title Two": "one answer"}},
            # "wire" picks how the page draws the lines: as glass tubes (the default), or gathered into one silk strand that fans out at each end.
            {"name": "silk", "title": "Silk", "wire": "silk", "set": {"Lines": 7, "Gap": 0.1, "Weave": 0.0, "Loosen": 1.0, "Arc": 0.14, "Title": "Many threads,", "Title Two": "one strand"}},
            {"name": "dense", "title": "Dense", "set": {"Lines": 15, "Gap": 0.06, "Weave": 0.32, "Loosen": 2.2, "Arc": 0.34, "Hub Radius": 1.8, "Span": 1.06, "Title": "All traffic,", "Title Two": "one protocol"}},
        ],
    },
]


def linear(colour):
    """A colour written the way the page writes it, as Blender's own numbers."""
    parts = [int(colour[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in parts] + [1.0]


def studio():
    """Sets the scene up for working out light: the lamp, the room, and what each material does with light."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = LIGHT["samples"]
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "Standard"
    scene.render.bake.margin = 4
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = LIGHT["quality"]
    scene.render.image_settings.color_mode = "RGB"
    lamp = bpy.data.lights.new("Lamp", "AREA")
    lamp.shape = "DISK"
    lamp.size = LIGHT["lamp_size"]
    lamp.energy = LIGHT["lamp"]
    lamp_object = bpy.data.objects.new("Lamp", lamp)
    lamp_object.location = (0.0, 0.0, LIGHT["lamp_height"])   # a new lamp points straight down
    scene.collection.objects.link(lamp_object)
    world = bpy.data.worlds.new("Room")
    world.use_nodes = True
    background = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    background.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    background.inputs["Strength"].default_value = LIGHT["room"]
    scene.world = world

    def shines(name, strength, colour=None):
        """Makes a material give off light; returns its nodes and the node that does the shining."""
        tree = bpy.data.materials[name].node_tree
        tree.nodes.clear()
        glow = tree.nodes.new("ShaderNodeEmission")
        glow.inputs["Strength"].default_value = strength
        if colour:
            glow.inputs["Color"].default_value = linear(colour)
        tree.links.new(glow.outputs[0], tree.nodes.new("ShaderNodeOutputMaterial").inputs["Surface"])
        return tree, glow

    for material in bpy.data.materials:
        material.use_nodes = True
    for name in UNSEEN:
        tree = bpy.data.materials[name].node_tree
        tree.nodes.clear()
        tree.links.new(tree.nodes.new("ShaderNodeBsdfTransparent").outputs[0], tree.nodes.new("ShaderNodeOutputMaterial").inputs["Surface"])

    for material in bpy.data.materials:
        material.use_nodes = True   # anything not set up below stays plain matt grey: it only blocks and bounces light
    shines("Glow", LIGHT["glow"], SHINES["glow"])
    shines("Ring", LIGHT["ring"], SHINES["ring"])
    shines("Wire", LIGHT["wire"], SHINES["wire"])
    # A card shines with its own gradient: each of its points knows where on the card it is.
    tree, glow = shines("Card", LIGHT["card"])
    where = tree.nodes.new("ShaderNodeAttribute")
    where.attribute_name = "_card"
    size = tree.nodes.new("ShaderNodeAttribute")
    size.attribute_name = "_shape"
    at, half = tree.nodes.new("ShaderNodeSeparateXYZ"), tree.nodes.new("ShaderNodeSeparateXYZ")
    tree.links.new(where.outputs["Vector"], at.inputs[0])
    tree.links.new(size.outputs["Vector"], half.inputs[0])

    def sum_of(operation, a, b):
        node = tree.nodes.new("ShaderNodeMath")
        node.operation = operation
        for socket, value in zip(node.inputs, (a, b)):
            if isinstance(value, bpy.types.NodeSocket):
                tree.links.new(value, socket)
            else:
                socket.default_value = value
        return node.outputs[0]

    across = sum_of("DIVIDE", at.outputs["X"], sum_of("MULTIPLY", half.outputs["X"], 4.0))    # -¼ at the left edge … ¼ at the right
    toward = sum_of("DIVIDE", at.outputs["Y"], sum_of("MULTIPLY", half.outputs["Y"], -4.0))   # -¼ at the far edge … ¼ at the near
    blend = tree.nodes.new("ShaderNodeMix")
    blend.data_type = "RGBA"
    tree.links.new(sum_of("ADD", sum_of("ADD", across, toward), 0.5), blend.inputs["Factor"])
    blend.inputs["A"].default_value = linear(SHINES["card_far"])
    blend.inputs["B"].default_value = linear(SHINES["card_near"])
    tree.links.new(blend.outputs["Result"], glow.inputs["Color"])
    # A card is also a solid thing the lamp falls on, so that its light can be worked out like a chip's.
    matt, both = tree.nodes.new("ShaderNodeBsdfDiffuse"), tree.nodes.new("ShaderNodeAddShader")
    tree.links.new(matt.outputs[0], both.inputs[0])
    tree.links.new(glow.outputs[0], both.inputs[1])
    tree.links.new(both.outputs[0], next(n for n in tree.nodes if n.type == "OUTPUT_MATERIAL").inputs["Surface"])


def unwrapped(shown):
    """Gives the solid parts whose light is worked out (RECEIVES) their own places in a picture; everything else gets none."""
    mesh = shown.data
    mesh.uv_layers.new(name="Light")
    wanted = {index for index, material in enumerate(mesh.materials) if material and material.name in RECEIVES}
    bpy.ops.object.select_all(action="DESELECT")
    shown.select_set(True)
    bpy.context.view_layer.objects.active = shown
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.context.tool_settings.mesh_select_mode = (False, False, True)
    bpy.ops.mesh.select_all(action="DESELECT")
    faces = bmesh.from_edit_mesh(mesh)
    for face in faces.faces:
        face.select = face.material_index in wanted
    faces.select_flush(True)
    bmesh.update_edit_mesh(mesh)
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")
    # Everything else is put at one corner of the picture, out of the way: a new layout starts with every face spread over all of it.
    places = np.zeros(len(mesh.loops) * 2, dtype=np.float32)
    mesh.uv_layers["Light"].data.foreach_get("uv", places)
    places = places.reshape(-1, 2)
    for face in mesh.polygons:
        if face.material_index not in wanted:
            places[face.loop_start:face.loop_start + face.loop_total] = 0.0
    mesh.uv_layers["Light"].data.foreach_set("uv", places.ravel())


def baked(target, size):
    """The light falling on one object, as numbers: a square picture, three colours per point."""
    image = bpy.data.images.new("Light", size, size, float_buffer=True)
    for material in target.data.materials:
        if material is None:   # an empty slot, left by parts that were given no material
            continue
        nodes = material.node_tree.nodes
        node = nodes.get("Bake") or nodes.new("ShaderNodeTexImage")
        node.name = "Bake"
        node.image = image
        nodes.active = node
    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"})
    data = np.array(image.pixels[:], dtype=np.float32).reshape(size, size, 4)
    bpy.data.images.remove(image)
    return data


def saved(data, file):
    """Writes light as a picture, with LIGHT["stored"] as its brightest value."""
    size = data.shape[0]
    data = data.copy()
    data[:, :, :3] = np.clip(data[:, :, :3] / LIGHT["stored"], 0.0, 1.0)
    data[:, :, 3] = 1.0
    image = bpy.data.images.new("Saved", size, size, float_buffer=True)
    image.pixels.foreach_set(data.ravel())
    image.update()
    image.save_render(str(file), scene=bpy.context.scene)
    bpy.data.images.remove(image)


def sheet_of(size, height):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0.0, 0.0, height))
    sheet = bpy.context.active_object
    matt = bpy.data.materials.new("Sheet")
    matt.use_nodes = True
    sheet.data.materials.append(matt)
    return sheet, matt


def light_on_parts(shown, file):
    """Works out the light falling on the scene's solid parts and saves it as a picture laid out by unwrapped()."""
    bpy.context.scene.render.bake.margin = 8
    saved(baked(shown, LIGHT["parts_size"]), file)
    # How bright open, unshaded ground is under the middle of the lamp: the page shows a part at full colour in that much light.
    shown.hide_render = True
    probe, matt = sheet_of(1.0, 0.0)
    bpy.context.scene.render.bake.margin = 0
    open_light = float(baked(probe, 16)[:, :, :3].mean())
    bpy.data.objects.remove(probe)
    bpy.data.materials.remove(matt)
    shown.hide_render = False
    return {"stored": LIGHT["stored"], "open": round(open_light, 4)}


def light_on_ground(span, file):
    """Works out the light falling on a square of ground `span` metres across, round the middle, and saves it as a picture."""
    sheet, matt = sheet_of(span, 0.0005)   # a hair above the scene's own ground
    bpy.context.scene.render.bake.margin = 4
    data = baked(sheet, LIGHT["size"])
    light = data[:, :, :3]
    border = np.concatenate([light[0], light[-1], light[:, 0], light[:, -1]]).mean(axis=0)   # the light out at the picture's edge
    saved(data, file)
    bpy.data.objects.remove(sheet)
    bpy.data.materials.remove(matt)
    return {"span": span, "stored": LIGHT["stored"], "edge": [round(float(v), 4) for v in border]}


def build_network(scene):
    tree = bpy.data.node_groups.new(scene["title"], "GeometryNodeTree")
    kinds = {"INT": "NodeSocketInt", "FLOAT": "NodeSocketFloat", "STRING": "NodeSocketString"}
    for name, kind, default, least, about in scene["parameters"]:
        socket = tree.interface.new_socket(name=name, in_out="INPUT", socket_type=kinds[kind])
        socket.default_value = default
        if least is not None:
            socket.min_value = least
        socket.description = about
    tree.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")

    net = Net(tree)
    given = tree.nodes.new("NodeGroupInput")
    everything = scene["build"](net, {name: given.outputs[name] for name, *_ in scene["parameters"]})
    result = net.add("GeometryNodeRealizeInstances", {"Geometry": everything})
    net.add("NodeGroupOutput", {"Geometry": result.outputs[0]})

    # Lay the nodes out left to right so the tree is readable when opened.
    depth = {}

    def rank(node):
        if node.name not in depth:
            depth[node.name] = 0
            depth[node.name] = 1 + max((rank(link.from_node) for socket in node.inputs for link in socket.links), default=-1)
        return depth[node.name]

    columns = {}
    for node in tree.nodes:
        column = columns.setdefault(rank(node), [])
        node.location = (rank(node) * 220, -len(column) * 170)
        column.append(node)
    return tree


def make(scene):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for name in MATERIALS:
        bpy.data.materials.new(name)
    studio()
    tree = build_network(scene)
    title = scene["title"]
    scene_object = bpy.data.objects.new(title, bpy.data.meshes.new(title))
    bpy.context.scene.collection.objects.link(scene_object)
    modifier = scene_object.modifiers.new(title, "NODES")
    modifier.node_group = tree
    scene_object.hide_render = True   # light is worked out on each variant's finished copy, not on this live one
    sockets = {item.name: item for item in tree.interface.items_tree if item.item_type == "SOCKET" and item.in_out == "INPUT"}
    defaults = {name: default for name, _, default, *_ in scene["parameters"]}

    out = ROOT / "public" / "illustrations" / scene["name"]
    out.mkdir(parents=True, exist_ok=True)
    listed = []
    for variant in scene["variants"]:
        values = {**defaults, **variant["set"]}
        for name, value in {**values, **PAGE_DRAWS}.items():
            modifier[sockets[name].identifier] = value
        scene_object.update_tag()
        graph = bpy.context.evaluated_depsgraph_get()
        graph.update()
        baked = bpy.data.meshes.new_from_object(scene_object.evaluated_get(graph), depsgraph=graph)
        shown = bpy.data.objects.new(title, baked)
        bpy.context.scene.collection.objects.link(shown)
        bpy.ops.object.select_all(action="DESELECT")
        shown.select_set(True)
        bpy.context.view_layer.objects.active = shown
        unwrapped(shown)
        file = out / f"{variant['name']}.glb"
        # export_attributes carries the "_card", "_shape", "_flow" and "_off" numbers to the page.
        bpy.ops.export_scene.gltf(filepath=str(file), use_selection=True, export_apply=False, export_yup=True, export_materials="EXPORT", export_attributes=True)
        print(f"{scene['name']}/{variant['name']}: {len(baked.vertices)} points, {len(baked.polygons)} faces, {file.stat().st_size // 1024} KB, attributes {[a.name for a in baked.attributes if a.name.startswith('_')]}")
        parts = light_on_parts(shown, out / f"{variant['name']}-parts.webp")
        lit = light_on_ground(scene["span"], out / f"{variant['name']}.webp")
        print(f"   light: open ground {parts['open']}, ground edge {lit['edge']}")
        listed.append({
            "name": variant["name"],
            "title": variant["title"],
            "wire": variant.get("wire", "tubes"),
            "version": hashlib.md5(file.read_bytes() + (out / f"{variant['name']}.webp").read_bytes() + (out / f"{variant['name']}-parts.webp").read_bytes()).hexdigest()[:8],
            "ground": lit,
            "parts": parts,
            "values": {name: value for name, value in values.items() if name not in PAGE_DRAWS},
        })
        bpy.data.objects.remove(shown)
        bpy.data.meshes.remove(baked)

    # Leave the file on the first variant's numbers, ready to adjust.
    for name, value in defaults.items():
        modifier[sockets[name].identifier] = value
    scene_object.hide_render = False
    blend = ROOT / "blender" / "illustrations" / f"{scene['name']}.blend"
    blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    return {
        "name": scene["name"],
        "title": title,
        "note": scene["note"],
        "parameters": [{"name": name, "about": about} for name, _, _, _, about in scene["parameters"] if name not in PAGE_DRAWS],
        "variants": listed,
    }


def main():
    manifest = [make(scene) for scene in SCENES]
    target = ROOT / "src" / "illustrations" / "scenes.json"
    target.write_text(json.dumps(manifest, indent=2) + "\n")
    print("wrote", target)


if __name__ == "__main__":
    main()
