#!/usr/bin/env python3
"""
Prepare the real-device scan capture for the v3 set.

  - Status bar: replaced with the 9:41 / full-battery glyphs from a v2
    simulator capture (recoloured onto this capture's own background), which
    also removes the green camera-in-use dot.
  - Header: the "Scan diagnostics" bug icon is painted out with the header's
    flat background colour. Nothing else is touched.

Output: screenshots/v3/work/scan-clean.png (same 1170x2532 size as the source).
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent
SRC = ROOT.parent / "source" / "01-scan-riches.png"
STATUS_SRC = ROOT.parent / "v2" / "raw" / "trade-filler.png"
OUT = ROOT / "work" / "scan-clean.png"

scan = Image.open(SRC).convert("RGB")
W, H = scan.size
bg = scan.getpixel((20, 20))

# 1. Status bar ------------------------------------------------------
STATUS_H_RAW = 150                       # status-bar strip in the 1320-wide sim capture
sim = Image.open(STATUS_SRC).convert("RGB")
strip = sim.crop((0, 0, sim.width, STATUS_H_RAW))
k = W / sim.width
strip = strip.resize((W, round(STATUS_H_RAW * k)), Image.LANCZOS)
# Glyphs are near-white on a dark bar; the dynamic island is pure black.
# Use brightness above the sim bar's background as alpha.
sim_bg = max(sim.getpixel((20, 20)))
alpha = strip.convert("L").point(lambda v: max(0, min(255, round((v - sim_bg - 12) * 255 / (235 - sim_bg)))))
bar = Image.new("RGB", strip.size, bg)
bar.paste(Image.new("RGB", strip.size, (255, 255, 255)), (0, 0), alpha)
scan.paste(bar, (0, 0))

# 2. Bug icon --------------------------------------------------------
d = ImageDraw.Draw(scan)
d.rectangle([1050, 180, 1150, 280], fill=bg)

OUT.parent.mkdir(parents=True, exist_ok=True)
scan.save(OUT)
print("✓", OUT)
