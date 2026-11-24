"""
Motion studies for the car screen's sill: how air, fluid and sound might show in a slab of machined metal.
Each study is a short loop rendered in Blender, to choose a direction from before anything is built on the page.

Air
  lines     thin streams of light following the air over three bars, as smoke lines do in a wind tunnel
  smoke     real simulated smoke (Blender's fluid solver) drawn through the same bars
  ribbons   tell-tales: light ribbons fixed at one end, lifted and shaken by a wind, as on a vent
Sound, each shown three times, quiet, middle and loud, so "louder" can be read in a still
  pins      a row of machined pins standing higher and moving more the louder it is, like a level meter
  liquid    a pool of liquid metal whose surface ripples more the louder it is
  string    a taut wire that swings wider the louder it is

Run:  npm run studies -- <name>            one study, as a film in public/studies/<name>.mp4 and a still beside it
      npm run studies -- <name> --still    only the still (quick, for checking)
"""
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "studies"

FILM = {"wide": 960, "tall": 420, "frames": 48, "rate": 24, "samples": 48}
LEVELS = [0.25, 0.6, 1.0]  # quiet, middle, loud
ACROSS = [-1.55, 0.0, 1.55]  # where the three stand on the slab


# ---- The stage every study shares ---------------------------------------------------------------
def material(name, colour, rough=0.4, metal=1.0, glow=None, strength=0.0):
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


def thing(name, mesh, mat=None, at=(0.0, 0.0, 0.0), smooth=True):
    made = bpy.data.objects.new(name, mesh)
    made.location = at
    bpy.context.scene.collection.objects.link(made)
    if mat:
        mesh.materials.append(mat)
    for face in mesh.polygons:
        face.use_smooth = smooth
    return made


def shape(name, build):
    bm = bmesh.new()
    build(bm)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


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
    scene.render.resolution_x, scene.render.resolution_y = FILM["wide"], FILM["tall"]
    scene.render.fps = FILM["rate"]
    scene.frame_start, scene.frame_end = 1, FILM["frames"]
    scene.render.engine = "CYCLES"
    scene.cycles.samples = FILM["samples"]
    scene.cycles.use_denoising = True
    try:  # the graphics card, where there is one
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for device in prefs.devices:
            device.use = True
        scene.cycles.device = "GPU"
    except Exception as problem:  # noqa: BLE001
        print("rendering on the processor:", problem)
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("Room")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.014, 0.016, 1.0)
    scene.world = world

    metal = material("Slab", (0.045, 0.05, 0.056), rough=0.36)
    thing("Slab", shape("Slab", lambda bm: bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=14.0)), metal, smooth=False)
    # Long soft lamps: one behind and to the left, so relief reads; a weak one in front to open the shadows.
    lamp("Key", (-0.8, 5.0, 4.4), (15.0, 1.1), 1500.0)
    lamp("Fill", (0.5, -6.0, 3.2), (9.0, 3.0), 170.0)
    eye = bpy.data.objects.new("Eye", bpy.data.cameras.new("Eye"))
    eye.data.lens = 62
    eye.location = (0.0, -7.4, 4.3)
    eye.rotation_euler = (Vector((0.0, 0.1, 0.25)) - Vector(eye.location)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(eye)
    scene.camera = eye
    return scene


def bar(name, x, mat, radius=0.16, long=3.2):
    """A round bar lying across the air's path."""

    def build(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=radius, radius2=radius, depth=long)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, "X"))

    return thing(name, shape(name, build), mat, at=(x, 0.0, radius * 0.55))


BARS = [-1.6, 0.0, 1.6]


def time_value(tree, per_loop=1.0):
    """A number in a material that runs from 0 to `per_loop` over the film, so a moving pattern comes round exactly."""
    value = tree.nodes.new("ShaderNodeValue")
    curve = value.outputs[0].driver_add("default_value")
    curve.driver.expression = f"(frame - 1) / {FILM['frames']} * {per_loop}"
    return value.outputs[0]


# ---- Air ------------------------------------------------------------------------------------------
def lines(scene):
    """Streams of light that rise over each bar and settle again, with brighter runs travelling along them."""
    steel = material("Bar", (0.09, 0.1, 0.11), rough=0.3)
    for index, x in enumerate(BARS):
        bar(f"Bar {index}", x, steel)

    stream = bpy.data.materials.new("Stream")
    stream.use_nodes = True
    tree = stream.node_tree
    tree.nodes.clear()
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    glow = tree.nodes.new("ShaderNodeEmission")
    glow.inputs["Color"].default_value = (0.622, 0.88, 1.0, 1.0)
    where = tree.nodes.new("ShaderNodeUVMap")
    split = tree.nodes.new("ShaderNodeSeparateXYZ")
    tree.links.new(where.outputs["UV"], split.inputs[0])
    # brightness = a soft run repeating along the line, moved by time; each line starts somewhere else (its V)
    along = tree.nodes.new("ShaderNodeMath")
    along.operation = "MULTIPLY_ADD"
    along.inputs[1].default_value = 3.0
    tree.links.new(split.outputs["X"], along.inputs[0])
    tree.links.new(split.outputs["Y"], along.inputs[2])
    moved = tree.nodes.new("ShaderNodeMath")
    moved.operation = "SUBTRACT"
    tree.links.new(along.outputs[0], moved.inputs[0])
    tree.links.new(time_value(tree, 2.0), moved.inputs[1])
    wave = tree.nodes.new("ShaderNodeMath")
    wave.operation = "SINE"
    turns = tree.nodes.new("ShaderNodeMath")
    turns.operation = "MULTIPLY"
    turns.inputs[1].default_value = math.tau
    tree.links.new(moved.outputs[0], turns.inputs[0])
    tree.links.new(turns.outputs[0], wave.inputs[0])
    lift = tree.nodes.new("ShaderNodeMapRange")
    lift.inputs["From Min"].default_value = -1.0
    lift.inputs["To Min"].default_value = 0.15
    lift.inputs["To Max"].default_value = 5.0
    tree.links.new(wave.outputs[0], lift.inputs["Value"])
    tree.links.new(lift.outputs["Result"], glow.inputs["Strength"])
    tree.links.new(glow.outputs[0], out.inputs["Surface"])

    random.seed(4)

    def build(bm):
        uv = bm.loops.layers.uv.new("UVMap")
        for row in range(26):
            y = -1.45 + 2.9 * row / 25
            base = 0.07 + 0.3 * random.random()
            start = random.random()
            points = []
            for step in range(161):
                x = -3.6 + 7.2 * step / 160
                # over each bar the air lifts, the more so the nearer the slab it runs; behind it, it wavers a little
                rise = sum(math.exp(-(((x - at) / 0.36) ** 2)) for at in BARS) * 0.3 * math.exp(-base * 2.2)
                wake = sum(math.exp(-(((x - at - 0.55) / 0.5) ** 2)) for at in BARS) * 0.03 * math.sin(x * 9.0 + row)
                points.append((x, y, base + rise + wake, step / 160))
            half = 0.007
            previous = None
            for x, y, z, u in points:
                pair = (bm.verts.new((x, y - half, z)), bm.verts.new((x, y + half, z)))
                if previous:
                    face = bm.faces.new((previous[0][0], pair[0], pair[1], previous[0][1]))
                    for loop, value in zip(face.loops, (previous[1], u, u, previous[1])):
                        loop[uv].uv = (value, start)
                previous = (pair, u)

    thing("Streams", shape("Streams", build), stream, smooth=False)


def smoke(scene):
    """Real smoke, let out in thin threads and drawn past the bars by the solver."""
    steel = material("Bar", (0.09, 0.1, 0.11), rough=0.3)
    bars = [bar(f"Bar {index}", x, steel) for index, x in enumerate(BARS)]
    for each in bars:
        each.modifiers.new("Fluid", "FLUID").fluid_type = "EFFECTOR"

    box = thing("Air", shape("Air", lambda bm: bmesh.ops.create_cube(bm, size=1.0)), at=(0.0, 0.0, 0.62))
    box.scale = (7.6, 3.2, 1.2)
    box.display_type = "WIRE"
    domain = box.modifiers.new("Fluid", "FLUID")
    domain.fluid_type = "DOMAIN"
    settings = domain.domain_settings
    settings.domain_type = "GAS"
    settings.resolution_max = 96
    settings.alpha = 0.0  # the smoke neither rises nor sinks: it only goes where it is pushed
    settings.beta = 0.0
    settings.vorticity = 0.12
    settings.use_adaptive_domain = False
    settings.cache_type = "ALL"
    settings.cache_frame_start, settings.cache_frame_end = 1, FILM["frames"] + 60
    settings.cache_directory = str(ROOT / "blender" / "cache_smoke")
    for side in ("use_collision_border_front", "use_collision_border_back", "use_collision_border_left", "use_collision_border_right", "use_collision_border_top"):
        setattr(settings, side, False)

    for index in range(9):
        puff = thing(f"Thread {index}", shape("Thread", lambda bm: bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.045)), at=(-3.55, -1.2 + 2.4 * index / 8, 0.16 + 0.07 * (index % 3)))
        flow = puff.modifiers.new("Fluid", "FLUID")
        flow.fluid_type = "FLOW"
        flow.flow_settings.flow_type = "SMOKE"
        flow.flow_settings.flow_behavior = "INFLOW"
        flow.flow_settings.density = 1.0
        flow.flow_settings.use_initial_velocity = True
        flow.flow_settings.velocity_coord = (2.6, 0.0, 0.0)
        puff.hide_render = True
    wind = bpy.data.objects.new("Wind", None)
    wind.location = (-4.5, 0.0, 0.5)
    wind.rotation_euler = (0.0, math.radians(90), 0.0)
    scene.collection.objects.link(wind)
    wind.field.type = "WIND"
    wind.field.strength = 1.6

    haze = bpy.data.materials.new("Smoke")
    haze.use_nodes = True
    tree = haze.node_tree
    tree.nodes.clear()
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    volume = tree.nodes.new("ShaderNodeVolumePrincipled")
    volume.inputs["Color"].default_value = (0.8, 0.9, 1.0, 1.0)
    volume.inputs["Density"].default_value = 26.0
    tree.links.new(volume.outputs[0], out.inputs["Volume"])
    box.data.materials.append(haze)

    bpy.context.view_layer.objects.active = box
    box.select_set(True)
    bpy.ops.fluid.bake_all()
    scene.frame_start, scene.frame_end = 61, 60 + FILM["frames"]  # once the threads have reached the far side


def ribbons(scene):
    """Tell-tales: light ribbons fixed at one end, lifted and shaken by a wind."""
    steel = material("Rail", (0.09, 0.1, 0.11), rough=0.3)
    bar("Rail", -2.6, steel, radius=0.07)
    silk = material("Ribbon", (0.625, 0.86, 0.95), rough=0.5, metal=0.0, glow=(0.6, 0.8, 1.0), strength=0.6)
    for index in range(9):
        y = -1.3 + 2.6 * index / 8

        def build(bm, y=y):
            for step in range(41):
                bm.verts.new((-2.6 + 2.4 * step / 40, y - 0.03, 0.2))
                bm.verts.new((-2.6 + 2.4 * step / 40, y + 0.03, 0.2))
            bm.verts.ensure_lookup_table()
            for step in range(40):
                bm.faces.new((bm.verts[step * 2], bm.verts[step * 2 + 2], bm.verts[step * 2 + 3], bm.verts[step * 2 + 1]))

        ribbon = thing(f"Ribbon {index}", shape("Ribbon", build), silk)
        held = ribbon.vertex_groups.new(name="Held")
        held.add([0, 1], 1.0, "REPLACE")
        cloth = ribbon.modifiers.new("Cloth", "CLOTH")
        cloth.settings.vertex_group_mass = "Held"
        cloth.settings.mass = 0.02
        cloth.settings.air_damping = 2.0
        cloth.settings.bending_stiffness = 0.05
        cloth.point_cache.frame_start, cloth.point_cache.frame_end = 1, 150
        ribbon.modifiers.new("Thick", "SOLIDIFY").thickness = 0.004
    for kind, strength, at in (("WIND", 950.0, (-4.5, 0.0, 0.25)), ("TURBULENCE", 420.0, (0.0, 0.0, 0.4))):
        field = bpy.data.objects.new(kind.title(), None)
        field.location = at
        field.rotation_euler = (0.0, math.radians(84), 0.0)
        scene.collection.objects.link(field)
        field.field.type = kind
        field.field.strength = strength
        if kind == "TURBULENCE":
            field.field.size = 0.6
            field.field.flow = 1.0
            field.field.noise = 2.0
    scene.frame_start, scene.frame_end = 61, 60 + FILM["frames"]  # once they have lifted


# ---- Sound: each shown quiet, middle and loud -------------------------------------------------------
def pins(scene):
    """A row of machined pins. The louder, the higher they stand and the more they move."""
    steel = material("Pin", (0.5, 0.53, 0.56), rough=0.22)
    tip = material("Tip", (0.9, 0.95, 1.0), rough=0.3, metal=0.0, glow=(0.6, 0.95, 0.8), strength=2.0)
    random.seed(7)
    for level, across in zip(LEVELS, ACROSS):
        for index in range(11):
            x = across + (index - 5) * 0.125
            shape_ = 0.45 + 0.55 * math.exp(-(((index - 5) / 3.2) ** 2))  # taller in the middle of the row
            beat, start = random.choice([1, 2, 2, 3]), random.random() * math.tau

            def build(bm):
                bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=0.042, radius2=0.042, depth=1.0)
                bmesh.ops.translate(bm, verts=bm.verts, vec=(0.0, 0.0, -0.5))  # its top is its origin, so it rises out of the slab

            pin = thing("Pin", shape("Pin", build), steel, at=(x, 0.0, 0.0))
            cap = thing("Tip", shape("Tip", lambda bm: bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=0.043, radius2=0.043, depth=0.02)), tip)
            cap.parent = pin
            cap.location = (0.0, 0.0, 0.011)
            for frame in range(1, FILM["frames"] + 2):
                swing = 0.5 + 0.5 * math.sin(math.tau * beat * (frame - 1) / FILM["frames"] + start)
                pin.location.z = 0.03 + level * shape_ * (0.35 + 0.65 * swing) * 0.95
                pin.keyframe_insert("location", index=2, frame=frame)


def liquid(scene):
    """A pool of liquid metal in a ring. The louder, the taller its ripples."""
    rim = material("Rim", (0.09, 0.1, 0.11), rough=0.3)
    mercury = material("Liquid", (0.82, 0.86, 0.9), rough=0.06)
    for level, across in zip(LEVELS, ACROSS):

        torus = bpy.data.meshes.new("Rim")
        bm = bmesh.new()
        segments, around = 96, 14
        loops = []
        for a in range(segments):
            angle = math.tau * a / segments
            loops.append([bm.verts.new(((0.62 + 0.05 * math.cos(math.tau * b / around)) * math.cos(angle), (0.62 + 0.05 * math.cos(math.tau * b / around)) * math.sin(angle), 0.05 * math.sin(math.tau * b / around))) for b in range(around)])
        for a in range(segments):
            for b in range(around):
                bm.faces.new((loops[a][b], loops[(a + 1) % segments][b], loops[(a + 1) % segments][(b + 1) % around], loops[a][(b + 1) % around]))
        bm.to_mesh(torus)
        bm.free()
        thing("Rim", torus, rim, at=(across, 0.0, 0.04))

        def pool(bm):
            bmesh.ops.create_grid(bm, x_segments=140, y_segments=140, size=0.62)
            bmesh.ops.delete(bm, geom=[vert for vert in bm.verts if vert.co.length > 0.6], context="VERTS")

        surface = thing("Pool", shape("Pool", pool), mercury, at=(across, 0.0, 0.05))
        ripple = surface.modifiers.new("Ripple", "WAVE")
        ripple.use_normal = False
        ripple.height = 0.012 + 0.07 * level
        ripple.width = 0.26
        ripple.narrowness = 6.0
        ripple.speed = 0.26 * 2 / FILM["frames"] * 2  # two crests leave the middle each loop
        ripple.time_offset = -200
        ripple.falloff_radius = 0.622


def string(scene):
    """A taut wire between two posts. The louder, the wider it swings."""
    steel = material("Post", (0.09, 0.1, 0.11), rough=0.3)
    wire = material("Wire", (0.9, 0.95, 1.0), rough=0.3, metal=0.0, glow=(0.6, 0.95, 0.8), strength=3.0)
    for level, across in zip(LEVELS, ACROSS):
        for side in (-1, 1):
            thing("Post", shape("Post", lambda bm: bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=0.06, radius2=0.06, depth=0.5)), steel, at=(across + side * 0.622, 0.0, 0.25))

        def build(bm):
            ring = None
            for step in range(81):
                x = -0.622 + 1.44 * step / 80
                here = [bm.verts.new((x, 0.012 * math.cos(math.tau * k / 8), 0.012 * math.sin(math.tau * k / 8))) for k in range(8)]
                if ring:
                    for k in range(8):
                        bm.faces.new((ring[k], here[k], here[(k + 1) % 8], ring[(k + 1) % 8]))
                ring = here

        line = thing("Wire", shape("Wire", build), wire, at=(across, 0.0, 0.42))
        line.shape_key_add(name="Rest")
        bowed = line.shape_key_add(name="Bowed")
        bowed.slider_min, bowed.slider_max = -1.0, 1.0
        for point in bowed.data:
            point.co.z += 0.34 * level * math.sin(math.pi * (point.co.x + 0.622) / 1.44)
        for frame in range(1, FILM["frames"] + 2):
            # one way on one frame, the other way on the next: with the shutter open across both, the wire is seen as the width it sweeps,
            # and that width breathes a little, as a note does
            bowed.value = (1 if frame % 2 else -1) * (0.78 + 0.22 * math.sin(math.tau * 2 * (frame - 1) / FILM["frames"]))
            bowed.keyframe_insert("value", frame=frame)
    scene.render.use_motion_blur = True  # a fast wire is seen as the width it sweeps
    scene.render.motion_blur_shutter = 2.0


STUDIES = {"lines": lines, "smoke": smoke, "ribbons": ribbons, "pins": pins, "liquid": liquid, "string": string}


def main():
    asked = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    name = next((word for word in asked if word in STUDIES), None)
    if not name:
        raise SystemExit(f"which study? one of: {', '.join(STUDIES)}")
    scene = stage()
    STUDIES[name](scene)
    OUT.mkdir(parents=True, exist_ok=True)
    middle = (scene.frame_start + scene.frame_end) // 2
    if name == "ribbons":  # the cloth has to be played through from the start to know where it is
        for frame in range(1, middle + 1):
            scene.frame_set(frame)
    scene.frame_set(middle)
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90
    scene.render.filepath = str(OUT / f"{name}.jpg")
    bpy.ops.render.render(write_still=True)
    print("wrote", scene.render.filepath)
    if "--still" in asked:
        return
    if name == "ribbons":
        scene.frame_set(1)
    frames = ROOT / "blender" / "frames" / name
    scene.render.filepath = str(frames / "f")
    bpy.ops.render.render(animation=True)
    print("frames in", frames)


main()
