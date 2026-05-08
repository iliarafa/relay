"""Generate the RELAY app icon: pencil-sketch outline of a relay runner.

Produces a 1024x1024 PNG written to the iOS AppIcon asset slot.
"""

from __future__ import annotations

import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
OUT = (
    Path(__file__).resolve().parent.parent
    / "ios"
    / "App"
    / "App"
    / "Assets.xcassets"
    / "AppIcon.appiconset"
    / "AppIcon-512@2x.png"
)

# Graphite ink — slightly off-black for a pencil feel.
INK = (38, 38, 42)
PAPER = (255, 255, 255)


def jitter_polyline(pts, amp=1.6, seed=0):
    rng = random.Random(seed)
    return [(x + rng.uniform(-amp, amp), y + rng.uniform(-amp, amp)) for x, y in pts]


def cubic_bezier(p0, p1, p2, p3, steps=80):
    out = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
        out.append((x, y))
    return out


def quadratic_bezier(p0, p1, p2, steps=60):
    out = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u**2 * p0[0] + 2 * u * t * p1[0] + t**2 * p2[0]
        y = u**2 * p0[1] + 2 * u * t * p1[1] + t**2 * p2[1]
        out.append((x, y))
    return out


def sketchy_line(draw, pts, width=10, passes=3, jitter=2.0, alpha=180, seed=0):
    """Draw a line several times with tiny offsets — fakes graphite scratchiness."""
    for k in range(passes):
        wobbled = jitter_polyline(pts, amp=jitter, seed=seed + k)
        # Slight stroke variation per pass.
        w = max(2, int(width * (0.85 + 0.25 * (k / max(1, passes - 1)))))
        a = max(80, int(alpha * (0.65 + 0.35 * (k / max(1, passes - 1)))))
        color = INK + (a,)
        draw.line(wobbled, fill=color, width=w, joint="curve")


def sketchy_circle(draw, cx, cy, r, width=10, passes=3, jitter=1.4, alpha=200, seed=0):
    pts = []
    steps = 96
    for i in range(steps + 1):
        a = (i / steps) * 2 * math.pi
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    sketchy_line(draw, pts, width=width, passes=passes, jitter=jitter, alpha=alpha, seed=seed)


def main() -> None:
    img = Image.new("RGB", (SIZE, SIZE), PAPER)
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay, "RGBA")

    # Translate everything left so the figure sits more centered.
    DX = -40

    def shift(p):
        return (p[0] + DX, p[1])

    # ----- Figure proportions (mid-stride sprinter facing right) -----
    # Head
    head = shift((540, 250))
    head_r = 76
    sketchy_circle(d, head[0], head[1], head_r, width=11, passes=3, jitter=1.2, alpha=215, seed=1)

    # Neck → shoulders (forward-leaning torso). The torso is a closed shape:
    # front-shoulder → back-shoulder → back-hip → front-hip → front-shoulder.
    front_shoulder = shift((498, 365))
    back_shoulder = shift((566, 348))
    front_hip = shift((472, 608))
    back_hip = shift((534, 600))

    # Front torso edge (chest-side curve, slight forward arch)
    front_torso = quadratic_bezier(front_shoulder, shift((448, 480)), front_hip, steps=70)
    sketchy_line(d, front_torso, width=12, passes=3, jitter=1.5, alpha=220, seed=11)

    # Back torso edge (slight outward arch)
    back_torso = quadratic_bezier(back_shoulder, shift((588, 480)), back_hip, steps=70)
    sketchy_line(d, back_torso, width=11, passes=3, jitter=1.5, alpha=210, seed=12)

    # Shoulder line + hip line — close the torso so it reads as one body.
    sketchy_line(d, [front_shoulder, back_shoulder], width=10, passes=2, jitter=1.0, alpha=200, seed=13)
    sketchy_line(d, [front_hip, back_hip], width=10, passes=2, jitter=1.0, alpha=200, seed=14)

    # Neck strokes from head to shoulder line.
    sketchy_line(
        d,
        [(head[0] - 16, head[1] + head_r - 4), front_shoulder],
        width=9, passes=2, jitter=1.0, alpha=200, seed=15,
    )
    sketchy_line(
        d,
        [(head[0] + 28, head[1] + head_r - 6), back_shoulder],
        width=9, passes=2, jitter=1.0, alpha=200, seed=16,
    )

    # ----- Front arm (right hand, swung forward and up) -----
    front_hand = shift((740, 200))
    front_arm = cubic_bezier(
        back_shoulder, shift((640, 360)), shift((720, 290)), front_hand, steps=80
    )
    sketchy_line(d, front_arm, width=12, passes=3, jitter=1.6, alpha=215, seed=21)
    sketchy_circle(d, front_hand[0], front_hand[1], 18, width=7, passes=2, jitter=1.0, alpha=200, seed=22)

    # ----- Back arm (left, swung behind, holding baton) -----
    back_hand = shift((290, 500))
    back_arm = cubic_bezier(
        front_shoulder, shift((430, 410)), shift((330, 470)), back_hand, steps=80
    )
    sketchy_line(d, back_arm, width=12, passes=3, jitter=1.6, alpha=215, seed=31)
    sketchy_circle(d, back_hand[0], back_hand[1], 18, width=7, passes=2, jitter=1.0, alpha=200, seed=32)

    # ----- Baton (in back fist) -----
    baton_start = shift((220, 545))
    baton_end = shift((360, 460))
    sketchy_line(d, [baton_start, baton_end], width=18, passes=4, jitter=1.2, alpha=230, seed=41)
    # End caps so it reads as a tube.
    sketchy_line(
        d,
        [(baton_start[0] - 12, baton_start[1] + 8), (baton_start[0] + 12, baton_start[1] - 8)],
        width=8, passes=2, jitter=0.8, alpha=210, seed=42,
    )
    sketchy_line(
        d,
        [(baton_end[0] - 12, baton_end[1] + 8), (baton_end[0] + 12, baton_end[1] - 8)],
        width=8, passes=2, jitter=0.8, alpha=210, seed=43,
    )

    # ----- Front leg (knee high, driving forward) -----
    front_foot = shift((640, 770))
    front_leg = cubic_bezier(
        front_hip, shift((560, 660)), shift((640, 700)), front_foot, steps=80
    )
    sketchy_line(d, front_leg, width=13, passes=3, jitter=1.6, alpha=220, seed=51)
    sketchy_line(
        d,
        [(front_foot[0] - 22, front_foot[1] + 4), (front_foot[0] + 56, front_foot[1] - 6)],
        width=12, passes=3, jitter=1.2, alpha=210, seed=52,
    )

    # ----- Back leg (extended behind, pushing off) -----
    back_foot = shift((310, 880))
    back_leg = cubic_bezier(
        back_hip, shift((430, 720)), shift((350, 820)), back_foot, steps=80
    )
    sketchy_line(d, back_leg, width=13, passes=3, jitter=1.6, alpha=220, seed=61)
    sketchy_line(
        d,
        [(back_foot[0] - 32, back_foot[1]), (back_foot[0] + 30, back_foot[1])],
        width=11, passes=3, jitter=1.2, alpha=210, seed=62,
    )

    # Slight blur softens the edges to look more like graphite, then composite.
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=0.6))
    img.paste(overlay, (0, 0), overlay)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
