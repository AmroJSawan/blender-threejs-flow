"""Builds the demo scene, saves blender/demo.blend and exports public/scene.glb.

Run:  npm run demo
It is only a starting point: open demo.blend, change anything, press Export.
"""

import math
import os
import random
import sys

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import threejs_bridge  # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 320  # the end is recalculated from the camera path below


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


floor = add(bpy.ops.mesh.primitive_plane_add, "Floor", material("Floor", (0.08, 0.09, 0.12), roughness=0.8), size=48, location=(27, 0, 0))
floor.scale = (2.0, 1.0, 1.0)  # long enough for the whole row of experiments

cube = add(bpy.ops.mesh.primitive_cube_add, "Cube", material("Coral", (0.95, 0.35, 0.3), roughness=0.4), size=1.2, location=(-2.4, 0, 0.6))
cube["hover"] = True
cube["label"] = "Cube: hover tag set in Blender"

orb = add(bpy.ops.mesh.primitive_uv_sphere_add, "Orb", material("Blue", (0.1, 0.22, 1.0)), radius=0.8, location=(0, 0, 0.8), segments=128, ring_count=64)
orb["hover"] = True
orb["shader"] = "pulse"
orb["label"] = "Orb: wakes into ripples; hover or press"

ring = add(bpy.ops.mesh.primitive_torus_add, "Ring", material("Gold", (1.0, 0.75, 0.3), metallic=1.0, roughness=0.25), major_radius=0.75, minor_radius=0.22, location=(2.4, 0, 1.1))
ring["hover"] = True
ring["label"] = "Ring: looping Blender animation"
ring["link"] = "https://threejs.org"


def capsule(name, location, radius=0.55, half_length=0.6, tube=0.12, bulge=0.12):
    """A pill-shaped mirror with a glass rim: two meshes under one empty."""
    outline = []  # (x, z, outward x, outward z), standing upright and facing the camera (-Y)
    steps = 48
    for centre, start in ((half_length, 0.0), (-half_length, math.pi)):
        for i in range(steps + 1):
            a = start + math.pi * i / steps
            outline.append((radius * math.cos(a), centre + radius * math.sin(a), math.cos(a), math.sin(a)))
    count = len(outline)

    def mesh_object(suffix, verts, faces, mat):
        mesh = bpy.data.meshes.new(f"{name}_{suffix}")
        mesh.from_pydata(verts, [], faces)
        for poly in mesh.polygons:
            poly.use_smooth = True
        mesh.materials.append(mat)
        obj = bpy.data.objects.new(f"{name}_{suffix}", mesh)
        scene.collection.objects.link(obj)
        return obj

    # Mirror face: concentric rings so it can bulge slightly toward the camera.
    # The bulge is one smooth dome (not tied to the outline), so reflections flow without kinks.
    def dome(x, z):
        return -bulge * (1 - (x / radius) ** 2 * 0.5 - (z / (half_length + radius)) ** 2 * 0.5)

    rings = 32
    verts = [(0.0, dome(0, 0), 0.0)]
    for k in range(1, rings + 1):
        s = k / rings
        verts += [(x * s, dome(x * s, z * s), z * s) for x, z, _, _ in outline]
    faces = [(0, 1 + i, 1 + (i + 1) % count) for i in range(count)]
    for k in range(rings - 1):
        a, b = 1 + k * count, 1 + (k + 1) * count
        faces += [(a + i, b + i, b + (i + 1) % count, a + (i + 1) % count) for i in range(count)]
    mirror = mesh_object("Mirror", verts, faces, material(f"{name}_Mirror", (0.05, 0.35, 1.0), metallic=1.0, roughness=0.05))
    # Exact normals from the dome formula; averaged mesh normals leave faint creases in a mirror.
    slope_x, slope_z = bulge / radius ** 2, bulge / (half_length + radius) ** 2
    mirror.data.normals_split_custom_set_from_vertices([Vector((x * slope_x, -1.0, z * slope_z)).normalized() for x, _, z in verts])

    # Glass rim: a tube swept around the outline.
    sides = 20
    verts = []
    for x, z, nx, nz in outline:
        for j in range(sides):
            a = math.tau * j / sides
            verts.append((x + nx * math.cos(a) * tube, math.sin(a) * tube, z + nz * math.cos(a) * tube))
    faces = []
    for i in range(count):
        for j in range(sides):
            i2, j2 = (i + 1) % count, (j + 1) % sides
            faces.append((i * sides + j, i2 * sides + j, i2 * sides + j2, i * sides + j2))
    glass = mesh_object("Glass", verts, faces, material(f"{name}_Glass", (1.0, 0.05, 0.75), roughness=0.05))

    parent = bpy.data.objects.new(name, None)
    scene.collection.objects.link(parent)
    parent.location = location
    mirror.parent = glass.parent = parent
    mirror["shader"] = "mirror"
    glass["shader"] = "glass"
    return parent


pill = capsule("Capsule", (4.8, 0, 1.55))
pill["hover"] = True
pill["label"] = "Capsule: mirror + glass shaders"


def stack(name, location):
    """Flat 2D line-art style: stepped boxes as single strokes, with a floating lamp on top."""
    parent = bpy.data.objects.new(name, None)
    scene.collection.objects.link(parent)
    parent.location = location

    def child(obj, shader):
        obj.parent = parent
        obj["shader"] = shader
        return obj

    tops = [material(f"{name}_Pink", (1.0, 0.16, 0.42)), material(f"{name}_Blue", (0.36, 0.46, 1.0))]
    z = 0.0
    for index, (width, depth, height) in enumerate(((2.6, 1.5, 0.55), (1.8, 1.15, 0.42), (1.2, 0.85, 0.34), (0.8, 0.6, 0.28))):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z + height / 2))
        box = bpy.context.active_object
        box.name = f"{name}_Step{index + 1}"
        box.scale = (width, depth, height)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)  # real sizes for the outline shader
        box.data.materials.append(tops[index % 2])  # the colour of the step's top face
        child(box, "lineart")
        z += height

    # Lamp: a small pill made by revolving a profile.
    radius, half, around, rows = 0.16, 0.13, 32, 8
    verts, faces = [(0, 0, -half - radius)], []
    for sign in (-1, 1):
        for r in range(rows + 1):
            a = (math.pi / 2) * (r / rows) * 0.98 + 0.01
            a = a - math.pi / 2 if sign < 0 else a
            ring_r, ring_z = radius * math.cos(a), sign * half + radius * math.sin(a)
            verts += [(ring_r * math.cos(math.tau * i / around), ring_r * math.sin(math.tau * i / around), ring_z) for i in range(around)]
    verts.append((0, 0, half + radius))
    ring_count = 2 * (rows + 1)
    faces += [(0, 1 + (i + 1) % around, 1 + i) for i in range(around)]
    for r in range(ring_count - 1):
        a, b = 1 + r * around, 1 + (r + 1) * around
        faces += [(a + i, a + (i + 1) % around, b + (i + 1) % around, b + i) for i in range(around)]
    last, top = 1 + (ring_count - 1) * around, len(verts) - 1
    faces += [(last + i, last + (i + 1) % around, top) for i in range(around)]
    mesh = bpy.data.meshes.new(f"{name}_Lamp")
    mesh.from_pydata(verts, [], faces)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.materials.append(material(f"{name}_Lamp", (1.0, 1.0, 1.0)))
    lamp = bpy.data.objects.new(f"{name}_Lamp", mesh)
    scene.collection.objects.link(lamp)
    child(lamp, "lamp")
    lamp.location = (0, 0, z + 0.42)

    return parent, lamp


tower, lamp = stack("Stack", (7.6, 0, 0))
tower["hover"] = True
tower["label"] = "Stack: 2D line-art shader on 3D boxes"


def box(name, size, location, mat):
    """A box with its real size in the mesh (the outline shaders measure the mesh itself)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def slab(name, half, height, radius, mat, segments=24):
    """A flat rounded square with exact normals, for the "slab" shader."""
    outline = []  # (x, y, outward x, outward y), counter-clockwise seen from above
    inner = half - radius
    for corner, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        for i in range(segments + 1):
            a = (corner + i / segments) * math.pi / 2
            outline.append((sx * inner + radius * math.cos(a), sy * inner + radius * math.sin(a), math.cos(a), math.sin(a)))
    n, top, bottom = len(outline), height / 2, -height / 2
    # Caps and sides use separate vertices so the rim stays a crisp edge.
    verts = [(x, y, top) for x, y, _, _ in outline] + [(x, y, bottom) for x, y, _, _ in outline]
    verts += [(x, y, top) for x, y, _, _ in outline] + [(x, y, bottom) for x, y, _, _ in outline]
    normals = [Vector((0, 0, 1))] * n + [Vector((0, 0, -1))] * n + [Vector((nx, ny, 0)) for _, _, nx, ny in outline] * 2
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
    faces += [(2 * n + i, 3 * n + i, 3 * n + (i + 1) % n, 2 * n + (i + 1) % n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.normals_split_custom_set_from_vertices(normals)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj["shader"] = "slab"
    obj["radius"] = radius
    return obj


def sheet(name, parent, mat, size, cell):
    """Dark drawing paper with a faint grid, lying under a group."""
    bpy.ops.mesh.primitive_plane_add(size=size)
    grid = bpy.context.active_object
    grid.name = f"{name}_Sheet"
    grid.data.materials.append(mat)
    grid.parent = parent
    grid.location = (0, 0, -0.005)
    grid["shader"] = "grid"
    grid["cell"] = cell
    grid["shade"] = 0.92


def module(name, location):
    """Exploded technical drawing: a holographic slab between two ghost wireframes, tied by dashed guides."""
    parent = bpy.data.objects.new(name, None)
    scene.collection.objects.link(parent)
    parent.location = location
    parent.rotation_euler = (0, 0, math.radians(45))  # corner toward the camera, like an isometric drawing

    half, height, radius, gap = 0.7, 0.3, 0.16, 0.5
    line = material(f"{name}_Line", (1.0, 1.0, 1.0))
    levels = [0.16 + height / 2 + i * (height + gap) for i in range(3)]
    parts = []
    for index, z in enumerate(levels):
        part = slab(f"{name}_Level{index + 1}", half, height, radius, line)
        part.parent = parent
        part.location = (0, 0, z)
        if index != 1:
            part["shader"] = "wire"  # the levels above and below are see-through
        parts.append(part)

    # Dashed guides between the three levels.
    lift = 0.08  # how far the top level floats (see Loop_Lift below)
    low, high = levels[0] + height / 2, levels[2] - height / 2 - lift
    for index, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        post = box(f"{name}_Guide{index + 1}", (0.012, 0.012, high - low), (0, 0, 0), line)
        post.parent = parent
        post.location = (sx * half * 0.72, sy * half * 0.72, (low + high) / 2)
        post["shader"] = "dash"
    sheet(name, parent, line, size=5.6, cell=0.7)
    return parent, parts[2], lift


device, device_top, device_lift = module("Module", (10.8, 0, 0.03))
device["hover"] = True
device["label"] = "Module: ghost wireframes + holographic slab"


def blocks(name, location):
    """Blueprint drawing: outlined buildings on a grid, one highlighted with floor lines."""
    parent = bpy.data.objects.new(name, None)
    scene.collection.objects.link(parent)
    parent.location = location
    parent.rotation_euler = (0, 0, math.radians(45))

    white = material(f"{name}_White", (1.0, 1.0, 1.0))
    red = material(f"{name}_Red", (1.0, 0.27, 0.2))
    base = 0.1  # plinth height
    # name, size (x, y, z), centre (x, y), bottom z, material, extra number properties
    parts = [
        ("Plinth", (3.0, 1.7, base), (0, 0), 0.0, white, {}),
        ("West_Low", (0.95, 1.25, 0.6), (-0.9, 0), base, white, {}),
        ("West_High", (0.95, 1.25, 0.55), (-0.9, 0), base + 0.64, white, {}),
        ("Hall", (0.5, 0.55, 0.42), (-0.05, -0.4), base, white, {}),
        ("Wing", (0.5, 0.95, 0.72), (0.0, 0.3), base, white, {}),
        ("Tower_Low", (0.8, 1.2, 1.15), (0.95, 0.1), base, red, {"floors": 12.0}),
        ("Tower_High", (0.8, 1.2, 1.05), (0.95, 0.1), base + 1.2, red, {"floors": 11.0}),
    ]
    for part, size, (x, y), z, mat, numbers in parts:
        obj = box(f"{name}_{part}", size, (0, 0, 0), mat)
        obj.parent = parent
        obj.location = (x, y, z + size[2] / 2)
        obj["shader"] = "blueprint"
        for key, value in numbers.items():
            obj[key] = value

    sheet(name, parent, white, size=7, cell=0.4)
    return parent


district = blocks("Blocks", (14.4, 0, 0.03))
district["hover"] = True
district["label"] = "Blocks: blueprint shader with floor lines"

def halo(name, location, radius=0.85, segments=160, copies=140):
    """A tumbling ring of light with a fading tail: one thin strip, drawn `copies` times by the echo shader."""
    # The strip only carries "where along the ring" (u) and "which side of the line" (v);
    # echo.vert places and widens it on screen.
    verts, uvs = [], []
    for i in range(segments + 1):
        a = math.tau * i / segments
        for side in (0.0, 1.0):
            verts.append((radius * math.cos(a), radius * math.sin(a), (side - 0.5) * 0.002))
            uvs.append((i / segments, side))
    faces = [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(segments)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        layer.data[loop.index].uv = uvs[loop.vertex_index]
    mesh.materials.append(material(f"{name}_Light", (1.0, 1.0, 1.0)))
    ring_of_light = bpy.data.objects.new(f"{name}_Ring", mesh)
    scene.collection.objects.link(ring_of_light)
    ring_of_light["shader"] = "echo"
    ring_of_light["copies"] = float(copies)

    # A soft dark ball behind it, so the light shows up against the bright floor.
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius * 1.45, segments=48, ring_count=24)
    dark = bpy.context.active_object
    dark.name = f"{name}_Shade"
    for poly in dark.data.polygons:
        poly.use_smooth = True
    dark.data.materials.append(material(f"{name}_Shade", (0.0, 0.0, 0.0)))
    dark["shader"] = "shade"
    dark["shade"] = 0.92

    parent = bpy.data.objects.new(name, None)
    scene.collection.objects.link(parent)
    parent.location = location
    ring_of_light.parent = dark.parent = parent
    return parent


orbit = halo("Halo", (18.2, 0, 1.45))
orbit["label"] = "Halo: orbiting ring with a tail of light"


# ---------------------------------------------------------------------------
# Second row of experiments. Shared helpers first.

def build(name, verts, faces, mat, uvs=None, smooth=True, sharp_angle=None):
    """A mesh object from raw points and faces. `uvs` is one (u, v) per vertex."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    if uvs:
        layer = mesh.uv_layers.new(name="UVMap")
        for loop in mesh.loops:
            layer.data[loop.index].uv = uvs[loop.vertex_index]
    for poly in mesh.polygons:
        poly.use_smooth = smooth
    if sharp_angle is not None:
        mesh.set_sharp_from_angle(angle=math.radians(sharp_angle))  # smooth curves, crisp corners
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


def group(name, location, *children):
    parent = bpy.data.objects.new(name, None)
    scene.collection.objects.link(parent)
    parent.location = location
    for child in children:
        child.parent = parent
    return parent


def lathe(name, profile, mat, around=48, closed=False, **options):
    """Spins a profile of (radius, height) points around the vertical axis.
    closed=True joins the last point back to the first (a ring with a solid cross-section)."""
    count = len(profile)
    verts = [(r * math.cos(math.tau * i / around), r * math.sin(math.tau * i / around), z) for i in range(around) for r, z in profile]
    faces = []
    for i in range(around):
        a, b = i * count, ((i + 1) % around) * count
        for j in range(count if closed else count - 1):
            k = (j + 1) % count
            faces.append((a + j, b + j, b + k, a + k))
    return build(name, verts, faces, mat, **options)


def turn(obj, action, frames=385, start=0.0):
    """One full turn around the vertical axis, looping."""
    prefs = bpy.context.preferences.edit
    prefs.keyframe_new_interpolation_type = "LINEAR"
    tilt_x, tilt_y, _ = obj.rotation_euler
    for frame, angle in ((1, start), (frames, start + math.tau)):
        obj.rotation_euler = (tilt_x, tilt_y, angle)
        obj.keyframe_insert("rotation_euler", frame=frame)
    obj.animation_data.action.name = action
    prefs.keyframe_new_interpolation_type = "BEZIER"


ROW = 22.0   # x of the first new element
STEP = 3.8   # distance between elements
reveals = {}  # element name -> objects whose shader uses uProgress (their scroll range is set with the camera path)


# --- Swarm: dots that morph from a ball into a spiral galaxy.
def swarm(name, location, count=9000, radius=0.85):
    rng = random.Random(7)
    golden = math.pi * (3 - math.sqrt(5))
    ball, galaxy = [], []
    for i in range(count):
        z = 1 - 2 * (i + 0.5) / count
        ring_r = math.sqrt(1 - z * z)
        ball.append((radius * ring_r * math.cos(golden * i), radius * ring_r * math.sin(golden * i), radius * z))
        arm = rng.randrange(3)
        r = 0.12 + 1.05 * math.sqrt(rng.random())
        a = arm * math.tau / 3 + r * 3.2 + rng.gauss(0, 0.22)
        galaxy.append((r * math.cos(a), r * math.sin(a), rng.gauss(0, 0.05) * (1.3 - r)))
    # The faces are never drawn (the shader draws the vertices); they only let the mesh export and catch the pointer.
    faces = [(i, i + 1, i + 2) for i in range(0, count, 3)]
    dots = build(name, ball, faces, material(f"{name}_Dots", (0.3, 0.75, 1.0)))
    dots.shape_key_add(name="Basis")
    target = dots.shape_key_add(name="Galaxy")
    tilt = Matrix.Rotation(math.radians(62), 3, "X")  # the disc leans toward the camera
    for i, point in enumerate(galaxy):
        target.data[i].co = tilt @ Vector(point)
    dots.location = location
    dots["shader"] = "particles"
    return dots


cloud = swarm("Swarm", (ROW, 0, 1.3))
cloud["hover"] = True
cloud["label"] = "Swarm: dots that morph between two shapes and dodge your pointer"
reveals["Swarm"] = [cloud]


# --- Field: one pin drawn 324 times; a wave runs through and the pointer raises them.
def field(name, location, columns=18, gap=0.11, pin=(0.07, 0.07, 0.5)):
    plate_size = columns * gap + 0.3
    plate = box(f"{name}_Plate", (plate_size, plate_size, 0.08), (0, 0, 0.04), material(f"{name}_Plate", (0.05, 0.055, 0.08), roughness=0.6))
    rod = box(f"{name}_Pin", pin, (0, 0, 0), material(f"{name}_Pin", (0.28, 0.33, 1.0)))
    rod.data.transform(Matrix.Translation((0, 0, pin[2] / 2)))  # origin at the base, so the shader can stretch it upward
    rod.location = (0, 0, 0.08)
    rod["shader"] = "field"
    rod["copies"] = float(columns * columns)
    rod["columns"] = float(columns)
    rod["gap"] = gap
    parent = group(name, location, plate, rod)
    parent.rotation_euler = (0, 0, math.radians(30))
    return parent


pins = field("Field", (ROW + STEP, 0, 0))
pins["hover"] = True
pins["label"] = "Field: one pin drawn 324 times; point or press to raise them"


# --- Ribbons: three satin strips spiralling upward, with light running along them.
def ribbons(name, location, segments=220, across=4, width=0.17):
    colors = ((1.0, 0.2, 0.5), (1.0, 0.6, 0.12), (0.15, 0.6, 1.0))
    strips = []
    for index, color in enumerate(colors):
        def centre(s):
            a = index * math.tau / 3 + s * math.tau * 1.6
            r = 0.3 + 0.6 * math.sin(math.pi * s) ** 0.8
            return Vector((r * math.cos(a), r * math.sin(a), 0.25 + 2.0 * s + 0.12 * math.sin(math.tau * 2 * s + index))), Vector((math.cos(a), math.sin(a), 0))

        verts, uvs = [], []
        for i in range(segments + 1):
            s = i / segments
            point, outward = centre(s)
            tangent = (centre(min(s + 0.002, 1))[0] - centre(max(s - 0.002, 0))[0]).normalized()
            side = tangent.cross(outward).normalized()
            side.rotate(Matrix.Rotation(math.tau * s, 3, tangent))  # one full twist along the way
            half = width / 2 * max(math.sin(math.pi * s), 0) ** 0.6  # tapers to a point at both ends
            for j in range(across + 1):
                v = j / across
                verts.append(point + side * (v * 2 - 1) * half)
                uvs.append((s, v))
        row = across + 1
        faces = [(i * row + j, (i + 1) * row + j, (i + 1) * row + j + 1, i * row + j + 1) for i in range(segments) for j in range(across)]
        strip = build(f"{name}_{index + 1}", verts, faces, material(f"{name}_{index + 1}", color), uvs=uvs)
        strip["shader"] = "ribbon"
        strip["phase"] = index * 2.1
        strips.append(strip)
    return group(name, location, *strips)


silk = ribbons("Ribbons", (ROW + 2 * STEP, 0, 0))
silk["hover"] = True
silk["label"] = "Ribbons: fluttering strips with travelling light"
turn(silk, "Loop_Swirl", frames=481)


# --- Foil: a knot of iridescent chrome.
def knot(name, location, major=0.62, minor=0.27, tube=0.15, segments=260, sides=20):
    def centre(t):
        r = major + minor * math.cos(3 * t)
        return Vector((r * math.cos(2 * t), r * math.sin(2 * t), minor * math.sin(3 * t)))

    verts = []
    for i in range(segments):
        t = math.tau * i / segments
        point = centre(t)
        tangent = (centre(t + 0.001) - centre(t - 0.001)).normalized()
        outward = point - Vector((major * math.cos(2 * t), major * math.sin(2 * t), 0))  # away from the middle of the torus
        outward = (outward - tangent * outward.dot(tangent)).normalized()
        sideways = tangent.cross(outward)
        verts += [point + (outward * math.cos(math.tau * j / sides) + sideways * math.sin(math.tau * j / sides)) * tube for j in range(sides)]
    faces = []
    for i in range(segments):
        for j in range(sides):
            i2, j2 = (i + 1) % segments, (j + 1) % sides
            faces.append((i * sides + j, i2 * sides + j, i2 * sides + j2, i * sides + j2))
    obj = build(name, verts, faces, material(name, (0.75, 0.78, 0.85), metallic=1.0, roughness=0.1))
    obj.location = location
    obj.rotation_euler = (math.radians(62), 0, 0)
    obj["shader"] = "foil"
    return obj


chrome = knot("Foil", (ROW + 3 * STEP, 0, 1.25))
chrome["hover"] = True
chrome["label"] = "Foil: iridescent chrome reflecting a drawn studio"
turn(chrome, "Loop_Knot", frames=289)


# --- Lens: a glass ball that bends and colour-splits whatever passes behind it.
def lens(name, location, radius=0.62):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=64, ring_count=32)
    ball = bpy.context.active_object
    ball.name = f"{name}_Glass"
    for poly in ball.data.polygons:
        poly.use_smooth = True
    ball.data.materials.append(material(f"{name}_Glass", (0.8, 0.93, 1.0), roughness=0.0))
    ball["shader"] = "lens"

    # Things to look at through the glass: coloured beads and a hoop, circling the ball.
    colors = ((1.0, 0.2, 0.25), (1.0, 0.75, 0.1), (0.2, 0.9, 0.4), (0.1, 0.7, 1.0), (0.8, 0.3, 1.0), (1.0, 0.45, 0.1))
    beads = []
    for index, color in enumerate(colors):
        a = math.tau * index / len(colors)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.14, segments=24, ring_count=12, location=(1.15 * math.cos(a), 1.15 * math.sin(a), 0.35 * math.sin(a * 2)))
        bead = bpy.context.active_object
        bead.name = f"{name}_Bead{index + 1}"
        for poly in bead.data.polygons:
            poly.use_smooth = True
        bead.data.materials.append(material(f"{name}_Bead{index + 1}", color, roughness=0.35))
        beads.append(bead)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.92, minor_radius=0.025, major_segments=96, minor_segments=8)
    hoop = bpy.context.active_object
    hoop.name = f"{name}_Hoop"
    for poly in hoop.data.polygons:
        poly.use_smooth = True
    hoop.data.materials.append(material(f"{name}_Hoop", (1.0, 0.8, 0.4), metallic=1.0, roughness=0.3))
    hoop.rotation_euler = (math.radians(20), 0, 0)
    orbit_group = group(f"{name}_Orbit", (0, 0, 0), hoop, *beads)
    return group(name, location, ball, orbit_group), orbit_group


glass_ball, glass_orbit = lens("Lens", (ROW + 4 * STEP, 0, 1.3))
glass_ball["hover"] = True
glass_ball["label"] = "Lens: glass that bends and splits the scene behind it"
turn(glass_orbit, "Loop_Beads", frames=241)


# --- Toon: comic shading with halftone dots and an ink outline.
bpy.ops.mesh.primitive_monkey_add(size=1.5, location=(ROW + 5 * STEP, 0, 1.1))
monkey = bpy.context.active_object
monkey.name = "Toon"
monkey.modifiers.new("Smooth", "SUBSURF").levels = 2  # applied on export
for poly in monkey.data.polygons:
    poly.use_smooth = True
monkey.data.materials.append(material("Toon", (1.0, 0.5, 0.12)))
monkey["shader"] = "toon"
monkey["outline"] = 3.0
monkey["hover"] = True
monkey["label"] = "Toon: flat tones, halftone shadow, ink outline"


# --- Clay: soft pastel shapes on a plinth.
def clay(name, location):
    def shape(suffix, color, op, position, rotation=(0, 0, 0), bevel=0.0, **kwargs):
        op(location=position, rotation=rotation, **kwargs)
        obj = bpy.context.active_object
        obj.name = f"{name}_{suffix}"
        if bevel:
            rounded = obj.modifiers.new("Round", "BEVEL")
            rounded.width, rounded.segments = bevel, 8
            obj.modifiers.new("Normals", "WEIGHTED_NORMAL")  # keeps the flat faces flat after rounding
        for poly in obj.data.polygons:
            poly.use_smooth = True
        obj.data.materials.append(material(f"{name}_{suffix}", color))
        obj["shader"] = "clay"
        obj["contact"] = 1.0
        return obj

    add_cube, add_ball = bpy.ops.mesh.primitive_cube_add, bpy.ops.mesh.primitive_uv_sphere_add
    add_cone, add_ring, add_tube = bpy.ops.mesh.primitive_cone_add, bpy.ops.mesh.primitive_torus_add, bpy.ops.mesh.primitive_cylinder_add
    parts = [
        shape("Cube", (0.55, 0.9, 0.78), add_cube, (-0.42, 0.1, 0.3), rotation=(0, 0, math.radians(20)), bevel=0.09, size=0.6),
        shape("Ball", (1.0, 0.66, 0.55), add_ball, (0.2, -0.38, 0.27), radius=0.27, segments=48, ring_count=24),
        shape("Cone", (0.78, 0.68, 1.0), add_cone, (0.5, 0.3, 0.4), bevel=0.05, radius1=0.3, radius2=0.03, depth=0.8, vertices=64),
        shape("Ring", (1.0, 0.88, 0.5), add_ring, (-0.3, -0.5, 0.2), rotation=(math.radians(90), 0, math.radians(35)), major_radius=0.14, minor_radius=0.06, major_segments=48, minor_segments=24),
        shape("Post", (0.55, 0.78, 1.0), add_tube, (-0.02, 0.5, 0.45), bevel=0.06, radius=0.14, depth=0.9, vertices=64),
    ]
    plinth = shape("Plinth", (0.93, 0.9, 0.86), add_tube, (0, 0, -0.07), bevel=0.04, radius=1.1, depth=0.14, vertices=96)
    plinth["contact"] = 0.0
    return group(name, location, plinth, *parts)


still_life = clay("Clay", (ROW + 6 * STEP, 0, 0.14))
still_life["hover"] = True
still_life["label"] = "Clay: matte pastel shapes in soft light"
turn(still_life, "Loop_Clay", frames=577, start=math.radians(-20))


# --- Scan: a vase that builds from a wire grid into a solid as you scroll.
vase = lathe("Scan", [(0.0, 0.0), (0.3, 0.0), (0.36, 0.06), (0.52, 0.5), (0.58, 0.9), (0.5, 1.25), (0.3, 1.55), (0.2, 1.75), (0.21, 1.9), (0.32, 2.0)], material("Scan", (0.9, 0.45, 0.26), roughness=0.5))
vase.modifiers.new("Smooth", "SUBSURF").levels = 2
vase.location = (ROW + 7 * STEP, 0, 0.02)
vase["shader"] = "scan"
vase["hover"] = True
vase["label"] = "Scan: a glowing line builds the object from a wire grid"
turn(vase, "Loop_Vase", frames=481)
reveals["Scan"] = [vase]


# --- Assembly: an exploded view driven by scroll. Ordinary Blender keyframes, no shader needed.
def assembly(name, location, gap=0.42):
    metal = lambda suffix, color, rough=0.35: material(f"{name}_{suffix}", color, metallic=1.0, roughness=rough)  # noqa: E731
    # name, material, cross-section as (radius, position along the axis) points, shader
    specs = [
        ("Cap", metal("Dark", (0.08, 0.09, 0.11)), [(0.0, 0.0), (0.5, 0.0), (0.56, 0.05), (0.56, 0.12), (0.0, 0.12)], None),
        ("Gear", metal("Gold", (1.0, 0.72, 0.3), 0.25), [(0.44, 0.0), (0.62, 0.0), (0.62, 0.14), (0.44, 0.14)], None),
        ("Barrel", metal("Red", (0.85, 0.12, 0.14), 0.3), [(0.42, 0.0), (0.5, 0.0), (0.5, 0.5), (0.42, 0.5)], None),
        ("Glass", material(f"{name}_Glass", (0.2, 0.55, 1.0), roughness=0.05), [(0.0, 0.0), (0.3, 0.02), (0.4, 0.05), (0.3, 0.08), (0.0, 0.1)], "glass"),
        ("Iris", metal("Dark2", (0.06, 0.06, 0.08), 0.5), [(0.28, 0.0), (0.52, 0.0), (0.52, 0.08), (0.28, 0.08)], None),
        ("Front", metal("Silver", (0.8, 0.82, 0.86), 0.2), [(0.44, 0.0), (0.58, 0.0), (0.6, 0.16), (0.48, 0.16)], None),
    ]
    lengths = [max(z for _, z in profile) for _, _, profile, _ in specs]
    total = sum(lengths)
    parts, along = [], -total / 2
    lay_down = Matrix.Rotation(math.radians(90), 4, "Y")  # the spin axis becomes the group's X axis
    for index, (suffix, mat, profile, shader) in enumerate(specs):
        part = lathe(f"{name}_{suffix}", profile, mat, around=64, closed=profile[0][0] > 0, sharp_angle=35)
        part.data.transform(lay_down)
        if shader:
            part["shader"] = shader
        rest = along
        apart = rest + (index - (len(specs) - 1) / 2) * gap
        part.location = (rest, 0, 0)
        parts.append((part, rest, apart))
        along += lengths[index]
    # A dashed centre line as long as the exploded stack.
    reach = total + gap * (len(specs) - 1) + 0.3
    axis = box(f"{name}_Axis", (0.012, 0.012, reach), (0, 0, 0), material(f"{name}_Line", (1.0, 1.0, 1.0)))
    axis.rotation_euler = (0, math.radians(90), 0)
    axis["shader"] = "dash"
    parent = group(name, location, axis, *(part for part, _, _ in parts))
    parent.rotation_euler = (0, math.radians(-14), math.radians(28))
    return parent, parts


lens_kit, lens_parts = assembly("Assembly", (ROW + 8 * STEP, 0, 1.25))
lens_kit["hover"] = True
lens_kit["label"] = "Assembly: exploded view made with plain Blender keyframes"


# --- Contours: an island cut into level bands that lift apart on scroll.
def island(name, location, size=2.4, cells=96, height=0.9, slices=14):
    peaks = ((0.25, 0.1, 1.0, 0.42), (-0.5, -0.35, 0.62, 0.33), (0.55, -0.55, 0.45, 0.28), (-0.3, 0.6, 0.5, 0.3))
    verts = []
    for iy in range(cells + 1):
        for ix in range(cells + 1):
            x, y = (ix / cells - 0.5) * size, (iy / cells - 0.5) * size
            z = sum(h * math.exp(-((x - px) ** 2 + (y - py) ** 2) / (2 * spread ** 2)) for px, py, h, spread in peaks)
            z += 0.035 * math.sin(x * 9) * math.sin(y * 8)
            shore = max(0.0, 1 - (math.hypot(x, y) / (size * 0.5)) ** 4)  # sinks to sea level toward the border
            verts.append((x, y, max(z, 0) * shore * height))
    row = cells + 1
    faces = [(iy * row + ix, iy * row + ix + 1, (iy + 1) * row + ix + 1, (iy + 1) * row + ix) for iy in range(cells) for ix in range(cells)]
    land = build(f"{name}_Land", verts, faces, material(f"{name}_Land", (1.0, 1.0, 1.0)))
    land["shader"] = "contour"
    land["slices"] = float(slices)
    # A dashed ruler as tall as the fully spread stack (also tells the card view how much room to leave).
    tall = height * 2.6
    ruler = box(f"{name}_Ruler", (0.012, 0.012, tall), (0, 0, 0), material(f"{name}_Line", (1.0, 1.0, 1.0)))
    ruler.location = (-size / 2, -size / 2, tall / 2)
    ruler["shader"] = "dash"
    parent = group(name, location, land, ruler)
    return parent, land


atlas, atlas_land = island("Contours", (ROW + 9 * STEP, 0, 0.05))
atlas["hover"] = True
atlas["label"] = "Contours: an island cut into level bands that lift apart"
turn(atlas, "Loop_Atlas", frames=577, start=math.radians(20))
reveals["Contours"] = [atlas_land]
reveals["Assembly"] = []  # animated with keyframes below, not with a shader

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

prefs.keyframe_new_interpolation_type = "BEZIER"
# The capsule sways so its reflections keep moving.
tilt = math.radians(-35)
for frame, turn in ((1, -22), (61, 22), (121, -22)):
    pill.rotation_euler = (0, tilt, math.radians(turn))
    pill.keyframe_insert("rotation_euler", frame=frame)
pill.animation_data.action.name = "Loop_Sway"

# The lamp floats up and down.
rest = lamp.location.z
for frame, lift in ((1, 0.0), (49, 0.12), (97, 0.0)):
    lamp.location.z = rest + lift
    lamp.keyframe_insert("location", frame=frame)
lamp.animation_data.action.name = "Loop_Float"

# The top level of the module floats.
rest = device_top.location.z
for frame, lift in ((1, 0.0), (61, -device_lift), (121, 0.0)):
    device_top.location.z = rest + lift
    device_top.keyframe_insert("location", frame=frame)
device_top.animation_data.action.name = "Loop_Lift"

# The module and the blocks turn slowly, starting from their isometric pose.
prefs.keyframe_new_interpolation_type = "LINEAR"
for obj, action in ((device, "Loop_Orbit"), (district, "Loop_Survey")):
    for frame, turn in ((1, 0.0), (385, math.tau)):
        obj.rotation_euler = (0, 0, math.radians(45) + turn)
        obj.keyframe_insert("rotation_euler", frame=frame)
    obj.animation_data.action.name = action

# The whole stack turns slowly: one full turn every 16 seconds.
prefs.keyframe_new_interpolation_type = "LINEAR"
tower.rotation_euler = (0, 0, 0)
tower.keyframe_insert("rotation_euler", frame=1)
tower.rotation_euler = (0, 0, math.tau)
tower.keyframe_insert("rotation_euler", frame=385)
tower.animation_data.action.name = "Loop_Turn"
prefs.keyframe_new_interpolation_type = "BEZIER"

# --- Scroll action: the camera path. Any action not named "Loop…" follows the scrollbar.
bpy.ops.object.camera_add()
camera = bpy.context.active_object
camera.name = "Camera"
camera.data.lens = 35
scene.camera = camera
# name of the element that reveals itself there (or None), camera position, point it looks at
shots = [
    (None, (7.9, -25.0, 6.2), (7.9, 0, 0.9)),
    (None, (-4.2, -3.2, 1.6), (-2.4, 0, 0.6)),
    (None, (0.6, -3.4, 1.4), (0, 0, 0.8)),
    (None, (3.6, -3.0, 2.2), (2.4, 0, 1.1)),
    (None, (5.3, -3.3, 1.65), (4.8, 0, 1.55)),
    (None, (7.6, -6.2, 2.9), (7.6, 0, 1.05)),
    (None, (10.8, -4.4, 3.7), (10.8, 0, 1.1)),
    (None, (14.4, -6.2, 5.2), (14.4, 0, 1.0)),
    (None, (18.2, -5.6, 2.3), (18.2, 0, 1.45)),
    ("Swarm", (ROW + 0.4, -5.6, 2.0), (ROW, 0, 1.3)),
    (None, (ROW + STEP - 0.6, -4.6, 3.3), (ROW + STEP, 0, 0.3)),
    (None, (ROW + 2 * STEP + 0.5, -6.4, 2.0), (ROW + 2 * STEP, 0, 1.25)),
    (None, (ROW + 3 * STEP - 0.4, -4.4, 1.7), (ROW + 3 * STEP, 0, 1.25)),
    (None, (ROW + 4 * STEP + 0.3, -5.0, 1.9), (ROW + 4 * STEP, 0, 1.3)),
    (None, (ROW + 5 * STEP - 0.9, -4.6, 1.5), (ROW + 5 * STEP, 0, 1.1)),
    (None, (ROW + 6 * STEP + 0.5, -4.6, 2.4), (ROW + 6 * STEP, 0, 0.5)),
    ("Scan", (ROW + 7 * STEP - 0.4, -5.6, 1.8), (ROW + 7 * STEP, 0, 1.0)),
    ("Assembly", (ROW + 8 * STEP + 0.4, -7.2, 2.3), (ROW + 8 * STEP, 0, 1.25)),
    ("Contours", (ROW + 9 * STEP - 0.3, -6.6, 3.6), (ROW + 9 * STEP, 0, 1.15)),
]
TRAVEL, DWELL = 40, 30  # frames between two stops, and frames the camera lingers while something reveals itself
frame, windows = 1, {}
for index, (reveal, position, look_at) in enumerate(shots):
    if index:
        frame += TRAVEL
    stays = [frame]
    if reveal:
        windows[reveal] = (frame - 10, frame + DWELL)  # starts just before the camera arrives
        frame += DWELL
        stays.append(frame)
    for step, at in enumerate(stays):
        # While lingering, the camera pushes in a little so the picture never stands completely still.
        camera.location = Vector(position).lerp(Vector(look_at), 0.06 * step)
        direction = Vector(look_at) - camera.location
        camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler("XYZ", camera.rotation_euler)
        camera.keyframe_insert("location", frame=at)
        camera.keyframe_insert("rotation_euler", frame=at)
scene.frame_end = frame

# Shader reveals: `from` and `to` are scroll positions (0 = top of the page, 1 = bottom).
for name, (first, last) in windows.items():
    for obj in reveals[name]:
        obj["from"] = (first - 1) / (frame - 1)
        obj["to"] = (last - 1) / (frame - 1)

# Keyframed reveal: the assembly's parts slide apart in the same window.
first, last = windows["Assembly"]
for part, rest, apart in lens_parts:
    for at, x in ((first, rest), (last, apart)):
        part.location.x = x
        part.keyframe_insert("location", frame=at)
    part.location.x = rest
camera.animation_data.action.name = "CameraPath"

threejs_bridge.register()
scene.threejs.export_on_save = False  # export explicitly below
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "demo.blend"))
scene.threejs.export_on_save = True
bpy.ops.wm.save_mainfile()
print("[demo] exported", os.path.abspath(bpy.path.abspath(scene.threejs.filepath)))
