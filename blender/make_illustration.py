"""
Illustrations: an isometric scene built as one Geometry Nodes network.

    npm run illustration

Nothing here is modelled by hand. One node group, "Network", makes the whole scene from the parameters
listed in PARAMETERS; they are the group's inputs, so in Blender they appear on the object's modifier
and can be changed there, and every part follows. Open blender/illustrations/network.blend to do that.

The scene: a ground ruled into cells; a row-and-column field of plates, each carrying solid objects
(towers, tilted panels or tanks, by turn); a hub at the front corner; and the diagram that ties them
together: lines routed from every plate down a channel to a shared bus and on to the hub, a wire-frame
volume marking one plate, and rings round the hub.

Everything sits on one module, the cell. Plates are a whole number of cells wide and a whole number of
cells apart, the hub and the channels sit at cell centres, and the rules fall on plate edges. Keep
"Pitch" even and "Plate" odd and that stays true.

Each plate and the hub has a label card floating over its corner on a leader line. The words on a
card are geometry too, and its figures are written from the parameters: change "Towers" and the card
counts again.

The script writes
    blender/illustrations/network.blend            the node network, to open and adjust
    public/illustrations/network/<variant>.glb     the scene, once per entry in VARIANTS
    src/illustrations/scenes.json                  what the page lists
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parent.parent
NAME = "network"
TITLE = "Network"
NOTE = "A field of plates carrying towers, panels and tanks, wired to a hub. One node network makes all of it from a handful of numbers."

# The exposed parameters: name, kind, default, smallest allowed, what it does.
PARAMETERS = [
    ("Columns", "INT", 3, 1, "Plates across"),
    ("Rows", "INT", 2, 1, "Plates deep"),
    ("Cell", "FLOAT", 0.8, 0.1, "The module everything is measured in, metres"),
    ("Pitch", "INT", 4, 2, "Cells from one plate's centre to the next (keep even)"),
    ("Plate", "INT", 3, 1, "Cells across one plate (keep odd)"),
    ("Plate Height", "FLOAT", 0.14, 0.01, "Thickness of a plate"),
    ("Towers", "INT", 4, 1, "Towers along one side of a tower plate"),
    ("Tower Height", "FLOAT", 1.5, 0.05, "Height of the tallest tower"),
    ("Variation", "FLOAT", 0.65, 0.0, "How much shorter the shortest tower may be, 0 to 1"),
    ("Seed", "INT", 3, 0, "Which shuffle of tower heights"),
    ("Panel Tilt", "FLOAT", 28.0, 0.0, "Tilt of the panels, degrees"),
    ("Tank Height", "FLOAT", 0.9, 0.05, "Height of a tank"),
    ("Hub Radius", "FLOAT", 0.62, 0.1, "Radius of the hub's base"),
    ("Line", "FLOAT", 0.035, 0.002, "Radius of a diagram line"),
    ("Bend", "FLOAT", 0.3, 0.0, "Radius of a line's corners"),
    ("Marked", "INT", 4, 0, "Which plate the wire-frame volume stands on"),
    ("Card Size", "FLOAT", 1.15, 0.0, "Size of the label cards; 0 hides them"),
    ("Card Lift", "FLOAT", 0.55, 0.0, "How far a card floats above the top of the thing it labels"),
    ("Card Turn", "FLOAT", -45.0, -180.0, "Which way the cards face, degrees; -45 faces the isometric view"),
    ("Resolution", "INT", 48, 8, "Segments round anything circular"),
]

# The same network with different numbers. Each becomes one file the page can show.
VARIANTS = [
    {"name": "plan", "title": "Plan", "set": {}},
    {"name": "dense", "title": "Dense", "set": {"Columns": 4, "Rows": 3, "Towers": 6, "Tower Height": 1.1, "Marked": 6, "Seed": 8, "Card Size": 1.0, "Card Lift": 0.45}},
    {"name": "tall", "title": "Tall", "set": {"Columns": 2, "Rows": 2, "Plate": 5, "Pitch": 6, "Towers": 5, "Tower Height": 3.4, "Variation": 0.8, "Tank Height": 1.8, "Marked": 0, "Card Size": 1.6, "Card Lift": 0.6}},
]

MATERIALS = ["Ground", "Rule", "Plate", "Solid", "Line", "Accent", "Card", "Ink"]


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

    def math(self, operation, a, b=0.0, c=0.0):
        return self.add("ShaderNodeMath", {0: a, 1: b, 2: c}, operation=operation).outputs[0]

    def vector(self, x=0.0, y=0.0, z=0.0):
        return self.add("ShaderNodeCombineXYZ", {"X": x, "Y": y, "Z": z}).outputs[0]

    def pick(self, when, a, b):
        """a where `when` is 0, b where it is 1."""
        return self.math("MULTIPLY_ADD", self.math("SUBTRACT", b, a), when, a)

    def material(self, geometry, name):
        return self.add("GeometryNodeSetMaterial", {"Geometry": geometry, "Material": bpy.data.materials[name]}).outputs[0]

    def moved(self, geometry, translation=None, rotation=None):
        inputs = {"Geometry": geometry}
        if translation is not None:
            inputs["Translation"] = translation
        if rotation is not None:
            inputs["Rotation"] = rotation
        return self.add("GeometryNodeTransform", inputs).outputs[0]

    def on_points(self, points, instance, selection=None, scale=None):
        inputs = {"Points": points, "Instance": instance}
        if selection is not None:
            inputs["Selection"] = selection
        if scale is not None:
            inputs["Scale"] = scale
        return self.add("GeometryNodeInstanceOnPoints", inputs).outputs[0]

    def realized(self, geometry):
        return self.add("GeometryNodeRealizeInstances", {"Geometry": geometry}).outputs[0]

    def tube(self, curve, radius, sides=8):
        """A curve given thickness, smooth round its length."""
        profile = self.add("GeometryNodeCurvePrimitiveCircle", {"Resolution": sides, "Radius": radius})
        mesh = self.add("GeometryNodeCurveToMesh", {"Curve": curve, "Profile Curve": self.out(profile, "Curve"), "Fill Caps": True})
        return self.add("GeometryNodeSetShadeSmooth", {0: mesh.outputs[0]}).outputs[0]

    def choose(self, node, name, value, label=None):
        """Sets a node's option, whether this Blender keeps it as a property or as an input."""
        if hasattr(node, name):
            setattr(node, name, value)
        else:
            self.socket(node, name.replace("_", " ").title()).default_value = label or value.replace("_", " ").title()

    def written(self, text, size, material):
        """Words as flat geometry lying in the XY plane, starting at the origin and reading along +X."""
        curves = self.add("GeometryNodeStringToCurves", {"String": text, "Size": size})
        filled = self.add("GeometryNodeFillCurve", {"Curve": self.out(curves, "Curve Instances")})
        self.choose(filled, "mode", "NGONS", label="N-gons")
        return self.material(filled.outputs[0], material)

    def figure(self, pattern, value, decimals=0):
        """The pattern with its # replaced by a number."""
        number = self.add("FunctionNodeValueToString", {"Value": value, "Decimals": decimals})
        return self.add("FunctionNodeReplaceString", {"String": pattern, "Find": "#", "Replace": number.outputs[0]}).outputs[0]

    def field_of_points(self, across, deep, count_x, count_y):
        """count_x × count_y points spread evenly over a rectangle, centred."""
        grid = self.add("GeometryNodeMeshGrid", {"Size X": across, "Size Y": deep, "Vertices X": count_x, "Vertices Y": count_y})
        return self.add("GeometryNodeMeshToPoints", {"Mesh": grid.outputs[0]}).outputs[0]


def build_network():
    for name in MATERIALS:
        bpy.data.materials.new(name)

    tree = bpy.data.node_groups.new("Network", "GeometryNodeTree")
    kinds = {"INT": "NodeSocketInt", "FLOAT": "NodeSocketFloat"}
    for name, kind, default, least, about in PARAMETERS:
        socket = tree.interface.new_socket(name=name, in_out="INPUT", socket_type=kinds[kind])
        socket.default_value = default
        socket.min_value = least
        socket.description = about
    tree.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")

    net = Net(tree)
    given = tree.nodes.new("NodeGroupInput")
    P = {name: given.outputs[name] for name, *_ in PARAMETERS}
    m = net.math

    # ---- Measures, all in metres, all from the cell ----
    cell = P["Cell"]
    pitch = m("MULTIPLY", P["Pitch"], cell)                      # plate centre to plate centre
    plate = m("MULTIPLY", P["Plate"], cell)                      # across one plate
    top = P["Plate Height"]                                      # height of a plate's top face
    hub_at = m("MULTIPLY", pitch, -1.0)                          # the hub's x and y: one pitch out from the first plate
    span_x = m("MULTIPLY", m("SUBTRACT", P["Columns"], 1.0), pitch)
    span_y = m("MULTIPLY", m("SUBTRACT", P["Rows"], 1.0), pitch)
    least = m("MULTIPLY", m("ADD", P["Pitch"], 2.5), m("MULTIPLY", cell, -1.0))   # the ground's near edges: room for the hub and its rings
    reach = m("ADD", m("MULTIPLY", plate, 0.5), cell)            # how far the ground runs past the last plate's centre
    most_x = m("ADD", span_x, reach)
    most_y = m("ADD", span_y, reach)
    size_x = m("SUBTRACT", most_x, least)
    size_y = m("SUBTRACT", most_y, least)
    mid_x = m("MULTIPLY", m("ADD", most_x, least), 0.5)
    mid_y = m("MULTIPLY", m("ADD", most_y, least), 0.5)

    # ---- The sites: one point per plate, the first at the origin ----
    grid = net.add("GeometryNodeMeshGrid", {"Size X": span_x, "Size Y": span_y, "Vertices X": P["Columns"], "Vertices Y": P["Rows"]})
    sites = net.moved(grid.outputs[0], translation=net.vector(m("MULTIPLY", span_x, 0.5), m("MULTIPLY", span_y, 0.5)))
    index = net.add("GeometryNodeInputIndex").outputs[0]
    turn = m("MODULO", index, 3.0)                               # 0 towers, 1 panels, 2 tanks
    is_kind = [m("COMPARE", turn, float(k), 0.1) for k in range(3)]

    # ---- Ground and rules ----
    ground = net.add("GeometryNodeMeshGrid", {"Size X": size_x, "Size Y": size_y, "Vertices X": 2, "Vertices Y": 2})
    ground = net.material(net.moved(ground.outputs[0], translation=net.vector(mid_x, mid_y)), "Ground")
    rule = m("MULTIPLY", P["Line"], 0.5)
    rules = []
    for along_x in (True, False):
        size = size_y if along_x else size_x
        count = m("ADD", m("DIVIDE", size_x if along_x else size_y, cell), 1.0)
        bar = net.add("GeometryNodeMeshCube", {"Size": net.vector(rule, size, rule) if along_x else net.vector(size, rule, rule)})
        line = net.add(
            "GeometryNodeMeshLine",
            {"Count": count, "Start Location": net.vector(least, mid_y) if along_x else net.vector(mid_x, least), "Offset": net.vector(cell, 0, 0) if along_x else net.vector(0, cell, 0)},
        )
        rules.append(net.on_points(line.outputs[0], bar.outputs[0]))
    rules = net.material(net.add("GeometryNodeJoinGeometry", {0: rules}).outputs[0], "Rule")

    # ---- Plates ----
    slab = net.add("GeometryNodeMeshCube", {"Size": net.vector(plate, plate, top)})
    slab = net.moved(slab.outputs[0], translation=net.vector(0, 0, m("MULTIPLY", top, 0.5)))
    plates = net.material(net.on_points(sites, slab), "Plate")

    # ---- Solids, by turn ----
    inner = m("MULTIPLY", plate, 0.76)                           # the part of a plate that things stand on

    # Towers: a square field of boxes on a common base line, each a different height.
    step = m("DIVIDE", inner, P["Towers"])
    spots = net.field_of_points(m("SUBTRACT", inner, step), m("SUBTRACT", inner, step), P["Towers"], P["Towers"])
    spots = net.realized(net.on_points(sites, net.moved(spots, translation=net.vector(0, 0, top)), selection=is_kind[0]))
    unit = net.add("GeometryNodeMeshCube", {"Size": (1.0, 1.0, 1.0)})
    unit = net.moved(unit.outputs[0], translation=(0.0, 0.0, 0.5))    # stands on its base, so scaling makes it taller, not deeper
    chance = net.add("FunctionNodeRandomValue", {"Seed": P["Seed"]}, data_type="FLOAT")
    height = m("MULTIPLY", P["Tower Height"], m("SUBTRACT", 1.0, m("MULTIPLY", P["Variation"], net.out(chance))))
    width = m("MULTIPLY", step, 0.7)
    towers = net.on_points(spots, unit, scale=net.vector(width, width, height))

    # Panels: three rows of tilted slabs.
    tilt = m("RADIANS", P["Panel Tilt"])
    deep = m("MULTIPLY", inner, 0.27)
    panel = net.add("GeometryNodeMeshCube", {"Size": net.vector(m("MULTIPLY", inner, 0.44), deep, m("MULTIPLY", cell, 0.05))})
    lift = m("ADD", m("MULTIPLY", m("MULTIPLY", deep, 0.5), m("SINE", tilt)), m("MULTIPLY", cell, 0.1))
    panel = net.moved(panel.outputs[0], translation=net.vector(0, 0, m("ADD", top, lift)), rotation=net.vector(tilt, 0, 0))
    rows = net.field_of_points(m("MULTIPLY", inner, 0.5), m("MULTIPLY", inner, 0.68), 2, 3)
    panels = net.on_points(sites, net.on_points(rows, panel), selection=is_kind[1])

    # Tanks: four drums.
    radius = m("MULTIPLY", inner, 0.2)
    drum = net.add("GeometryNodeMeshCylinder", {"Vertices": P["Resolution"], "Radius": radius, "Depth": P["Tank Height"]})
    drum_smooth = net.add("GeometryNodeSetShadeSmooth", {0: net.out(drum, "Mesh"), "Selection": net.out(drum, "Side")})
    drum = net.moved(drum_smooth.outputs[0], translation=net.vector(0, 0, m("ADD", top, m("MULTIPLY", P["Tank Height"], 0.5))))
    four = net.field_of_points(m("MULTIPLY", inner, 0.5), m("MULTIPLY", inner, 0.5), 2, 2)
    tanks = net.on_points(sites, net.on_points(four, drum), selection=is_kind[2])

    solids = net.material(net.add("GeometryNodeJoinGeometry", {0: [towers, panels, tanks]}).outputs[0], "Solid")

    # ---- The hub: a base, a raised disc, and rings on the ground ----
    hub_place = net.vector(hub_at, hub_at)
    base_height = m("MULTIPLY", top, 1.6)
    base = net.add("GeometryNodeMeshCylinder", {"Vertices": P["Resolution"], "Radius": P["Hub Radius"], "Depth": base_height})
    base = net.add("GeometryNodeSetShadeSmooth", {0: net.out(base, "Mesh"), "Selection": net.out(base, "Side")})
    base = net.material(net.moved(base.outputs[0], translation=net.vector(0, 0, m("MULTIPLY", base_height, 0.5))), "Plate")
    disc_height = m("MULTIPLY", top, 0.9)
    disc = net.add("GeometryNodeMeshCylinder", {"Vertices": P["Resolution"], "Radius": m("MULTIPLY", P["Hub Radius"], 0.72), "Depth": disc_height})
    disc = net.add("GeometryNodeSetShadeSmooth", {0: net.out(disc, "Mesh"), "Selection": net.out(disc, "Side")})
    disc = net.material(net.moved(disc.outputs[0], translation=net.vector(0, 0, m("ADD", m("MULTIPLY", base_height, 1.7), m("MULTIPLY", disc_height, 0.5)))), "Accent")
    rings = []
    for factor in (1.5, 2.1):
        circle = net.add("GeometryNodeCurvePrimitiveCircle", {"Resolution": P["Resolution"], "Radius": m("MULTIPLY", P["Hub Radius"], factor)})
        rings.append(net.tube(net.out(circle, "Curve"), m("MULTIPLY", P["Line"], 0.6)))
    rings = net.material(net.add("GeometryNodeJoinGeometry", {0: rings}).outputs[0], "Accent")
    hub = net.moved(net.add("GeometryNodeJoinGeometry", {0: [base, disc, rings]}).outputs[0], translation=hub_place)

    # ---- The routes: plate edge → channel → bus → hub, one line per plate ----
    # Four points are dropped on every site, then each is moved to its place along the route by its turn in the four.
    four_points = net.add("GeometryNodeMeshLine", {"Count": 4, "Offset": (0.0, 0.0, 0.0)})
    path = net.realized(net.on_points(sites, four_points.outputs[0]))
    at = net.add("ShaderNodeSeparateXYZ", {0: net.add("GeometryNodeInputPosition").outputs[0]})
    k = m("MODULO", net.add("GeometryNodeInputIndex").outputs[0], 4.0)
    channel = m("SUBTRACT", at.outputs["X"], m("MULTIPLY", pitch, 0.5))
    edge = m("SUBTRACT", at.outputs["X"], m("MULTIPLY", plate, 0.5))
    x = net.pick(m("COMPARE", k, 3.0, 0.1), net.pick(m("COMPARE", k, 0.0, 0.1), channel, edge), hub_at)
    y = net.pick(m("GREATER_THAN", k, 1.5), at.outputs["Y"], hub_at)
    lifted = m("MULTIPLY", P["Line"], 0.9)                       # the line lies on the ground
    path = net.add("GeometryNodeSetPosition", {"Geometry": path, "Position": net.vector(x, y, lifted)})
    path = net.add("GeometryNodeMeshToCurve", {"Mesh": path.outputs[0]})
    path = net.add("GeometryNodeFilletCurve", {"Curve": path.outputs[0], "Radius": P["Bend"], "Limit Radius": True, "Count": m("DIVIDE", P["Resolution"], 4.0)})
    if hasattr(path, "mode"):
        path.mode = "POLY"
        net.socket(path, "Count")  # raises if the count is not in use
    else:
        net.socket(path, "Mode").default_value = "Poly"
    routes = net.material(net.tube(path.outputs[0], P["Line"]), "Line")

    # ---- The marked plate: a wire-frame volume standing on it ----
    place = net.add("GeometryNodeSampleIndex", {"Geometry": sites, "Value": net.add("GeometryNodeInputPosition").outputs[0], "Index": P["Marked"]}, data_type="FLOAT_VECTOR", domain="POINT")
    tall = m("ADD", m("MAXIMUM", P["Tower Height"], P["Tank Height"]), m("MULTIPLY", cell, 0.5))
    wide = m("ADD", plate, m("MULTIPLY", cell, 0.25))
    box = net.add("GeometryNodeMeshCube", {"Size": net.vector(wide, wide, tall)})
    box = net.add("GeometryNodeMeshToCurve", {"Mesh": box.outputs[0]})
    box = net.tube(box.outputs[0], m("MULTIPLY", P["Line"], 0.6))
    box = net.moved(net.moved(box, translation=net.vector(0, 0, m("MULTIPLY", tall, 0.5))), translation=net.out(place))
    marked = net.material(box, "Accent")

    # ---- Label cards: a panel on a leader line over the corner of each plate and of the hub ----
    # A card is drawn flat (x across, y up, facing +z), then stood up, turned to face the view and lifted.
    CARD = (1.95, 0.7, 0.03)        # across, up, thick
    PAD = 0.16

    def card(title, figures, corner, height):
        """One card with its leader, for a thing `height` metres tall whose corner is `corner` metres out from its centre."""
        panel = net.material(net.add("GeometryNodeMeshCube", {"Size": CARD}).outputs[0], "Card")
        stripe = net.add("GeometryNodeMeshCube", {"Size": (0.035, CARD[1], CARD[2] + 0.004)})
        stripe = net.material(net.moved(stripe.outputs[0], translation=(-CARD[0] / 2 + 0.0175, 0.0, 0.0)), "Accent")
        front = CARD[2] / 2 + 0.004
        name = net.moved(net.written(title, 0.22, "Ink"), translation=(-CARD[0] / 2 + PAD, 0.06, front))
        value = net.moved(net.written(figures, 0.18, "Accent"), translation=(-CARD[0] / 2 + PAD, -0.2, front))
        flat = net.add("GeometryNodeJoinGeometry", {0: [panel, stripe, name, value]}).outputs[0]
        flat = net.moved(flat, translation=(CARD[0] / 2, 0.0, 0.0))   # like a flag: the leader runs up the card's left edge
        size = P["Card Size"]
        floats = m("ADD", m("ADD", top, height), P["Card Lift"])
        stood = net.add(
            "GeometryNodeTransform",
            {
                "Geometry": flat,
                "Rotation": net.vector(math.pi / 2, 0, m("RADIANS", P["Card Turn"])),
                "Scale": net.vector(size, size, size),
                "Translation": net.vector(0, 0, m("ADD", floats, m("MULTIPLY", size, CARD[1] / 2))),
            },
        ).outputs[0]
        leader = net.add("GeometryNodeCurvePrimitiveLine", {"Start": net.vector(0, 0, top), "End": net.vector(0, 0, m("ADD", floats, m("MULTIPLY", size, CARD[1])))})
        leader = net.material(net.tube(net.out(leader, "Curve"), m("MULTIPLY", P["Line"], 0.35), sides=6), "Line")
        foot = net.add("GeometryNodeMeshCylinder", {"Vertices": 16, "Radius": m("MULTIPLY", P["Line"], 1.6), "Depth": m("MULTIPLY", P["Line"], 0.8)})
        foot = net.material(net.moved(net.out(foot, "Mesh"), translation=net.vector(0, 0, top)), "Accent")
        whole = net.add("GeometryNodeJoinGeometry", {0: [stood, leader, foot]}).outputs[0]
        whole = net.moved(whole, translation=net.vector(corner, m("MULTIPLY", corner, -1.0), 0))   # the corner nearest the view's right
        shown = net.add("GeometryNodeSwitch", {"Switch": m("GREATER_THAN", size, 0.001), "True": whole}, input_type="GEOMETRY")
        return shown.outputs[0]

    corner = m("MULTIPLY", plate, 0.5)
    cards = [
        net.on_points(sites, card("Towers", net.figure("# units", m("MULTIPLY", P["Towers"], P["Towers"])), corner, P["Tower Height"]), selection=is_kind[0]),
        net.on_points(sites, card("Panels", net.figure("6 units, tilt #", P["Panel Tilt"]), corner, m("MULTIPLY", lift, 2.0)), selection=is_kind[1]),
        net.on_points(sites, card("Tanks", net.figure("4 units, # m high", P["Tank Height"], decimals=1), corner, P["Tank Height"]), selection=is_kind[2]),
        net.moved(card("Hub", net.figure("feeds # plates", m("MULTIPLY", P["Columns"], P["Rows"])), m("MULTIPLY", P["Hub Radius"], 0.7), m("MULTIPLY", base_height, 2.0)), translation=hub_place),
    ]
    cards = net.add("GeometryNodeJoinGeometry", {0: cards}).outputs[0]

    everything = net.add("GeometryNodeJoinGeometry", {0: [ground, rules, plates, solids, hub, routes, marked, cards]})
    result = net.realized(everything.outputs[0])
    net.add("NodeGroupOutput", {"Geometry": result})

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
    mesh = bpy.data.meshes.new("Network")
    scene_object = bpy.data.objects.new("Network", mesh)
    bpy.context.scene.collection.objects.link(scene_object)
    modifier = scene_object.modifiers.new("Network", "NODES")
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
        low = [min(v.co[axis] for v in baked.vertices) for axis in range(3)]
        high = [max(v.co[axis] for v in baked.vertices) for axis in range(3)]
        print(f"{variant['name']}: {len(baked.vertices)} points, {len(baked.polygons)} faces, from {[round(v, 2) for v in low]} to {[round(v, 2) for v in high]}, materials {[mat.name if mat else None for mat in baked.materials]}")
        listed.append({
            "name": variant["name"],
            "title": variant["title"],
            "faces": len(baked.polygons),
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
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(manifest, indent=2) + "\n")
    print("wrote", target)


if __name__ == "__main__":
    main()
