"""
Illustrations: a marketing still built as one Geometry Nodes network.

    npm run illustration

Nothing here is modelled by hand. One node group, "Signal", makes the whole scene from the parameters
listed in PARAMETERS; they are the group's inputs, so in Blender they appear on the object's modifier
and can be changed there, and every part follows. Open blender/illustrations/signal.blend to do that.

The scene: one thick rounded card floating over a dotted ground, with a thin outline round it on the
ground. On the card: a small tile with a ring, a title and a line under it, a tick, a sunk panel holding one
large figure, and a footer. A single glowing line leaves the card's far edge and curves away into the
distance through one or two small chips.

The words are parameters too, and are made into geometry by the same network, set in Inter
(blender/fonts, under the SIL Open Font License).
The colour, the glow and the shallow focus are added by the page (src/illustrations/main.ts), by
material name; here there is only shape.

The script writes
    blender/illustrations/signal.blend             the node network, to open and adjust
    public/illustrations/signal/<variant>.glb      the scene, once per entry in VARIANTS
    src/illustrations/scenes.json                  what the page lists
"""
import hashlib
import json
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parent.parent
# The typeface: Inter (SIL Open Font License, see blender/fonts/OFL.txt). Headline words use the heavier one.
FONTS = {"medium": "Inter-Medium.ttf", "bold": "Inter-SemiBold.ttf"}
NAME = "signal"
TITLE = "Signal"
NOTE = "One card, one line, one figure. Everything in the picture, the words included, comes out of a single node network."

# The exposed parameters: name, kind, default, smallest allowed (numbers only), what it does.
PARAMETERS = [
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
    ("Dot Pitch", "FLOAT", 0.26, 0.05, "Spacing of the dots on the ground"),
    ("Dot Size", "FLOAT", 0.014, 0.001, "Radius of a dot"),
    ("Ground", "FLOAT", 20.0, 4.0, "Across the dotted ground"),
    ("Resolution", "INT", 64, 8, "Segments round anything curved"),
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

# The same network with different numbers and words. Each becomes one file the page can show.
VARIANTS = [
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
]

MATERIALS = ["Ground", "Dot", "Outline", "Card", "Panel", "Tile", "Ink", "Dim", "Accent", "Glow", "Chip"]

# The card's own layout, metres. These are proportions of the design rather than things to tune per variant.
PAD = 0.3            # from the card's edge to its contents
TILE = 0.5           # the small square at the top left
HEAD = 1.0           # depth of the strip that holds the tile, title and subtitle
FOOT = 0.62          # depth of the strip that holds the footer
INSET = 0.2          # from the card's edge to the panel
CHIP = (1.5, 0.5, 0.14)  # a chip: across, deep, thick


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


def typeface(weight):
    """One of FONTS, loaded once and packed into the .blend so the file opens anywhere."""
    path = ROOT / "blender" / "fonts" / FONTS[weight]
    font = bpy.data.fonts.load(str(path), check_existing=True)
    if not font.packed_file:
        font.pack()
    return font


def build_network():
    for name in MATERIALS:
        bpy.data.materials.new(name)

    tree = bpy.data.node_groups.new("Signal", "GeometryNodeTree")
    kinds = {"INT": "NodeSocketInt", "FLOAT": "NodeSocketFloat", "STRING": "NodeSocketString"}
    for name, kind, default, least, about in PARAMETERS:
        socket = tree.interface.new_socket(name=name, in_out="INPUT", socket_type=kinds[kind])
        socket.default_value = default
        if least is not None:
            socket.min_value = least
        socket.description = about
    tree.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")

    net = Net(tree)
    given = tree.nodes.new("NodeGroupInput")
    P = {name: given.outputs[name] for name, *_ in PARAMETERS}
    m = net.math

    def half(value):
        return m("MULTIPLY", value, 0.5)

    wide, deep, thick = P["Card Width"], P["Card Depth"], P["Card Thick"]
    corners = m("DIVIDE", P["Resolution"], 4.0)                  # segments round one corner
    face = m("ADD", P["Float"], thick)                           # height of the card's top face
    left = m("ADD", m("MULTIPLY", wide, -0.5), PAD)              # where the card's contents start
    right = m("SUBTRACT", half(wide), PAD)
    back = m("SUBTRACT", half(deep), PAD)                        # the far edge of the contents

    # ---- Ground: a sheet, and a field of dots on it ----
    sheet = net.add("GeometryNodeMeshGrid", {"Size X": P["Ground"], "Size Y": P["Ground"], "Vertices X": 2, "Vertices Y": 2})
    ground = net.material(sheet.outputs[0], "Ground")
    count = m("ADD", m("DIVIDE", P["Ground"], P["Dot Pitch"]), 1.0)
    field = net.add("GeometryNodeMeshGrid", {"Size X": P["Ground"], "Size Y": P["Ground"], "Vertices X": count, "Vertices Y": count})
    dot = net.add("GeometryNodeMeshCircle", {"Vertices": 8, "Radius": P["Dot Size"]})
    net.choose(dot, "fill_type", "NGON", label="N-Gon")
    dots = net.add("GeometryNodeInstanceOnPoints", {"Points": field.outputs[0], "Instance": dot.outputs[0]})
    dots = net.material(net.moved(dots.outputs[0], (0.0, 0.0, 0.003)), "Dot")

    # ---- The card, and its outline on the ground ----
    body = net.slab(net.rounded(wide, deep, P["Corner"], corners), thick)
    body = net.material(net.moved(body, net.vector(0, 0, P["Float"])), "Card")
    grown = m("MULTIPLY", P["Outline"], 2.0)
    outline = net.rounded(m("ADD", wide, grown), m("ADD", deep, grown), m("ADD", P["Corner"], P["Outline"]), corners)
    outline = net.only_if(m("GREATER_THAN", P["Outline"], 0.001), net.tube(outline, 0.011, sides=6))
    outline = net.material(net.moved(outline, (0.0, 0.0, 0.011)), "Outline")

    # ---- On the card. Everything here is laid out flat at height 0 and lifted onto the top face at the end. ----
    # The tile with its ring, top left.
    tile = net.slab(net.rounded(TILE, TILE, 0.15, corners), 0.02)
    ring = net.add("GeometryNodeCurvePrimitiveCircle", {"Resolution": P["Resolution"], "Radius": 0.11})
    ring = net.material(net.moved(net.tube(net.out(ring, "Curve"), 0.016, sides=8), (0.0, 0.0, 0.036)), "Ink")
    core = net.add("GeometryNodeMeshCircle", {"Vertices": 24, "Radius": 0.042})
    net.choose(core, "fill_type", "NGON", label="N-Gon")
    core = net.material(net.moved(core.outputs[0], (0.0, 0.0, 0.026)), "Ink")
    ring = net.join(ring, core)
    tile = net.moved(net.join(net.material(tile, "Tile"), ring), net.vector(m("ADD", left, TILE / 2), m("SUBTRACT", back, TILE / 2)))

    # Title and subtitle, beside the tile.
    words_at = m("ADD", left, TILE + 0.18)
    title = net.moved(net.written(P["Title"], 0.27, "Ink", weight="bold"), net.vector(words_at, m("SUBTRACT", back, 0.24), 0.004))
    subtitle = net.moved(net.written(P["Subtitle"], 0.155, "Dim"), net.vector(words_at, m("SUBTRACT", back, 0.47), 0.004))

    # A tick at the top right.
    def stroke(a, b):
        line = net.add("GeometryNodeCurvePrimitiveLine", {"Start": a, "End": b})
        return net.tube(net.out(line, "Curve"), 0.017, sides=8)

    tick = net.join(stroke((-0.12, 0.0, 0.0), (-0.035, -0.085, 0.0)), stroke((-0.035, -0.085, 0.0), (0.12, 0.09, 0.0)))
    tick = net.only_if(m("GREATER_THAN", wide, 3.4), tick)   # a narrow card has no room for it beside the title
    tick = net.moved(net.material(tick, "Accent"), net.vector(m("SUBTRACT", right, 0.14), m("SUBTRACT", back, 0.25), 0.02))

    # The panel: fills the card between the head strip and the foot strip.
    panel_wide = m("SUBTRACT", wide, INSET * 2)
    panel_deep = m("SUBTRACT", deep, HEAD + FOOT)
    panel_mid = (FOOT - HEAD) / 2
    panel = net.slab(net.rounded(panel_wide, panel_deep, m("MAXIMUM", m("SUBTRACT", P["Corner"], INSET), 0.08), corners), 0.022)
    panel = net.moved(net.material(panel, "Panel"), (0.0, panel_mid, 0.002))
    inside = 0.028
    figure = net.moved(net.written(P["Figure"], 0.58, "Ink", weight="bold"), net.vector(m("ADD", left, 0.02), panel_mid - 0.06, inside))
    aside = net.moved(net.written(P["Aside"], 0.3, "Ink", align="RIGHT"), net.vector(m("SUBTRACT", right, 0.02), panel_mid - 0.06, inside))
    caption = net.moved(net.written(P["Caption"], 0.15, "Dim"), net.vector(m("ADD", left, 0.02), m("ADD", m("MULTIPLY", panel_deep, -0.5), panel_mid + 0.2), inside))

    # The footer and its accent.
    foot_at = m("ADD", m("MULTIPLY", deep, -0.5), 0.25)
    footer = net.moved(net.written(P["Footer"], 0.155, "Dim"), net.vector(left, foot_at, 0.004))
    mark = net.moved(net.written(P["Mark"], 0.155, "Accent", align="RIGHT"), net.vector(right, foot_at, 0.004))

    contents = net.moved(net.join(tile, title, subtitle, tick, panel, figure, aside, caption, footer, mark), net.vector(0, 0, face))

    # ---- The line: from the card's far edge, curving away, with a bright node where it meets the card ----
    start = net.vector(m("MULTIPLY", wide, 0.16), half(deep), face)
    path = net.add(
        "GeometryNodeCurvePrimitiveBezierSegment",
        {
            "Resolution": P["Resolution"],
            "Start": start,
            "Start Handle": net.vector(0, P["Bend"], 0),
            "End Handle": net.vector(m("MULTIPLY", P["Drift"], -0.55), m("MULTIPLY", P["Bend"], -0.5), 0),
            "End": net.vector(m("ADD", m("MULTIPLY", wide, 0.16), P["Drift"]), m("ADD", half(deep), P["Reach"]), face),
        },
    )
    net.choose(path, "mode", "OFFSET")
    path = net.out(path, "Curve")
    line = net.tube(path, P["Line"])
    node = net.add("GeometryNodeMeshUVSphere", {"Segments": 24, "Rings": 12, "Radius": m("MULTIPLY", P["Line"], 3.2)})
    node = net.add("GeometryNodeSetShadeSmooth", {0: net.moved(net.out(node, "Mesh"), start)})
    glow = net.material(net.join(line, node.outputs[0]), "Glow")

    # ---- Chips: small plates the line passes through ----
    def chip(label, where, wanted):
        at = net.add("GeometryNodeSampleCurve", {"Curves": path, "Factor": where})
        net.choose(at, "mode", "FACTOR")
        at.use_all_curves = True
        plate = net.material(net.slab(net.rounded(CHIP[0], CHIP[1], CHIP[1] / 2, corners), CHIP[2]), "Chip")
        words = net.moved(net.written(label, 0.17, "Dim", align="CENTER"), (0.0, -0.06, CHIP[2] + 0.004))
        made = net.moved(net.moved(net.join(plate, words), (0.0, 0.0, -CHIP[2] / 2)), net.out(at, "Position"))
        return net.only_if(m("GREATER_THAN", P["Chips"], wanted - 0.5), made)

    chips = net.join(chip(P["Chip One"], 0.5, 1), chip(P["Chip Two"], 1.0, 2))

    everything = net.join(ground, dots, outline, body, contents, glow, chips)
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


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tree = build_network()
    mesh = bpy.data.meshes.new(TITLE)
    scene_object = bpy.data.objects.new(TITLE, mesh)
    bpy.context.scene.collection.objects.link(scene_object)
    modifier = scene_object.modifiers.new(TITLE, "NODES")
    modifier.node_group = tree
    sockets = {item.name: item for item in tree.interface.items_tree if item.item_type == "SOCKET" and item.in_out == "INPUT"}
    defaults = {name: default for name, _, default, *_ in PARAMETERS}

    out = ROOT / "public" / "illustrations" / NAME
    out.mkdir(parents=True, exist_ok=True)
    listed = []
    for variant in VARIANTS:
        values = {**defaults, **variant["set"]}
        for name, value in values.items():
            modifier[sockets[name].identifier] = value
        scene_object.update_tag()
        graph = bpy.context.evaluated_depsgraph_get()
        graph.update()
        baked = bpy.data.meshes.new_from_object(scene_object.evaluated_get(graph), depsgraph=graph)
        shown = bpy.data.objects.new(TITLE, baked)
        bpy.context.scene.collection.objects.link(shown)
        bpy.ops.object.select_all(action="DESELECT")
        shown.select_set(True)
        bpy.context.view_layer.objects.active = shown
        file = out / f"{variant['name']}.glb"
        bpy.ops.export_scene.gltf(filepath=str(file), use_selection=True, export_apply=False, export_yup=True, export_materials="EXPORT")
        print(f"{variant['name']}: {len(baked.vertices)} points, {len(baked.polygons)} faces, materials {[mat.name if mat else None for mat in baked.materials]}")
        listed.append({
            "name": variant["name"],
            "title": variant["title"],
            "version": hashlib.md5(file.read_bytes()).hexdigest()[:8],
            "values": values,
        })
        bpy.data.objects.remove(shown)
        bpy.data.meshes.remove(baked)

    # Leave the file on the first variant's numbers, ready to adjust.
    for name, value in defaults.items():
        modifier[sockets[name].identifier] = value
    blend = ROOT / "blender" / "illustrations" / f"{NAME}.blend"
    blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))

    manifest = [{
        "name": NAME,
        "title": TITLE,
        "note": NOTE,
        "parameters": [{"name": name, "about": about} for name, _, _, _, about in PARAMETERS],
        "variants": listed,
    }]
    target = ROOT / "src" / "illustrations" / "scenes.json"
    target.write_text(json.dumps(manifest, indent=2) + "\n")
    print("wrote", target)


if __name__ == "__main__":
    main()
