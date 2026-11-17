#!/usr/bin/env python3
"""
v3 scaffold composer for FAB Trades App Store screenshots.

A project-local copy of the aso-appstore-screenshots skill's compose.py
(the installed skill is left untouched), changed to:
  - use Outfit 800 (the app font) instead of SF Pro Display Black
  - draw espresso/brown type on the v2 tan background instead of white
  - optionally pre-place a breakout panel cropped from a real capture

    python3 screenshots/v3/compose_v3.py            # all seven scaffolds
    python3 screenshots/v3/compose_v3.py 02 05      # only matching slides
"""
import os
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
SHOTS = ROOT.parent
FONT_PATH = str(ROOT / "fonts" / "Outfit-800.ttf")
FRAME_PATH = os.path.expanduser(
    "~/.claude/skills/aso-appstore-screenshots/assets/device_frame.png")

BG = "#D4A574"      # tan (v2)
INK = "#2C1810"     # espresso (v2)
ACCENT = "#7A3B10"  # v2 second-line brown

# ── Canvas / device (same as the skill's compose.py) ────────────────
CANVAS_W, CANVAS_H = 1290, 2796
DEVICE_W = 1030
BEZEL = 15
SCREEN_W = DEVICE_W - 2 * BEZEL
SCREEN_CORNER_R = 62
DEVICE_Y = 720
TEXT_TOP = 150

# ── Typography ──────────────────────────────────────────────────────
VERB_SIZE_MAX = 280
VERB_SIZE_MIN = 150
DESC_SIZE = 120
VERB_DESC_GAP = 26
DESC_LINE_GAP = 22
MAX_TEXT_W = int(CANVAS_W * 0.90)

# Breakout rects are in source-capture pixels: (x, y, w, h).
SLIDES = [
    dict(slug="01-balance", verb="BALANCE", desc="FLESH AND BLOOD TRADES, FREE",
         shot="v2/raw/trade-balanced.png",
         breakout=(0, 1255, 1320, 205), bw=1230),
    dict(slug="02-scan", verb="SCAN", desc="ANY CARD FOR ITS PRICE",
         shot="v3/work/scan-clean.png",
         breakout=(22, 1550, 1126, 246), bw=1230),
    dict(slug="03-check", verb="CHECK", desc="LIVE PRICES, EVERY PRINTING",
         shot="v2/raw/card-detail.png",
         breakout=(45, 1225, 1230, 725), bw=1210, dy=50),
    dict(slug="04-close", verb="CLOSE", desc="THE GAP FROM YOUR BINDER",
         shot="v2/raw/trade-filler.png",
         breakout=(30, 300, 1260, 585), bw=1210),
    dict(slug="05-spot", verb="SPOT", desc="THE RISERS",
         shot="v2/raw/trending.png",
         breakout=(20, 550, 1280, 200), bw=1230),
    dict(slug="06-value", verb="VALUE", desc="YOUR BINDER",
         shot="v2/raw/binder-list.png",
         chip=("v2/raw/collection-stats.png", (60, 510, 1200, 275), 560), bw=1190),
    dict(slug="07-track", verb="TRACK", desc="LIFE AND ROUND TIME",
         shot="v2/raw/life-tracker.png"),
]


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def wrap(draw, text, font, max_w):
    lines, cur = [], ""
    for w in text.split():
        t = f"{cur} {w}".strip()
        if draw.textlength(t, font=font) <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit_font(text, max_w):
    d = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    for size in range(VERB_SIZE_MAX, VERB_SIZE_MIN - 1, -4):
        f = ImageFont.truetype(FONT_PATH, size)
        b = d.textbbox((0, 0), text, font=f)
        if b[2] - b[0] <= max_w:
            return f
    return ImageFont.truetype(FONT_PATH, VERB_SIZE_MIN)


def breakout_layer(src_path, rect, target_w, center_y, K=1.0, size=None):
    CANVAS_W, CANVAS_H = size
    x, y, w, h = rect
    crop = Image.open(src_path).convert("RGBA").crop((x, y, x + w, y + h))
    k = target_w / w
    bw, bh = target_w, round(h * k)
    crop = crop.resize((bw, bh), Image.LANCZOS)
    radius = round(36 * K)
    mask = Image.new("L", (bw, bh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, bw - 1, bh - 1], radius=radius, fill=255)
    left = (CANVAS_W - bw) // 2
    top = round(center_y - bh / 2)

    layer = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [left, top + round(26 * K), left + bw, top + bh + round(26 * K)], radius=radius, fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(34 * K))
    layer = Image.alpha_composite(layer, shadow)
    layer.paste(crop, (left, top), mask)
    panel = Image.new("L", (CANVAS_W, CANVAS_H), 0)
    panel.paste(mask, (left, top))
    return layer, panel


def render(s, K=1.0, height=None):
    """Return (canvas RGB, content mask L) rendered at scale K of the 1290x2796 layout.

    The content mask covers the phone screen and the breakout panel: the
    pixels that must stay exactly as captured from the app.
    """
    cw, ch = round(CANVAS_W * K), height or round(CANVAS_H * K)
    Z = lambda v: round(v * K)
    canvas = Image.new("RGBA", (cw, ch), (*rgb(BG), 255))
    draw = ImageDraw.Draw(canvas)

    def lines(y, ls, font, fill, gap):
        for line in ls:
            b = draw.textbbox((0, 0), line, font=font)
            draw.text((cw // 2, y - b[1]), line, fill=fill, font=font, anchor="mt")
            y += (b[3] - b[1]) + gap
        return y

    base_verb = fit_font(s["verb"], MAX_TEXT_W)
    verb_font = ImageFont.truetype(FONT_PATH, Z(base_verb.size))
    desc_font = ImageFont.truetype(FONT_PATH, Z(DESC_SIZE))
    base_desc = ImageFont.truetype(FONT_PATH, DESC_SIZE)
    wrapped = wrap(ImageDraw.Draw(Image.new("RGBA", (1, 1))), s["desc"], base_desc, MAX_TEXT_W)
    y = lines(Z(TEXT_TOP), [s["verb"]], verb_font, rgb(INK), 0)
    y += Z(VERB_DESC_GAP)
    y = lines(y, wrapped, desc_font, rgb(ACCENT), Z(DESC_LINE_GAP))
    text_bottom = y - Z(DESC_LINE_GAP)
    assert text_bottom + Z(30) <= Z(DEVICE_Y), f"{s['slug']}: headline runs into device"

    dev_w = Z(DEVICE_W)
    bezel = Z(BEZEL)
    scr_w = dev_w - 2 * bezel
    device_x = (cw - dev_w) // 2
    device_y = Z(DEVICE_Y)
    screen_x, screen_y = device_x + bezel, device_y + bezel

    shot = Image.open(SHOTS / s["shot"]).convert("RGBA")
    scale = scr_w / shot.width
    shot = shot.resize((scr_w, int(shot.height * scale)), Image.LANCZOS)
    box = [screen_x, screen_y, screen_x + scr_w, ch + 500]
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=Z(SCREEN_CORNER_R), fill=255)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(box, radius=Z(SCREEN_CORNER_R), fill=(0, 0, 0, 255))
    layer.paste(shot, (screen_x, screen_y))
    layer.putalpha(mask)
    canvas = Image.alpha_composite(canvas, layer)

    ft = Image.open(FRAME_PATH).convert("RGBA")
    ft = ft.resize((dev_w, round(ft.height * dev_w / ft.width)), Image.LANCZOS)
    frame = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    frame.paste(ft, (device_x, device_y))
    canvas = Image.alpha_composite(canvas, frame)

    content = mask
    bl = None
    if s.get("breakout"):
        x, by, w, h = s["breakout"]
        center = screen_y + (by + h / 2) * scale + Z(s.get("dy", 0))
        bl = breakout_layer(SHOTS / s["shot"], s["breakout"], Z(s["bw"]), center, K, canvas.size)
    elif s.get("chip"):
        src, rect, at = s["chip"]
        bl = breakout_layer(SHOTS / src, rect, Z(s["bw"]), screen_y + at * scale, K, canvas.size)
    if bl:
        canvas = Image.alpha_composite(canvas, bl[0])
        content = ImageChops.lighter(mask, bl[1])
    return canvas.convert("RGB"), content


def compose(s):
    canvas, _ = render(s)
    out = ROOT / s["slug"] / "scaffold.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, "PNG")
    # 9:16 padded copy for the image model (it only generates preset ratios)
    w916 = round(canvas.height * 9 / 16)
    pad = Image.new("RGB", (w916, canvas.height), rgb(BG))
    pad.paste(canvas, ((w916 - canvas.width) // 2, 0))
    pad.save(out.with_name("scaffold-916.png"))
    print(f"✓ {out.relative_to(SHOTS.parent)}")


if __name__ == "__main__":
    want = sys.argv[1:]
    for s in SLIDES:
        if not want or any(w in s["slug"] for w in want):
            compose(s)
