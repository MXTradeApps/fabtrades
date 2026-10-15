"""Regenerates the iOS launch screen artwork (Runner/Assets.xcassets).

The launch screen is the app icon over the "FAB Trades" wordmark, set the way
the web header sets it (Archivo ExtraBold, 115% width). iOS can't load Google
Fonts before Flutter starts, so the wordmark is baked into the image: one
image per appearance, because the text takes the theme's `text` token.
Colors mirror AppTokens.light / AppTokens.dark in lib/app/theme.dart; keep them
in sync if the tokens change, and update LaunchBackground.colorset too.

Usage (from apps/mobile):
  python3 tool/generate_launch_screen.py path/to/Archivo-SemiExpanded-ExtraBold.ttf
The static instance comes from
  https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@115,800
(request it with a non-browser User-Agent to get a .ttf link).
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICON = ROOT / 'assets/icon/app_icon.png'
OUT = ROOT / 'ios/Runner/Assets.xcassets/LaunchLogo.imageset'

# AppTokens.text (light / dark).
TEXT = {'light': (0x1E, 0x16, 0x12, 255), 'dark': (0xF3, 0xED, 0xE7, 255)}
# AppTokens.dark.borderStrong: a hairline that keeps the dark icon from
# melting into the dark background.
DARK_RING = (0xF3, 0xED, 0xE7, 0x2B)

ICON_PT = 104
RADIUS = 0.25  # matches the web header's 9px on a 36px icon
GAP_PT = 20
TEXT_PT = 28
SCALES = (1, 2, 3)


def render(font_path, mode, scale):
    icon_px = ICON_PT * scale
    font = ImageFont.truetype(font_path, TEXT_PT * scale)
    left, top, right, bottom = font.getbbox('FAB Trades')
    text_w, text_h = right - left, bottom - top
    width = max(icon_px, text_w) + 4 * scale
    height = icon_px + GAP_PT * scale + text_h + 2 * scale
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))

    icon = Image.open(ICON).convert('RGBA')
    # The source carries a stray 1px light outline ~25px in; crop past it.
    inset = round(icon.width * 0.03)
    icon = icon.crop((inset, inset, icon.width - inset, icon.height - inset))
    icon = icon.resize((icon_px, icon_px), Image.LANCZOS)
    mask = Image.new('L', (icon_px * 4, icon_px * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, icon_px * 4 - 1, icon_px * 4 - 1), radius=int(icon_px * 4 * RADIUS), fill=255
    )
    mask = mask.resize((icon_px, icon_px), Image.LANCZOS)
    x = (width - icon_px) // 2
    img.paste(icon, (x, 0), mask)
    if mode == 'dark':
        ring = Image.new('RGBA', (icon_px * 4, icon_px * 4), (0, 0, 0, 0))
        ImageDraw.Draw(ring).rounded_rectangle(
            (0, 0, icon_px * 4 - 1, icon_px * 4 - 1),
            radius=int(icon_px * 4 * RADIUS),
            outline=DARK_RING,
            width=4 * scale,
        )
        ring = ring.resize((icon_px, icon_px), Image.LANCZOS)
        img.alpha_composite(ring, (x, 0))

    draw = ImageDraw.Draw(img)
    draw.text(((width - text_w) // 2 - left, icon_px + GAP_PT * scale - top), 'FAB Trades', font=font, fill=TEXT[mode])
    return img


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    OUT.mkdir(parents=True, exist_ok=True)
    for mode in ('light', 'dark'):
        for scale in SCALES:
            suffix = '' if mode == 'light' else '-dark'
            name = f'LaunchLogo{suffix}@{scale}x.png'
            render(sys.argv[1], mode, scale).save(OUT / name, optimize=True)
            print('wrote', OUT / name)


if __name__ == '__main__':
    main()
