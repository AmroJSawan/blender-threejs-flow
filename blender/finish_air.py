"""
Turns the frames make_air.py rendered into films that loop: the last frames of each are melted into its first,
so the end runs into the start with no jump. Run by `npm run air` after Blender has finished.
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "blender" / "frames" / "air"
OUT = ROOT / "public" / "air"
MELT = 20  # frames

only = sys.argv[1:]  # name sets to finish just those; none means all
for folder in sorted(path for path in WORK.iterdir() if path.is_dir() and (not only or path.name in only)):
    frames = sorted(folder.glob("f*.png"))
    if len(frames) <= MELT * 2:  # not rendered yet, or already made into a film
        continue
    keep = len(frames) - MELT
    for index in range(MELT):
        share = (index + 1) / (MELT + 1)
        early, late = Image.open(frames[index]).convert("RGB"), Image.open(frames[keep + index]).convert("RGB")
        Image.blend(late, early, share).save(frames[index])
    for extra in frames[keep:]:
        extra.unlink()
    for index, frame in enumerate(sorted(folder.glob("f*.png"))):
        frame.rename(folder / f"g{index:04d}.png")
    film = OUT / f"{folder.name}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "24", "-i", str(folder / "g%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", str(film)], check=True)
    print("wrote", film)
