#!/usr/bin/env python3
"""
Turn an image-model "enhanced" frame into an exact App Store screenshot.

The image model (Nano Banana Pro) redraws the device frame and shadows nicely
but cannot be trusted with small UI text (it changes digits). So for each
enhanced version we:
  1. find the scale/offset that best aligns it to the deterministic scaffold
     (search on the phone-screen region),
  2. resample it onto the exact output canvas,
  3. paste the real app pixels (phone screen + breakout panel) back on top
     from compose_v3.render(), so every label and number is the captured one.

    python3 screenshots/v3/finish.py 01-balance v1 v2 v3
Writes <slug>/<ver>-6.9.png (1320x2868) and <slug>/<ver>-6.5.png (1242x2688),
and prints the alignment residual (lower = the model kept the layout).
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageStat

sys.path.insert(0, str(Path(__file__).resolve().parent))
import compose_v3 as C

ROOT = Path(__file__).resolve().parent
SIZES = {"6.9": (1320, 2868), "6.5": (1242, 2688)}


def warp(G, size, s, tx, ty, q=1.0, resample=Image.BILINEAR):
    """Canvas(x,y) at 1/q resolution -> G(s*x*q + tx, s*y*q + ty)."""
    return G.transform(size, Image.AFFINE, (s * q, 0, tx, 0, s * q, ty), resample)


def fit(G, scaffold, mask):
    """Similarity (s, tx, ty) mapping scaffold px -> G px, minimising screen diff."""
    s0 = G.height / scaffold.height
    best = (s0, (G.width - scaffold.width * s0) / 2, 0.0)
    Gg = G.convert("L")
    for q, ds, dt, n in ((8, 0.004, 8.0, 6), (4, 0.001, 3.0, 5), (2, 0.0004, 1.0, 4), (1, 0.00015, 0.4, 3)):
        size = (scaffold.width // q, scaffold.height // q)
        ref = scaffold.convert("L").resize(size, Image.BOX)
        m = mask.resize(size, Image.BOX).point(lambda v: 255 if v > 250 else 0)
        Gq = Gg if q == 1 else Gg.resize((G.width // min(q, 2), G.height // min(q, 2)), Image.BOX)
        gq = G.width / Gq.width
        bs, btx, bty = best
        scored = []
        for i in range(-n, n + 1):
            s = bs * (1 + i * ds)
            for j in range(-n, n + 1):
                for k in range(-n, n + 1):
                    tx, ty = btx + j * dt * s0, bty + k * dt * s0
                    w = warp(Gq, size, s / gq, tx / gq, ty / gq, q)
                    d = ImageStat.Stat(ImageChops.difference(w, ref), m).mean[0]
                    scored.append((d, s, tx, ty))
        d, *best = min(scored)
        best = tuple(best)
    return best, d


def finish(slug, ver):
    slide = next(s for s in C.SLIDES if s["slug"] == slug)
    G = Image.open(ROOT / slug / f"{ver}.jpg").convert("RGB")
    scaffold, mask = C.render(slide)
    (s, tx, ty), resid = fit(G, scaffold, mask)
    out = {}
    for label, (w, h) in SIZES.items():
        K = w / C.CANVAS_W
        exact, content = C.render(slide, K, h)
        base = warp(G, (w, h), s / K, tx, ty, resample=Image.BICUBIC)
        # pull the mask in 1px so the model's own bezel edge is kept
        content = content.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
        base.paste(exact, (0, 0), content)
        p = ROOT / slug / f"{ver}-{label}.png"
        base.save(p)
        out[label] = p
    print(f"{slug} {ver}: scale {s / (G.height / scaffold.height):.4f} "
          f"dx {tx / s - (G.width / s - scaffold.width) / 2:+.1f} dy {ty / s:+.1f}  residual {resid:.1f}")
    return out


if __name__ == "__main__":
    slug, *vers = sys.argv[1:]
    for v in vers:
        finish(slug, v)
