"""three.js Bridge — one-click export from Blender to the three.js project.

Install:  Edit > Preferences > Add-ons > Install from Disk… > pick this file.
Use:      3D viewport > N panel > "three.js" tab.

Headless: Blender --background file.blend --python blender/threejs_bridge.py -- --export public/scene.glb
"""

bl_info = {
    "name": "three.js Bridge",
    "author": "blender-threejs-flow",
    "version": (0, 1, 0),
    "blender": (4, 2, 0),
    "location": "3D Viewport > Sidebar > three.js",
    "description": "Export the scene as GLB for the three.js project and tag objects for hover / shaders",
    "category": "Import-Export",
}

import os
import sys

import bpy
from bpy.app.handlers import persistent

# Custom properties the web side understands (they travel inside the GLB as "extras").
TAGS = {
    "hover": (True, "Reacts to mouse hover and click"),
    "label": ("", "Tooltip text shown on hover"),
    "link": ("", "URL opened on click"),
    "shader": ("", "Fragment shader file name in src/shaders (without .frag)"),
}


def export_scene(filepath, draco=False):
    """Export the current scene as a single .glb. Returns the absolute path."""
    filepath = bpy.path.abspath(filepath)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    wanted = dict(
        filepath=filepath,
        export_format="GLB",
        export_extras=True,        # custom properties -> userData in three.js
        export_cameras=True,
        export_lights=True,
        export_apply=True,         # apply modifiers
        export_animations=True,
        export_yup=True,           # Blender Z-up -> three.js Y-up
        use_visible=True,          # hidden objects stay out of the file
        export_draco_mesh_compression_enable=draco,
        # Blender watts would arrive thousands of times too bright as physical units;
        # COMPAT keeps "Sun strength 3" = three.js intensity 3.
        export_import_convert_lighting_mode="COMPAT",
    )
    # Option names shift between Blender versions; only pass the ones this version has.
    known = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{k: v for k, v in wanted.items() if k in known})
    return filepath


class THREEJS_OT_export(bpy.types.Operator):
    bl_idname = "threejs.export"
    bl_label = "Export to three.js"
    bl_description = "Write the scene to the GLB file the web project loads"

    def execute(self, context):
        settings = context.scene.threejs
        if settings.filepath.startswith("//") and not bpy.data.filepath:
            self.report({"ERROR"}, "Save the .blend first, or set an absolute export path")
            return {"CANCELLED"}
        path = export_scene(settings.filepath, settings.draco)
        self.report({"INFO"}, f"Exported {os.path.basename(path)} ({os.path.getsize(path) / 1024:.0f} KB)")
        return {"FINISHED"}


class THREEJS_OT_tag(bpy.types.Operator):
    bl_idname = "threejs.tag"
    bl_label = "Add Tag"
    bl_description = "Add or remove a three.js custom property on the selected objects"
    bl_options = {"REGISTER", "UNDO"}

    key: bpy.props.StringProperty()
    remove: bpy.props.BoolProperty(default=False)

    def execute(self, context):
        for obj in context.selected_objects:
            if self.remove:
                if self.key in obj:
                    del obj[self.key]
            elif self.key not in obj:
                obj[self.key] = TAGS[self.key][0]
        return {"FINISHED"}


class THREEJS_PT_panel(bpy.types.Panel):
    bl_label = "three.js"
    bl_idname = "THREEJS_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "three.js"

    def draw(self, context):
        layout = self.layout
        settings = context.scene.threejs

        col = layout.column(align=True)
        col.prop(settings, "filepath", text="")
        col.operator("threejs.export", icon="EXPORT")
        layout.prop(settings, "export_on_save")
        layout.prop(settings, "draco")

        obj = context.active_object
        box = layout.box()
        if obj is None:
            box.label(text="Select an object to tag it")
            return
        box.label(text=obj.name, icon="OBJECT_DATA")
        for key in TAGS:
            row = box.row(align=True)
            if key in obj:
                row.prop(obj, f'["{key}"]', text=key)
                op = row.operator("threejs.tag", text="", icon="X")
                op.key, op.remove = key, True
            else:
                op = row.operator("threejs.tag", text=f"Add {key}", icon="ADD")
                op.key, op.remove = key, False


class ThreejsSettings(bpy.types.PropertyGroup):
    filepath: bpy.props.StringProperty(
        name="Export Path",
        description="Where to write the GLB. // means relative to the .blend file",
        default="//../public/scene.glb",
        subtype="FILE_PATH",
    )
    export_on_save: bpy.props.BoolProperty(
        name="Export on Save",
        description="Re-export every time the .blend is saved, so the browser refreshes on Ctrl+S",
        default=True,
    )
    draco: bpy.props.BoolProperty(
        name="Draco Compression",
        description="Smaller geometry. Leave off unless the web loader has a Draco decoder set up",
        default=False,
    )


@persistent
def _export_after_save(_filepath):
    settings = bpy.context.scene.threejs
    if not settings.export_on_save:
        return
    try:
        export_scene(settings.filepath, settings.draco)
    except Exception as error:  # never block a save
        print(f"[three.js Bridge] export failed: {error}")


CLASSES = (ThreejsSettings, THREEJS_OT_export, THREEJS_OT_tag, THREEJS_PT_panel)


def register():
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.Scene.threejs = bpy.props.PointerProperty(type=ThreejsSettings)
    bpy.app.handlers.save_post.append(_export_after_save)


def unregister():
    bpy.app.handlers.save_post.remove(_export_after_save)
    del bpy.types.Scene.threejs
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--export" in args:
        out = os.path.abspath(args[args.index("--export") + 1])
        print(f"[three.js Bridge] exported {export_scene(out, '--draco' in args)}")
    else:
        register()
