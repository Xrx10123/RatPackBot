"""
Peaches' complete art set — every image/GIF the bot shows of her, drawn from
one character rig so she looks identical everywhere (original artwork, no
external assets).

    python3 bot/tools/draw_peaches.py            # render everything
    python3 bot/tools/draw_peaches.py feed sleep # render just these
    python3 bot/tools/draw_peaches.py --sheet    # also write a contact sheet preview

Output: bot/assets/peaches/<moment>.gif (384x288, 16 frames, looping).
Requires Pillow.
"""
import math
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'peaches')

# Design coordinates are 320x240; output is 384x288, drawn 3x supersampled.
DW, DH = 320, 240
OUT_W, OUT_H = 384, 288
SS = 3
K = OUT_W / DW * SS  # design unit -> supersampled pixel
FRAMES = 16
FRAME_MS = 90

# --- palette (shared by every scene) ---------------------------------------
FUR = (238, 204, 176)
FUR_SHADE = (219, 180, 150)
BELLY = (251, 232, 214)
PINK = (245, 160, 172)
PINK_DEEP = (222, 118, 138)
LINE = (112, 78, 66)          # the one outline colour for Peaches and her props
INK = (52, 38, 44)
WHITE = (255, 255, 255)
CHEESE = (255, 206, 84)
CHEESE_DARK = (232, 170, 50)
GOLD = (247, 196, 60)
RED = (226, 72, 80)


def p(v):
    return int(round(v * K))


FONT_PATH = 'DejaVuSans-Bold.ttf'
_fonts = {}


def glyph(d, x, y, text, size, color):
    """A crisp text glyph (?, !, ♪, Z) centred on (x, y) — cleaner than hand-drawn arcs."""
    key = round(size * 4) / 4
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(FONT_PATH, max(1, p(key)))
    d.text((p(x), p(y)), text, fill=color, font=_fonts[key], anchor='mm')


def pts(points):
    return [(p(x), p(y)) for x, y in points]


def box(cx, cy, rx, ry):
    return [p(cx - rx), p(cy - ry), p(cx + rx), p(cy + ry)]


def lerp(a, b, u):
    return tuple(int(a[i] + (b[i] - a[i]) * u) for i in range(3))


def wave(t, cycles=1.0, phase=0.0):
    return math.sin((t * cycles + phase) * 2 * math.pi)


# --- stage ------------------------------------------------------------------

def stage(img, top, bottom=None, floor=None, vignette=False):
    """Every scene's backdrop: one flat colour and a floor band. Flat on
    purpose — gradients band into visible stripes in a 256-colour GIF."""
    d = ImageDraw.Draw(img, 'RGBA')
    d.rectangle([0, 0, img.size[0], img.size[1]], fill=top)
    if floor:
        d.rectangle([0, p(214), img.size[0], img.size[1]], fill=floor)
        d.line([0, p(214), img.size[0], p(214)], fill=tuple(max(0, c - 22) for c in floor), width=p(1.4))
    return d


def shadow(img, cx, cy, rx, ry, alpha=60):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(box(cx, cy, rx, ry), fill=(60, 30, 30, alpha))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(p(3))))


def glow(img, cx, cy, rx, ry, color, alpha):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(box(cx, cy, rx, ry), fill=(*color, alpha))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(p(12))))


def outlined_ellipse(d, cx, cy, rx, ry, fill, line=LINE, w=2.0):
    d.ellipse(box(cx, cy, rx + w, ry + w), fill=line)
    d.ellipse(box(cx, cy, rx, ry), fill=fill)


def outlined_poly(d, points, fill, line=LINE, w=2.0):
    d.polygon(pts(points), fill=fill, outline=line)
    d.line(pts(points + [points[0]]), fill=line, width=p(w), joint='curve')


# --- Peaches ----------------------------------------------------------------

class Rig:
    """Where things are on her this frame — accessories hang off these anchors."""

    def __init__(self, cx, cy):
        self.cx, self.cy = cx, cy
        self.hx, self.hy = cx + 34, cy - 30          # head centre
        self.hat = (cx + 30, cy - 50)                  # top of head
        self.eye = (cx + 45, cy - 33)
        self.snout = (cx + 74, cy - 22)
        self.neck = (cx + 22, cy - 12)
        self.paw = (cx + 34, cy + 6)                   # front paw rest point
        self.held = (cx + 66, cy - 4)                  # where held props sit


def peaches(img, cx, cy, t, expr='open', mouth='smile', paws='down', look=0.0, fur=FUR, belly=BELLY, tail_speed=1.0, blink=True):
    """Peaches sitting, facing right. Returns a Rig of anchor points."""
    d = ImageDraw.Draw(img, 'RGBA')
    r = Rig(cx, cy)
    shadow(img, cx + 8, 216, 62, 7)
    d = ImageDraw.Draw(img, 'RGBA')

    # tail (behind everything)
    # tail: comes out from under her back, runs along the floor and curls up at the tip, tapering
    tail = []
    for i in range(28):
        u = i / 27
        x = cx - 26 - 72 * u
        y = cy + 37 + 2 * u - 24 * u ** 3 + 4 * u * u * wave(t, tail_speed, -u * 0.8)
        tail.append((x, y))
    for i in range(len(tail) - 1):
        u = i / (len(tail) - 1)
        d.line(pts(tail[i:i + 2]), fill=LINE, width=p(7.6 - 3.6 * u))
        d.ellipse(box(*tail[i + 1], (3.8 - 1.8 * u), (3.8 - 1.8 * u)), fill=LINE)
    for i in range(len(tail) - 1):
        u = i / (len(tail) - 1)
        d.line(pts(tail[i:i + 2]), fill=PINK, width=p(4.8 - 2.6 * u))
        d.ellipse(box(*tail[i + 1], (2.4 - 1.3 * u), (2.4 - 1.3 * u)), fill=PINK)

    # silhouette outline first (one clean outline around body+head+ears), then fills
    for ex, ey, rx, ry in [(cx, cy, 47, 41), (r.hx, r.hy, 30, 26), (r.hx + 27, r.hy + 8, 17, 12), (r.hx - 23, r.hy - 22, 16, 16), (r.hx - 7, r.hy - 26, 17, 17)]:
        d.ellipse(box(ex, ey, rx + 2.2, ry + 2.2), fill=LINE)
    d.ellipse(box(r.hx - 23, r.hy - 22, 16, 16), fill=FUR_SHADE)      # back ear
    d.ellipse(box(r.hx - 23, r.hy - 22, 9.5, 9.5), fill=PINK)
    d.ellipse(box(cx, cy, 47, 41), fill=fur)                          # body
    d.ellipse(box(cx + 9, cy + 9, 29, 26), fill=belly)                # belly
    d.ellipse(box(r.hx, r.hy, 30, 26), fill=fur)                      # head
    d.ellipse(box(r.hx + 27, r.hy + 8, 17, 12), fill=fur)             # snout
    d.ellipse(box(r.hx - 7, r.hy - 26, 17, 17), fill=fur)             # front ear
    d.ellipse(box(r.hx - 7, r.hy - 26, 10.5, 10.5), fill=PINK)
    d.ellipse(box(r.hx + 42, r.hy + 6, 5.5, 4.5), fill=PINK_DEEP)     # nose
    d.ellipse(box(r.hx + 40.5, r.hy + 4.5, 1.6, 1.2), fill=(255, 210, 220))
    d.ellipse(box(r.hx + 17, r.hy + 11, 5.5, 3.2), fill=(255, 186, 196))  # cheek

    # eyes
    ex, ey = r.eye
    blinking = blink and expr in ('open', 'wide', 'shifty', 'angry', 'sad') and 0.86 < (t % 1.0) < 0.93
    if blinking or expr == 'closed':
        d.arc(box(ex, ey + 1, 6, 4), 20, 160, fill=INK, width=p(2))
    elif expr == 'happy':
        d.arc(box(ex, ey + 2, 6, 5), 200, 340, fill=INK, width=p(2.2))
    else:
        er = 6.5 if expr == 'wide' else 5.2
        lx = look * 2.5 if expr != 'shifty' else 2.8 * wave(t, 2)
        d.ellipse(box(ex + lx, ey, er * 0.85, er), fill=INK)
        d.ellipse(box(ex + lx + 1.8, ey - 2.4, 1.7, 1.7), fill=WHITE)
        if expr == 'angry':
            d.line(pts([(ex - 9, ey - 12), (ex + 6, ey - 6)]), fill=INK, width=p(2.6))
        if expr == 'sad':
            d.line(pts([(ex - 7, ey - 7), (ex + 7, ey - 12)]), fill=INK, width=p(2.2))
            ty = ey + 6 + 22 * (t % 1.0)
            d.ellipse(box(ex - 1, ty, 2.4, 3.4), fill=(140, 200, 255, int(255 * (1 - t % 1.0))))

    # mouth: only drawn when it's doing something (open / chewing) — a resting
    # mouth under the snout just reads as a smudge at this size
    mx, my = r.hx + 31, r.hy + 19
    if mouth == 'open' or (mouth == 'chew' and (t * 8) % 2 < 1):
        d.ellipse(box(mx, my, 3.6, 3), fill=(150, 60, 70))

    # whiskers
    wob = wave(t, 2) * 1.6
    for dy in (-3, 2.5, 8):
        d.line(pts([(r.hx + 36, r.hy + 9 + dy * 0.35), (r.hx + 60, r.hy + 5 + dy + wob)]), fill=(150, 120, 115), width=p(1))

    # feet + paws
    for fx in (cx + 22, cx - 12):
        outlined_ellipse(d, fx, cy + 39, 10, 5, PINK, w=1.6)
    if paws == 'down':
        # two little front paws held together at her chest, with toes
        for px_, py_ in ((cx + 38, cy + 4), (cx + 45, cy + 9)):
            outlined_ellipse(d, px_, py_, 5.2, 4.2, PINK, w=1.4)
            for k in (-1.8, 0, 1.8):
                d.line(pts([(px_ + 2.2, py_ + k), (px_ + 4.6, py_ + k * 1.2)]), fill=PINK_DEEP, width=p(0.8))
    elif paws == 'up':
        outlined_ellipse(d, r.held[0] - 8, r.held[1] + 4, 6.5, 5.5, PINK, w=1.6)
        outlined_ellipse(d, r.held[0] + 4, r.held[1] + 8, 6.5, 5.5, PINK, w=1.6)
    return r


# --- props & accessories ----------------------------------------------------

def sparkle(d, x, y, size, t, phase=0.0, color=(255, 236, 140)):
    s = max(3.0, size) * (0.6 + 0.4 * (0.5 + 0.5 * wave(t, 2, phase)))
    d.polygon(pts([(x, y - s), (x + s * 0.28, y - s * 0.28), (x + s, y), (x + s * 0.28, y + s * 0.28), (x, y + s), (x - s * 0.28, y + s * 0.28), (x - s, y), (x - s * 0.28, y - s * 0.28)]), fill=color)


def heart(d, x, y, size, color=(255, 120, 160), alpha=255):
    if size < 1.2:
        return
    c = color
    d.ellipse(box(x - size * 0.5, y - size * 0.25, size * 0.55, size * 0.55), fill=c)
    d.ellipse(box(x + size * 0.5, y - size * 0.25, size * 0.55, size * 0.55), fill=c)
    d.polygon(pts([(x - size * 1.02, y - size * 0.05), (x + size * 1.02, y - size * 0.05), (x, y + size * 1.05)]), fill=c)


def cheese_wedge(d, x, y, scale=1.0, bite=0.0):
    w, h = 26 * scale, 18 * scale
    right = x + w * (1 - bite * 0.55)
    outlined_poly(d, [(x - w, y + h * 0.5), (right, y + h * 0.5), (right, y - h * 0.15 + bite * h * 0.4), (x - w, y - h * 0.5)], CHEESE, w=1.6)
    d.polygon(pts([(x - w, y - h * 0.5), (right, y - h * 0.15 + bite * h * 0.4), (right - 4 * scale, y - h * 0.55)]), fill=CHEESE_DARK)
    for hx, hy, hr in [(x - w * 0.5, y + h * 0.1, 3.2), (x + w * 0.05, y - h * 0.05, 2.4), (x - w * 0.15, y + h * 0.32, 1.8)]:
        if hx < right - 3:
            d.ellipse(box(hx, hy, hr * scale, hr * scale), fill=CHEESE_DARK)


def cloud(d, x, y, scale, color):
    for dx, dy, r in [(-18, 4, 13), (0, -4, 17), (18, 4, 13), (6, 8, 12), (-8, 8, 12)]:
        d.ellipse(box(x + dx * scale, y + dy * scale, r * scale, r * scale), fill=color)


def top_hat(d, x, y, t, tilt=0):
    outlined_poly(d, [(x - 22, y + 2), (x + 22, y + 2), (x + 22, y - 3), (x - 22, y - 3)], (40, 36, 46), w=1.4)
    outlined_poly(d, [(x - 13 + tilt, y - 3), (x + 13 + tilt, y - 3), (x + 15 + tilt, y - 34), (x - 11 + tilt, y - 34)], (40, 36, 46), w=1.4)
    d.rectangle([p(x - 12 + tilt), p(y - 12), p(x + 13 + tilt), p(y - 7)], fill=RED)


def crown(d, x, y, t, scale=1.0):
    s = scale
    outlined_poly(d, [(x - 17 * s, y), (x + 17 * s, y), (x + 19 * s, y - 20 * s), (x + 9 * s, y - 10 * s), (x, y - 24 * s), (x - 9 * s, y - 10 * s), (x - 19 * s, y - 20 * s)], GOLD, line=(180, 120, 20), w=1.5)
    for gx, gc in [(-9, RED), (0, (90, 170, 255)), (9, (110, 210, 120))]:
        d.ellipse(box(x + gx * s, y - 5 * s, 2.6 * s, 2.6 * s), fill=gc)
    sparkle(d, x + 20 * s, y - 24 * s, 5, t)


def witch_hat(d, x, y, t):
    tilt = wave(t) * 2
    outlined_ellipse(d, x, y, 30, 6, (60, 30, 90), w=1.5)
    outlined_poly(d, [(x - 18, y - 2), (x + 18, y - 2), (x + 6 + tilt, y - 40), (x - 10 + tilt * 1.6, y - 52)], (84, 44, 124), w=1.5)
    d.polygon(pts([(x - 17, y - 4), (x + 17, y - 4), (x + 14, y - 11), (x - 14, y - 11)]), fill=(255, 140, 30))
    d.rectangle(box(x, y - 7.5, 3.6, 3.6), fill=(255, 220, 90))


def santa_hat(d, x, y, t):
    flop = wave(t) * 3
    outlined_poly(d, [(x - 18, y), (x + 16, y), (x + 28 + flop, y - 22), (x + 2, y - 38)], (214, 44, 54), w=1.5)
    outlined_ellipse(d, x + 29 + flop, y - 22, 6.5, 6.5, WHITE, w=1.4)
    d.rounded_rectangle([p(x - 22), p(y - 6), p(x + 20), p(y + 6)], radius=p(6), fill=WHITE, outline=LINE, width=p(1.4))


def party_hat(d, x, y, t):
    outlined_poly(d, [(x - 16, y), (x + 16, y), (x, y - 40)], (110, 196, 255), w=1.5)
    for k in range(3):
        yy = y - 9 - k * 11
        half = 16 * (1 - (y - yy) / 40)
        d.line(pts([(x - half, yy), (x + half, yy)]), fill=(255, 100, 170), width=p(3.4))
    d.ellipse(box(x, y - 42 + wave(t, 2) * 1.5, 5, 5), fill=(255, 226, 80))


def bow_tie(d, x, y, color=RED):
    outlined_poly(d, [(x - 12, y - 7), (x, y), (x - 12, y + 7)], color, w=1.3)
    outlined_poly(d, [(x + 12, y - 7), (x, y), (x + 12, y + 7)], color, w=1.3)
    outlined_ellipse(d, x, y, 3.2, 3.2, color, w=1.2)


def monocle(d, x, y):
    d.ellipse(box(x, y, 9, 9), outline=GOLD, width=p(2))
    d.line(pts([(x - 6, y + 7), (x - 14, y + 26)]), fill=GOLD, width=p(1.2))


def sunglasses(d, x, y):
    d.rounded_rectangle(box(x, y, 10, 6), radius=p(3), fill=(30, 30, 40))
    d.line(pts([(x - 10, y - 3), (x - 22, y - 6)]), fill=(30, 30, 40), width=p(2))
    d.line(pts([(x - 2, y - 3), (x + 6, y - 3)]), fill=(120, 140, 170), width=p(1))


def cape(d, cx, cy, t, color=(176, 36, 60)):
    """Drawn BEFORE Peaches: it billows out behind her back."""
    sway = wave(t) * 4
    outlined_poly(d, [(cx + 14, cy - 34), (cx - 30, cy - 36), (cx - 76 + sway, cy + 26), (cx - 66 + sway, cy + 44), (cx + 10, cy + 40)], color, w=1.6)
    d.line(pts([(cx - 74 + sway, cy + 28), (cx - 64 + sway, cy + 44)]), fill=WHITE, width=p(4))


def scarf(d, cx, cy, t, color=(56, 168, 98), stripe=(232, 70, 70)):
    """Wrapped around the neck (where head meets body), one end hanging down her chest."""
    sway = wave(t) * 2.5
    band = [(cx + 4, cy - 30), (cx + 22, cy - 22), (cx + 44, cy - 18), (cx + 56, cy - 22), (cx + 56, cy - 12), (cx + 44, cy - 6), (cx + 22, cy - 10), (cx + 2, cy - 18)]
    outlined_poly(d, band, color, w=1.4)
    for k, x in enumerate((14, 30, 46)):
        d.line(pts([(cx + x, cy - 24 + (k == 2) * 3), (cx + x + 2, cy - 12)]), fill=stripe, width=p(2.4))
    end = [(cx + 30, cy - 12), (cx + 42, cy - 12), (cx + 40 + sway, cy + 14), (cx + 28 + sway, cy + 14)]
    outlined_poly(d, end, color, w=1.4)
    d.line(pts([(cx + 31 + sway * 0.5, cy + 2), (cx + 41 + sway * 0.5, cy + 2)]), fill=stripe, width=p(2.4))
    for k in range(4):
        d.line(pts([(cx + 29 + k * 3.5 + sway, cy + 14), (cx + 29 + k * 3.5 + sway, cy + 19)]), fill=color, width=p(1.6))


def zzz(d, x, y, t, color=(230, 236, 255)):
    for i in range(3):
        u = (t + i / 3) % 1.0
        size = 9 + 9 * u * (1 - u) * 2.5
        glyph(d, x + 16 * u + i * 2, y - 36 * u, 'Z', size, color)


def bubbles(d, t, area, count=14, color=(255, 255, 255)):
    x0, y0, x1, y1 = area
    for i in range(count):
        u = (t + i / count) % 1.0
        x = x0 + ((i * 37) % 100) / 100 * (x1 - x0) + wave(t, 1, i * 0.3) * 3
        y = y1 - (y1 - y0) * u
        r = (3 + (i % 4) * 1.5) * (1 - u * 0.5)
        d.ellipse(box(x, y, r, r), outline=color, width=p(1.3))
        d.ellipse(box(x - r * 0.35, y - r * 0.35, r * 0.28, r * 0.28), fill=color)


def rain(d, t, x0, x1, y0, y1, count=12):
    for i in range(count):
        u = (t * 2 + i / count) % 1.0
        x = x0 + (i * 53 % 100) / 100 * (x1 - x0)
        y = y0 + (y1 - y0) * u
        d.line(pts([(x, y), (x - 1.5, y + 6)]), fill=(140, 170, 220), width=p(1.4))


def falling(d, t, count, draw_one):
    for i in range(count):
        x = (i * 47 + 13 * wave(t, 1, i * 0.17)) % DW
        y = ((i * 29) + t * DH) % DH
        draw_one(d, x, y, i)


# --- scenes -------------------------------------------------------------------
# Every scene: same stage layout, Peaches at (124, 172) unless the moment
# needs her elsewhere, props to the right.

PX, PY = 124, 172


def bob(t, amount=4, cycles=1):
    return -abs(wave(t, cycles)) * amount


def s_content(img, t):
    d = stage(img, (255, 236, 222), (255, 214, 192), floor=(247, 200, 176))
    peaches(img, PX, PY + bob(t, 2), t, expr='open', mouth='smile')
    d = ImageDraw.Draw(img, 'RGBA')
    cheese_wedge(d, 262, 200, 0.9)


def s_thriving(img, t):
    d = stage(img, (255, 230, 244), (240, 206, 246), floor=(234, 196, 236))
    for i in range(5):
        u = (t + i / 5) % 1.0
        heart(d, 210 + i * 18 + wave(t, 1, i * 0.2) * 6, 170 - 120 * u, (5 + 3 * (i % 2)) * min(1, (1 - u) * 3))
    peaches(img, PX, PY + bob(t, 8, 2), t, expr='happy', mouth='open', tail_speed=2)
    d = ImageDraw.Draw(img, 'RGBA')
    for i, (sx, sy) in enumerate([(54, 70), (240, 60), (280, 120), (70, 130)]):
        sparkle(d, sx, sy, 6, t, i * 0.25)


def s_restless(img, t):
    d = stage(img, (255, 243, 205), floor=(242, 214, 150))
    # the cheese drawer she keeps staring at
    d.rounded_rectangle([p(230), p(120), p(300), p(212)], radius=p(4), fill=(196, 146, 100), outline=LINE, width=p(1.6))
    d.rounded_rectangle([p(238), p(150), p(292), p(176)], radius=p(3), fill=(214, 166, 118), outline=LINE, width=p(1.3))
    d.ellipse(box(265, 163, 3.5, 3.5), fill=GOLD)
    cheese_wedge(d, 265, 112, 0.45)
    dx = wave(t, 2) * 5
    peaches(img, PX + dx, PY, t, expr='shifty', tail_speed=3)
    d = ImageDraw.Draw(img, 'RGBA')
    for i, (qx, qy) in enumerate([(204, 92), (222, 74)]):
        glyph(d, qx, qy + wave(t, 1, i * 0.5) * 3, '?', 16 + 3 * i, (176, 120, 60))


def s_grumpy(img, t):
    d = stage(img, (222, 228, 236), (198, 206, 218), floor=(186, 194, 208))
    cloud(d, 132, 52 + wave(t) * 2, 1.1, (120, 128, 146))
    if (t * 4) % 1 < 0.5:
        d.polygon(pts([(132, 64), (124, 82), (132, 82), (126, 98), (142, 76), (134, 76), (140, 64)]), fill=(255, 220, 80))
    peaches(img, PX, PY, t, expr='angry', mouth='frown', tail_speed=0.5)


def s_neglected(img, t):
    d = stage(img, (206, 206, 214), (172, 172, 184), floor=(160, 160, 172))
    # cobweb in the corner
    for a in range(0, 91, 18):
        rad = math.radians(a)
        d.line(pts([(0, 0), (56 * math.cos(rad), 56 * math.sin(rad))]), fill=(240, 240, 248), width=p(0.8))
    for rr in (16, 30, 44):
        d.arc(box(0, 0, rr, rr), 0, 90, fill=(240, 240, 248), width=p(0.8))
    cloud(d, 150, 54, 1.0, (130, 136, 150))
    rain(d, t, 124, 176, 64, 140)
    peaches(img, PX, PY + 3, t, expr='sad', mouth='frown', fur=(222, 196, 176), tail_speed=0.3)


def anger_mark(d, x, y, size, color=(226, 52, 60)):
    """The comic "vein pop" mark: four little curved corners."""
    s = size
    for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        d.arc(box(x + sx * s * 0.75, y + sy * s * 0.75, s * 0.7, s * 0.7), *{(-1, -1): (0, 90), (1, -1): (90, 180), (-1, 1): (270, 360), (1, 1): (180, 270)}[(sx, sy)], fill=color, width=p(2.4))


def s_angry(img, t):
    d = stage(img, (255, 214, 206), floor=(236, 160, 152))
    shake = wave(t, 6) * 2
    r = peaches(img, PX + shake, PY, t, expr='angry', mouth='open', tail_speed=4)
    d = ImageDraw.Draw(img, 'RGBA')
    pulse = 1 + 0.18 * max(0, wave(t, 2))
    anger_mark(d, r.hx + 24, r.hy - 34, 8 * pulse)
    for i, side in enumerate((-1, 1)):
        u = (t * 2 + i * 0.5) % 1.0
        size = (5 + 7 * u) * min(1, (1 - u) * 2.5)
        if size > 1:
            cloud(d, r.hx - 14 + side * 16 + side * 8 * u, r.hy - 40 - 24 * u, size / 14, (255, 255, 255))


def s_fancy(img, t):
    d = stage(img, (228, 246, 241), (196, 234, 224), floor=(176, 220, 208))
    r = peaches(img, PX, PY + bob(t, 2), t, expr='open', mouth='smile')
    d = ImageDraw.Draw(img, 'RGBA')
    bow_tie(d, r.neck[0] + 6, r.neck[1] + 2)
    monocle(d, r.eye[0], r.eye[1])
    top_hat(d, r.hat[0], r.hat[1] + 2, t, tilt=wave(t) * 1.5)
    # teacup on a little saucer
    outlined_ellipse(d, 262, 206, 22, 5, WHITE, w=1.4)
    d.rounded_rectangle([p(248), p(178), p(276), p(204)], radius=p(6), fill=WHITE, outline=LINE, width=p(1.4))
    d.arc(box(278, 190, 7, 7), 270, 90, fill=LINE, width=p(1.6))
    for i in range(2):
        u = (t + i / 2) % 1.0
        h = 7 * min(1, (1 - u) * 2.5)
        if h > 1:
            d.arc(box(258 + i * 8, 166 - 16 * u, 4, h), 100, 260, fill=(160, 172, 182), width=p(1.6))
    for i, (sx, sy) in enumerate([(56, 66), (250, 70)]):
        sparkle(d, sx, sy, 5, t, i * 0.5)


def s_sneaky(img, t):
    d = stage(img, (44, 50, 86), floor=(34, 38, 68))
    # lamp post with a soft cone of light she is carefully avoiding
    d.rectangle([p(268), p(70), p(274), p(214)], fill=(70, 74, 100), outline=LINE, width=p(1))
    outlined_poly(d, [(256, 62), (286, 62), (280, 74), (262, 74)], (90, 94, 124), w=1.2)
    cone = Image.new('RGBA', img.size, (0, 0, 0, 0))
    cd = ImageDraw.Draw(cone)
    cd.polygon(pts([(262, 74), (280, 74), (308, 214), (234, 214)]), fill=(255, 244, 190, 46))
    cd.ellipse(box(271, 213, 38, 4), fill=(255, 244, 190, 80))
    img.alpha_composite(cone.filter(ImageFilter.GaussianBlur(p(1.5))))
    d = ImageDraw.Draw(img, 'RGBA')
    tiptoe = -abs(wave(t, 2)) * 3
    r = peaches(img, PX - 14 + 12 * ((t % 1.0) - 0.5), PY + tiptoe, t, expr='shifty', paws='up')
    d = ImageDraw.Draw(img, 'RGBA')
    sunglasses(d, r.eye[0] + 1, r.eye[1])


def s_queen(img, t):
    d = stage(img, (238, 226, 252), (214, 190, 246), floor=(196, 168, 232))
    # velvet cushion
    outlined_ellipse(d, PX + 6, 212, 70, 10, (150, 40, 90), w=1.6)
    r = peaches(img, PX, PY - 4, t, expr='happy', mouth='smile')
    d = ImageDraw.Draw(img, 'RGBA')
    crown(d, r.hat[0] + 2, r.hat[1] + 2, t)
    for i, (sx, sy) in enumerate([(240, 60), (276, 110), (50, 80), (220, 150)]):
        sparkle(d, sx, sy, 6, t, i * 0.25, color=(255, 226, 120))


def s_feed(img, t):
    d = stage(img, (255, 245, 205), (255, 226, 150), floor=(246, 208, 124))
    r = peaches(img, PX, PY + bob(t, 2, 2), t, expr='happy', mouth='chew', paws='up', tail_speed=2)
    d = ImageDraw.Draw(img, 'RGBA')
    cheese_wedge(d, r.held[0] + 4, r.held[1] - 2, 0.75, bite=min(1, (t % 1.0) * 1.2))
    for i in range(4):
        u = (t * 2 + i / 4) % 1.0
        d.ellipse(box(r.held[0] + 10 + i * 5, r.held[1] + 14 + 30 * u, 1.8, 1.8), fill=CHEESE_DARK)


def s_water(img, t):
    d = stage(img, (222, 244, 255), (186, 228, 250), floor=(164, 214, 240))
    # water bottle clipped to the "cage"
    d.rounded_rectangle([p(212), p(54), p(244), p(128)], radius=p(8), fill=(190, 230, 255), outline=LINE, width=p(1.6))
    level = 92 + 12 * (t % 1.0)
    d.rectangle([p(214), p(level), p(242), p(126)], fill=(110, 190, 250))
    d.rectangle([p(224), p(128), p(232), p(146)], fill=(170, 170, 180), outline=LINE, width=p(1.2))
    bubbles(d, t, (216, 96, 240, 124), count=5)
    r = peaches(img, PX + 40, PY + 6, t, expr='closed', mouth='open', tail_speed=1)
    d = ImageDraw.Draw(img, 'RGBA')
    u = (t * 3) % 1.0
    if u < 0.7:
        d.ellipse(box(228, 150 + 10 * u, 2.4, 3.2), fill=(110, 190, 250))


def s_play(img, t):
    d = stage(img, (226, 247, 222), (196, 236, 190), floor=(170, 220, 164))
    jump = -abs(wave(t, 1)) * 16
    r = peaches(img, PX, PY + jump, t, expr='happy', mouth='open', paws='up', tail_speed=3)
    d = ImageDraw.Draw(img, 'RGBA')
    bx = 250
    by = 206 - abs(wave(t, 2)) * 70
    shadow(img, bx, 216, 12 - abs(wave(t, 2)) * 5, 3, alpha=50)
    d = ImageDraw.Draw(img, 'RGBA')
    outlined_ellipse(d, bx, by, 12, 12, (255, 110, 120), w=1.6)
    d.arc(box(bx, by, 12, 12), 200, 320, fill=WHITE, width=p(2.4))


def s_sleep(img, t):
    d = stage(img, (44, 54, 104), floor=(34, 40, 82))
    d.ellipse(box(272, 52, 20, 20), fill=(255, 244, 200))
    d.ellipse(box(282, 46, 18, 18), fill=(44, 54, 104))
    for i, (sx, sy) in enumerate([(40, 40), (110, 26), (200, 50), (150, 80), (60, 100)]):
        sparkle(d, sx, sy, 3, t, i * 0.2, color=(255, 255, 230))
    # little bed: a round cushion with a raised rim
    outlined_ellipse(d, PX + 8, 208, 78, 16, (96, 128, 214), w=1.8)
    d.ellipse(box(PX + 8, 205, 66, 9), fill=(140, 170, 240))
    for k in range(-3, 4):
        d.ellipse(box(PX + 8 + k * 18, 219, 1.4, 1.4), fill=(70, 96, 170))
    breathe = wave(t) * 1.5
    r = peaches(img, PX, PY + 6 + breathe, t, expr='closed', mouth='none', tail_speed=0.3, blink=False)
    d = ImageDraw.Draw(img, 'RGBA')
    # nightcap
    hx, hy = r.hat
    droop = wave(t) * 1.5
    outlined_poly(d, [(hx - 14, hy + 6), (hx + 16, hy + 4), (hx + 6, hy - 10), (hx - 22, hy - 14 + droop), (hx - 34, hy + 2 + droop)], (110, 150, 240), w=1.4)
    d.rounded_rectangle([p(hx - 16), p(hy + 1), p(hx + 17), p(hy + 8)], radius=p(3), fill=WHITE, outline=LINE, width=p(1.2))
    outlined_ellipse(d, hx - 35, hy + 4 + droop, 4.5, 4.5, WHITE, w=1.2)
    zzz(d, r.hx + 30, r.hy - 30, t)


def s_clean(img, t):
    d = stage(img, (226, 240, 255), (200, 224, 250), floor=(186, 212, 244))
    r = peaches(img, PX, PY + 4, t, expr='happy', mouth='smile', tail_speed=1)
    d = ImageDraw.Draw(img, 'RGBA')
    # bath tub in front of her
    d.rounded_rectangle([p(56), p(170), p(214), p(214)], radius=p(16), fill=WHITE, outline=LINE, width=p(1.8))
    for i in range(9):
        cx = 66 + i * 17 + wave(t, 1, i * 0.2) * 2
        d.ellipse(box(cx, 170, 11, 9), fill=(255, 255, 255))
        d.ellipse(box(cx, 170, 11, 9), outline=(200, 220, 245), width=p(1))
    for fx in (78, 194):
        outlined_ellipse(d, fx, 218, 5, 3, GOLD, w=1.2)
    bubbles(d, t, (60, 60, 280, 170), count=16, color=(150, 190, 240))
    sparkle(d, 250, 80, 7, t)


def s_turd(img, t):
    d = stage(img, (246, 238, 224), (232, 218, 194), floor=(222, 204, 176))
    # the evidence
    px_, py_ = 252, 204
    for r_, dy in [(14, 0), (10.5, -9), (6.5, -16)]:
        outlined_ellipse(d, px_, py_ + dy, r_, r_ * 0.62, (138, 92, 60), w=1.4)
    d.ellipse(box(px_ - 3, py_ - 18, 1.6, 1.6), fill=(255, 255, 255))
    for i in range(3):
        u = (t + i / 3) % 1.0
        sx = px_ - 12 + i * 12
        d.arc(box(sx + wave(t, 1, i * 0.3) * 2, py_ - 28 - 22 * u, 3.5, 6), 260, 100, fill=(120, 150, 90, int(220 * (1 - u))), width=p(1.6))
    # Peaches, looking away, innocent
    peaches(img, PX - 14, PY, t, expr='happy', mouth='smile', look=-1)
    d = ImageDraw.Draw(img, 'RGBA')
    for i, (nx, ny) in enumerate([(100, 96), (118, 82)]):
        u = (t + i * 0.5) % 1.0
        size = 15 * min(1, (1 - u) * 3)
        if size > 2:
            glyph(d, nx + 6 * u, ny - 12 * u, '♪', size, (120, 86, 74))


def wall(d, top=(232, 220, 200), mortar=(214, 198, 172)):
    d.rectangle([0, 0, p(DW), p(214)], fill=top)
    for row in range(0, 9):
        y = row * 24
        d.line(pts([(0, y), (DW, y)]), fill=mortar, width=p(1.3))
        off = 0 if row % 2 else 24
        for x in range(-24 + off, DW, 48):
            d.line(pts([(x, y), (x, y + 24)]), fill=mortar, width=p(1.3))


def s_hole(img, t):
    stage(img, (232, 220, 200), (224, 210, 188), floor=(206, 188, 160), vignette=False)
    d = ImageDraw.Draw(img, 'RGBA')
    wall(d)
    d.rectangle([0, p(214), p(DW), p(DH)], fill=(206, 188, 160))
    # the mouse hole
    d.chord(box(176, 214, 46, 58), 180, 360, fill=(36, 26, 30), outline=LINE, width=p(2))
    # two eyes blinking in the dark
    open_ = not (0.4 < (t % 1.0) < 0.47)
    lx = wave(t) * 6
    for ex in (164, 186):
        if open_:
            d.ellipse(box(ex + lx, 190, 5, 6), fill=(255, 240, 160))
            d.ellipse(box(ex + lx + 1, 190, 2.2, 3.5), fill=INK)
        else:
            d.line(pts([(ex + lx - 5, 190), (ex + lx + 5, 190)]), fill=(255, 240, 160), width=p(1.6))
    # whiskers poking out
    d.line(pts([(204, 200), (222 + wave(t, 2) * 2, 194)]), fill=(200, 180, 170), width=p(1))
    d.line(pts([(204, 204), (224 + wave(t, 2) * 2, 204)]), fill=(200, 180, 170), width=p(1))


def gift_box(d, x, y, w, h, color, ribbon, t=0.0, lid_lift=0.0):
    d.rectangle([p(x - w), p(y - h), p(x + w), p(y + h)], fill=color, outline=LINE, width=p(1.5))
    d.rectangle([p(x - 3.5), p(y - h), p(x + 3.5), p(y + h)], fill=ribbon)
    ly = y - h - lid_lift
    d.rectangle([p(x - w - 3), p(ly - 7), p(x + w + 3), p(ly)], fill=color, outline=LINE, width=p(1.5))
    d.rectangle([p(x - 3.5), p(ly - 7), p(x + 3.5), p(ly)], fill=ribbon)
    outlined_ellipse(d, x - 7, ly - 11, 7, 5, ribbon, w=1.2)
    outlined_ellipse(d, x + 7, ly - 11, 7, 5, ribbon, w=1.2)


def s_gift(img, t):
    d = stage(img, (255, 232, 238), (255, 206, 218), floor=(246, 188, 204))
    r = peaches(img, PX, PY + bob(t, 3), t, expr='happy', mouth='smile', paws='up')
    d = ImageDraw.Draw(img, 'RGBA')
    gift_box(d, r.held[0] + 6, r.held[1] - 4, 15, 12, (120, 190, 255), (255, 226, 90), t, lid_lift=max(0, wave(t)) * 4)
    for i in range(3):
        u = (t + i / 3) % 1.0
        heart(d, 236 + i * 16, 120 - 60 * u, 5.5 * min(1, (1 - u) * 3))


def s_shred(img, t):
    d = stage(img, (236, 244, 248), (214, 228, 236), floor=(196, 214, 224))
    # tiles
    for x in range(0, DW, 32):
        d.line(pts([(x, 0), (x, 214)]), fill=(210, 224, 232), width=p(1))
    for y in range(0, 214, 32):
        d.line(pts([(0, y), (DW, y)]), fill=(210, 224, 232), width=p(1))
    # roll on its holder, unrolling to the floor
    d.rectangle([p(232), p(64), p(290), p(70)], fill=(180, 186, 196), outline=LINE, width=p(1.2))
    outlined_ellipse(d, 262, 92, 18, 18, WHITE, w=1.6)
    d.ellipse(box(262, 92, 6, 6), fill=(200, 170, 140))
    sway = wave(t) * 3
    trail = []
    for i in range(30):
        u = i / 29
        trail.append((252 - 30 * u - 22 * u * u + sway * math.sin(u * math.pi), 106 + 104 * u))
    d.line(pts(trail), fill=LINE, width=p(12), joint='curve')
    d.line(pts(trail), fill=WHITE, width=p(9.5), joint='curve')
    # confetti of shredded bits
    def bit(dd, x, y, i):
        if x < 40 or x > 300:
            return
        dd.rectangle(box(x, y, 3.2, 2), fill=(255, 255, 255), outline=(200, 210, 220), width=1)
    falling(d, t, 22, bit)
    peaches(img, PX - 6, PY, t, expr='happy', mouth='open', paws='up', tail_speed=3)
    d = ImageDraw.Draw(img, 'RGBA')
    outlined_poly(d, [(PX + 52, PY - 12), (PX + 66, PY - 14), (PX + 68, PY - 6), (PX + 64, PY - 2), (PX + 66, PY + 2), (PX + 54, PY + 4), (PX + 52, PY - 4)], WHITE, w=1.1)


def s_walls(img, t):
    stage(img, (232, 220, 200), (224, 210, 188), floor=(206, 188, 160), vignette=False)
    d = ImageDraw.Draw(img, 'RGBA')
    wall(d)
    d.rectangle([0, p(214), p(DW), p(DH)], fill=(206, 188, 160))
    # crack in the wall she's peeking out of
    d.polygon(pts([(128, 60), (196, 64), (204, 120), (182, 150), (120, 140), (112, 100)]), fill=(36, 26, 30), outline=LINE, width=p(2))
    peek = 6 * wave(t, 1)
    # just her head poking out
    hx, hy = 156 + peek, 108
    for ex, ey, rx, ry in [(hx, hy, 26, 22), (hx + 24, hy + 7, 14, 10), (hx - 6, hy - 22, 14, 14)]:
        d.ellipse(box(ex, ey, rx + 2, ry + 2), fill=LINE)
    d.ellipse(box(hx, hy, 26, 22), fill=FUR)
    d.ellipse(box(hx + 24, hy + 7, 14, 10), fill=FUR)
    d.ellipse(box(hx - 6, hy - 22, 14, 14), fill=FUR)
    d.ellipse(box(hx - 6, hy - 22, 8.5, 8.5), fill=PINK)
    d.ellipse(box(hx + 37, hy + 5, 4.6, 3.8), fill=PINK_DEEP)
    if 0.86 < (t % 1.0) < 0.93:
        d.line(pts([(hx + 6, hy - 3), (hx + 15, hy - 3)]), fill=INK, width=p(2))
    else:
        d.ellipse(box(hx + 10, hy - 3, 4.4, 5.2), fill=INK)
        d.ellipse(box(hx + 11.5, hy - 5.4, 1.5, 1.5), fill=WHITE)
    d.arc(box(hx + 26, hy + 14, 3, 2.2), 10, 170, fill=INK, width=p(1.3))
    # "squeak" lines
    for i in range(3):
        reach = 12 + 6 * (0.5 + 0.5 * wave(t, 2, i * 0.2))
        d.line(pts([(214, 82 + i * 14), (214 + reach, 78 + i * 15)]), fill=(140, 100, 80), width=p(2))


def s_ruler(img, t):
    d = stage(img, (255, 243, 204), (248, 220, 140), floor=(236, 200, 110))
    # banner behind her
    sway = wave(t) * 2
    outlined_poly(d, [(60, 24), (188, 24), (188 + sway, 120), (124 + sway, 104), (60 + sway, 120)], (176, 36, 60), w=1.6)
    crown(d, 124 + sway, 74, t, 1.2)
    # throne
    d.rounded_rectangle([p(PX - 46), p(118), p(PX + 54), p(214)], radius=p(10), fill=(170, 110, 50), outline=LINE, width=p(1.8))
    d.rounded_rectangle([p(PX - 38), p(128), p(PX + 46), p(206)], radius=p(8), fill=(190, 40, 80), outline=LINE, width=p(1.4))
    r = peaches(img, PX, PY, t, expr='happy', mouth='smile', paws='up')
    d = ImageDraw.Draw(img, 'RGBA')
    crown(d, r.hat[0] + 2, r.hat[1] + 2, t, 0.85)
    # scepter
    d.line(pts([(r.held[0] + 4, r.held[1] + 18), (r.held[0] + 18, r.held[1] - 40)]), fill=GOLD, width=p(4))
    outlined_ellipse(d, r.held[0] + 19, r.held[1] - 44, 7, 7, (120, 200, 255), w=1.4)
    sparkle(d, r.held[0] + 28, r.held[1] - 54, 6, t)


def s_crumbs(img, t):
    d = stage(img, (255, 240, 222), (255, 222, 196), floor=(248, 206, 172))
    r = peaches(img, PX - 10, PY + bob(t, 3), t, expr='happy', mouth='smile', tail_speed=2)
    d = ImageDraw.Draw(img, 'RGBA')
    # a trail of crumbs leading to you
    for i, (cx, cy) in enumerate([(206, 208), (226, 211), (246, 207), (266, 212), (286, 209)]):
        pop = max(0, wave(t, 1, -i * 0.12)) * 2
        outlined_ellipse(d, cx, cy - pop, 4.5, 3.4, (230, 180, 110), w=1)
    cheese_wedge(d, 292, 196, 0.5)


def s_bite(img, t):
    d = stage(img, (255, 226, 214), (250, 190, 170), floor=(240, 170, 150))
    lunge = max(0, wave(t, 1)) * 14
    r = peaches(img, PX + lunge, PY, t, expr='angry', mouth='open', tail_speed=3)
    d = ImageDraw.Draw(img, 'RGBA')
    # impact lines + a bitten finger-shaped thing (a breadstick: deniable)
    bx = 236
    d.rounded_rectangle([p(bx), p(150), p(bx + 70), p(166)], radius=p(8), fill=(232, 190, 120), outline=LINE, width=p(1.5))
    for k in range(3):
        d.ellipse(box(bx + 2, 152 + k * 5, 3, 3), fill=lerp((255, 222, 196), (250, 190, 170), 0.3))
    if lunge > 8:
        for ang in (-40, -10, 20, 50):
            a = math.radians(ang)
            d.line(pts([(bx - 8 + 12 * math.cos(a), 158 + 12 * math.sin(a)), (bx - 8 + 24 * math.cos(a), 158 + 24 * math.sin(a))]), fill=(200, 60, 60), width=p(2))


# --- seasonal & event scenes (same rig, same stage) ----------------------------

def night_stage(img, t, top=(40, 26, 70), bottom=(78, 44, 108), floor=(30, 22, 44)):
    d = stage(img, top, bottom, floor=floor)
    d.ellipse(box(266, 48, 24, 24), fill=(255, 244, 200))
    d.ellipse(box(277, 42, 22, 22), fill=top)
    for i, (sx, sy) in enumerate([(30, 30), (90, 18), (150, 40), (205, 22), (120, 70), (40, 90)]):
        sparkle(d, sx, sy, 2.4, t, i * 0.2, color=(255, 255, 230))
    return d


def bat(d, x, y, t, size=1.0):
    flap = wave(t, 3) * 7 * size
    d.polygon(pts([(x, y), (x - 14 * size, y - flap), (x - 7 * size, y + 2), (x, y + 4 * size), (x + 7 * size, y + 2), (x + 14 * size, y - flap)]), fill=(22, 14, 28))


def pumpkin(img, x, y, t):
    flicker = 0.75 + 0.25 * wave(t, 3) * wave(t, 5, 0.2)
    glow(img, x, y, 56, 42, (255, 150, 40), int(90 * flicker))
    d = ImageDraw.Draw(img, 'RGBA')
    for dx in (-17, 17, 0):
        outlined_ellipse(d, x + dx, y, 21, 25, (242, 124, 34), w=1.6)
    d.rectangle(box(x, y - 27, 3.5, 6), fill=(84, 112, 44), outline=LINE, width=p(1))
    lit = (255, int(212 + 40 * flicker), int(90 * flicker))
    d.polygon(pts([(x - 15, y - 5), (x - 5, y - 5), (x - 10, y - 14)]), fill=lit)
    d.polygon(pts([(x + 5, y - 5), (x + 15, y - 5), (x + 10, y - 14)]), fill=lit)
    d.polygon(pts([(x - 19, y + 4), (x + 19, y + 4), (x + 11, y + 13), (x + 4, y + 8), (x - 4, y + 13), (x - 11, y + 8)]), fill=lit)


def s_halloween(img, t):
    d = night_stage(img, t)
    bat(d, 60 + 26 * wave(t), 52 + 6 * wave(t, 2), t, 1.6)
    bat(d, 200 - 18 * wave(t), 74, t + 0.3, 1.1)
    pumpkin(img, 254, 182, t)
    r = peaches(img, PX - 8, PY + bob(t, 4), t, expr='happy', mouth='smile')
    d = ImageDraw.Draw(img, 'RGBA')
    witch_hat(d, r.hat[0] + 2, r.hat[1] + 4, t)


def s_ghost(img, t):
    d = night_stage(img, t)
    bat(d, 254, 100 + 5 * wave(t), t, 1.3)
    float_y = wave(t) * 7
    cx, cy = 150, 140 + float_y
    shadow(img, cx, 216, 42 - float_y, 6, alpha=50)
    d = ImageDraw.Draw(img, 'RGBA')
    tail = [(cx - 26 - 50 * u, cy + 44 + 10 * u + 6 * u * wave(t, 1, -u)) for u in [i / 20 for i in range(21)]]
    d.line(pts(tail), fill=LINE, width=p(7.5), joint='curve')
    d.line(pts(tail), fill=PINK, width=p(4.6), joint='curve')
    for ex in (-22, 22):
        outlined_ellipse(d, cx + ex, cy - 62, 14, 14, FUR, w=2)
        d.ellipse(box(cx + ex, cy - 62, 8, 8), fill=PINK)
    sheet = [(cx + 52 * math.cos(math.pi + math.pi * i / 39), cy - 8 + 56 * math.sin(math.pi + math.pi * i / 39)) for i in range(40)]
    for i in range(9):
        sheet.append((cx + 52 - i * 13, cy + 46 + (6 if i % 2 else -2) + wave(t, 1, i * 0.15) * 3))
    d.polygon(pts(sheet), fill=(246, 246, 255))
    d.line(pts(sheet + [sheet[0]]), fill=LINE, width=p(2), joint='curve')
    d.ellipse(box(cx - 14, cy - 18, 7, 10), fill=INK)
    d.ellipse(box(cx + 14, cy - 18, 7, 10), fill=INK)
    d.ellipse(box(cx, cy + 2, 7.5, 6), fill=INK)
    d.ellipse(box(cx - 21, cy - 2, 6, 3.5), fill=(255, 196, 206))
    d.ellipse(box(cx + 21, cy - 2, 6, 3.5), fill=(255, 196, 206))


def winter_stage(img, t):
    d = stage(img, (30, 46, 96), (58, 86, 140), floor=(236, 244, 255))
    d.ellipse(box(60, 220, 90, 12), fill=(250, 252, 255))
    d.ellipse(box(254, 222, 110, 10), fill=(250, 252, 255))
    return d


def snow(d, t, count=34):
    def flake(dd, x, y, i):
        r = 1.5 + (i % 3) * 0.8
        dd.ellipse(box(x, y, r, r), fill=(255, 255, 255, 230))
    falling(d, t, count, flake)


def snowman(d, x, y):
    outlined_ellipse(d, x, y, 24, 22, (250, 252, 255), w=1.6)
    outlined_ellipse(d, x, y - 32, 17, 16, (250, 252, 255), w=1.6)
    for ex in (-6, 6):
        d.ellipse(box(x + ex, y - 35, 2.2, 2.2), fill=INK)
    d.polygon(pts([(x, y - 30), (x + 14, y - 28), (x, y - 26)]), fill=(255, 140, 30))
    d.rectangle([p(x - 13), p(y - 50), p(x + 13), p(y - 46)], fill=INK)
    d.rectangle([p(x - 9), p(y - 66), p(x + 9), p(y - 48)], fill=INK)
    d.rectangle([p(x - 9), p(y - 54), p(x + 9), p(y - 50)], fill=RED)


def s_winter(img, t):
    d = winter_stage(img, t)
    gift_box(d, 240, 196, 18, 14, (70, 140, 220), (255, 220, 80))
    gift_box(d, 280, 202, 12, 9, (220, 60, 80), WHITE)
    gift_box(d, 262, 166, 11, 8, (80, 180, 110), (230, 60, 60))
    r = peaches(img, PX - 8, PY + bob(t, 4), t, expr='happy', mouth='smile')
    d = ImageDraw.Draw(img, 'RGBA')
    santa_hat(d, r.hat[0] + 2, r.hat[1] + 6, t)
    snow(d, t)


def s_frosty(img, t):
    d = winter_stage(img, t)
    snowman(d, 258, 190)
    r = peaches(img, PX - 8, PY + bob(t, 3), t, expr='open', mouth='smile')
    d = ImageDraw.Draw(img, 'RGBA')
    scarf(d, r.cx, r.cy, t)
    # earmuffs: band over the top of her head, a fluffy muff over each ear
    d.arc(box(r.hx - 4, r.hy - 14, 24, 20), 200, 300, fill=LINE, width=p(5))
    d.arc(box(r.hx - 4, r.hy - 14, 24, 20), 200, 300, fill=(110, 120, 200), width=p(3))
    # one fluffy muff over the ear we can see (two side by side read as goggles)
    ex, ey = r.hx - 7, r.hy - 26
    for k in range(8):
        a = k * math.pi / 4
        d.ellipse(box(ex + math.cos(a) * 7, ey + math.sin(a) * 7, 5.5, 5.5), fill=LINE)
    for k in range(8):
        a = k * math.pi / 4
        d.ellipse(box(ex + math.cos(a) * 7, ey + math.sin(a) * 7, 4.2, 4.2), fill=(236, 242, 255))
    d.ellipse(box(ex, ey, 8, 8), fill=(236, 242, 255))
    d.ellipse(box(ex - 2, ey - 2, 3, 3), fill=WHITE)
    snow(d, t, 44)


def cake(d, x, y, t):
    d.rounded_rectangle([p(x - 34), p(y - 20), p(x + 34), p(y + 20)], radius=p(4), fill=(252, 226, 238), outline=LINE, width=p(1.6))
    d.rectangle([p(x - 34), p(y - 20), p(x + 34), p(y - 9)], fill=(255, 152, 192))
    for i in range(5):
        d.ellipse(box(x - 27 + i * 13.5, y - 9, 5, 5), fill=(255, 152, 192))
    d.rectangle([p(x - 3), p(y - 40), p(x + 3), p(y - 20)], fill=(120, 200, 255), outline=LINE, width=p(1))
    fl = 1 + 0.22 * wave(t, 4)
    d.ellipse(box(x, y - 46, 4 * fl, 7 * fl), fill=(255, 200, 60))
    d.ellipse(box(x, y - 45, 2, 3.5), fill=(255, 250, 200))


def confetti(d, t):
    colors = [(255, 100, 170), (110, 196, 255), (255, 226, 80), (140, 226, 120)]
    def piece(dd, x, y, i):
        dd.rectangle(box(x, y, 2.4, 3.8), fill=colors[i % 4])
    falling(d, t, 26, piece)


def s_birthday(img, t):
    d = stage(img, (200, 228, 255), (176, 210, 250), floor=(150, 200, 150))
    cake(d, 250, 188, t)
    r = peaches(img, PX - 8, PY + bob(t, 5), t, expr='happy', mouth='open')
    d = ImageDraw.Draw(img, 'RGBA')
    party_hat(d, r.hat[0] + 2, r.hat[1] + 6, t)
    confetti(d, t)


# --- Valentine's / spring / summer ---------------------------------------------

def heart_headband(d, r, t):
    hx, hy = r.hat
    d.arc(box(hx + 2, hy + 10, 26, 18), 200, 340, fill=(214, 60, 110), width=p(3))
    for i, (dx, dy) in enumerate([(-18, -2), (16, -6)]):
        bounce = wave(t, 2, i * 0.5) * 2
        d.line(pts([(hx + dx * 0.6, hy + 2), (hx + dx, hy - 12 + dy + bounce)]), fill=(214, 60, 110), width=p(1.4))
        heart(d, hx + dx, hy - 16 + dy + bounce, 5.5, color=(240, 70, 120))


def wing(d, x, y, t, scale=1.0, shade=False):
    """A cartoon wing: a fan of long rounded feathers growing up-and-back from a shoulder at (x, y)."""
    flap = wave(t, 3) * 9
    fill = (234, 236, 250) if shade else WHITE
    feathers = [(-168, 30), (-146, 34), (-124, 30), (-104, 24)]  # (angle°, length)
    for angle, length in feathers:
        a = math.radians(angle + flap)
        length *= scale
        cx_, cy_ = x + math.cos(a) * length * 0.55, y + math.sin(a) * length * 0.55
        outlined_poly(d, rot_ellipse(cx_, cy_, length * 0.55, 6.5 * scale, angle + flap), fill, w=1.4)
    outlined_ellipse(d, x, y, 9 * scale, 8 * scale, fill, w=1.4)


def wings(d, cx, cy, t):
    """Two wings rising from her upper back, clear of the body outline."""
    wing(d, cx - 20, cy - 32, t + 0.05, 1.45, shade=True)
    wing(d, cx - 30, cy - 24, t, 1.65)


def bow_and_arrow(d, x, y):
    d.arc(box(x, y, 10, 22), 270, 90, fill=(170, 110, 50), width=p(2.6))
    d.line(pts([(x, y - 22), (x, y + 22)]), fill=(120, 120, 120), width=p(0.9))
    d.line(pts([(x - 16, y), (x + 22, y)]), fill=(150, 100, 60), width=p(1.8))
    heart(d, x + 25, y + 1, 4, color=(240, 70, 120))


def choc_box(d, x, y):
    heart(d, x, y, 22, color=(176, 36, 60))
    heart(d, x, y - 2, 18, color=(214, 60, 90))
    for dx, dy in [(-8, -6), (8, -6), (0, 4), (-5, 10), (5, 10)]:
        outlined_ellipse(d, x + dx, y + dy, 4, 4, (110, 60, 40), w=0.8)


def s_valentines(img, t):
    d = stage(img, (255, 228, 238), (255, 196, 216), floor=(246, 176, 200))
    for i in range(6):
        u = (t + i / 6) % 1.0
        heart(d, 30 + i * 52 + wave(t, 1, i * 0.2) * 5, 200 - 190 * u, (4.5 + (i % 3) * 1.5) * min(1, (1 - u) * 3), color=(255, 140, 175))
    choc_box(d, 258, 186)
    r = peaches(img, PX - 8, PY + bob(t, 4), t, expr='happy', mouth='smile')
    d = ImageDraw.Draw(img, 'RGBA')
    heart_headband(d, r, t)


def s_cupid(img, t):
    d = stage(img, (252, 232, 248), (236, 206, 246), floor=(226, 190, 236))
    float_y = wave(t) * 6
    cx, cy = PX - 8, PY - 18 + float_y
    wings(d, cx, cy, t)
    r = peaches(img, cx, cy, t, expr='open', mouth='smile', paws='up')
    d = ImageDraw.Draw(img, 'RGBA')
    bow_and_arrow(d, r.held[0] + 14, r.held[1] - 4)
    for i, (sx, sy) in enumerate([(240, 60), (276, 110), (50, 70)]):
        sparkle(d, sx, sy, 6, t, i * 0.3, color=(255, 190, 220))


def flower(d, x, y, petal, center=(255, 214, 80), r=6):
    for k in range(5):
        a = k * 2 * math.pi / 5
        d.ellipse(box(x + math.cos(a) * r * 0.9, y + math.sin(a) * r * 0.9, r * 0.75, r * 0.75), fill=petal)
    d.ellipse(box(x, y, r * 0.55, r * 0.55), fill=center)


def flower_crown(d, r, t):
    hx, hy = r.hat
    d.arc(box(hx + 2, hy + 8, 26, 14), 200, 340, fill=(90, 160, 80), width=p(3))
    for i, (dx, col) in enumerate([(-20, (255, 160, 190)), (-6, (255, 236, 120)), (8, (190, 160, 255)), (20, (255, 160, 190))]):
        flower(d, hx + dx, hy + 2 - abs(dx) * 0.15 + wave(t, 1, i * 0.25) * 0.8, col, r=5)


def egg(d, x, y, color, stripe, scale=1.0):
    outlined_ellipse(d, x, y, 9 * scale, 12 * scale, color, w=1.3)
    d.arc(box(x, y + 2 * scale, 9 * scale, 6 * scale), 200, 340, fill=stripe, width=p(2.2 * scale))
    for dx in (-4, 0, 4):
        d.ellipse(box(x + dx * scale, y - 5 * scale, 1.3 * scale, 1.3 * scale), fill=stripe)


def rot_ellipse(cx, cy, rx, ry, angle_deg, n=28):
    a = math.radians(angle_deg)
    return [(cx + rx * math.cos(u) * math.cos(a) - ry * math.sin(u) * math.sin(a), cy + rx * math.cos(u) * math.sin(a) + ry * math.sin(u) * math.cos(a)) for u in [2 * math.pi * i / n for i in range(n)]]


def bunny_ears(d, r, t):
    hx, hy = r.hat
    flop = wave(t) * 4
    for dx, tilt in [(-10, -14), (10, 10 + flop)]:
        outlined_poly(d, rot_ellipse(hx + dx, hy - 20, 8, 22, tilt - 90 + 90), WHITE, w=1.5)
        d.polygon(pts(rot_ellipse(hx + dx, hy - 18, 4.2, 15, tilt)), fill=(255, 190, 206))
    d.rounded_rectangle([p(hx - 20), p(hy + 1), p(hx + 18), p(hy + 7)], radius=p(3), fill=(255, 160, 190), outline=LINE, width=p(1.2))


def butterfly(d, x, y, t, color):
    open_ = 0.35 + 0.65 * abs(wave(t, 4))
    for side in (-1, 1):
        d.ellipse(box(x + side * 6 * open_, y - 3, 6.5 * open_ + 1, 6), fill=color, outline=LINE, width=p(1))
        d.ellipse(box(x + side * 4.5 * open_, y + 5, 4.5 * open_ + 0.8, 4), fill=color, outline=LINE, width=p(1))
    d.line(pts([(x, y - 6), (x, y + 8)]), fill=LINE, width=p(1.8))
    d.line(pts([(x, y - 6), (x - 3, y - 11)]), fill=LINE, width=p(0.9))
    d.line(pts([(x, y - 6), (x + 3, y - 11)]), fill=LINE, width=p(0.9))


def s_spring(img, t):
    d = stage(img, (232, 246, 255), (214, 238, 250), floor=(150, 210, 120))
    for i, (fx, col) in enumerate([(30, (255, 160, 190)), (220, (255, 236, 120)), (292, (190, 160, 255)), (250, (255, 160, 190))]):
        d.line(pts([(fx, 216), (fx, 196)]), fill=(90, 160, 80), width=p(2))
        flower(d, fx, 192 + wave(t, 1, i * 0.3), col, r=6)
    egg(d, 262, 204, (180, 220, 255), (255, 140, 180))
    egg(d, 286, 208, (255, 230, 150), (120, 190, 120), 0.8)
    r = peaches(img, PX - 10, PY + bob(t, 4), t, expr='happy', mouth='smile')
    d = ImageDraw.Draw(img, 'RGBA')
    flower_crown(d, r, t)
    for i, col in enumerate([(255, 180, 70), (190, 150, 255)]):
        x = 210 + 46 * i + wave(t, 1, i * 0.4) * 14
        y = 72 + 20 * i + wave(t, 2, i * 0.3) * 8
        butterfly(d, x, y, t + i * 0.3, col)


def s_bunny(img, t):
    d = stage(img, (240, 250, 236), (220, 244, 214), floor=(150, 210, 120))
    basket_x = 262
    d.arc(box(basket_x, 186, 24, 24), 180, 360, fill=(160, 110, 60), width=p(3))
    d.rounded_rectangle([p(basket_x - 26), p(186), p(basket_x + 26), p(214)], radius=p(6), fill=(200, 150, 90), outline=LINE, width=p(1.5))
    for dx, col, st in [(-12, (255, 196, 210), (150, 120, 220)), (2, (180, 220, 255), (255, 140, 180)), (14, (255, 230, 150), (120, 190, 120))]:
        egg(d, basket_x + dx, 182, col, st, 0.8)
    hop = -abs(wave(t, 1)) * 12
    r = peaches(img, PX - 10, PY + hop, t, expr='happy', mouth='open', tail_speed=2)
    d = ImageDraw.Draw(img, 'RGBA')
    bunny_ears(d, r, t)


def sun_hat(d, r, t):
    hx, hy = r.hat
    outlined_ellipse(d, hx + 2, hy + 2, 34, 7, (246, 214, 140), w=1.5)
    d.chord(box(hx + 2, hy + 2, 18, 16), 180, 360, fill=(246, 214, 140), outline=LINE, width=p(1.5))
    d.rectangle([p(hx - 16), p(hy - 3), p(hx + 20), p(hy + 1)], fill=(255, 120, 140))
    flower(d, hx + 14, hy - 3, (255, 255, 255), r=4)


def float_ring(d, cx, cy):
    outlined_ellipse(d, cx + 4, cy + 16, 54, 18, (255, 110, 120), w=1.8)
    d.ellipse(box(cx + 4, cy + 14, 38, 9), fill=(96, 186, 230))  # the water showing through the middle
    for a in (30, 150, 270):
        rad = math.radians(a)
        d.ellipse(box(cx + 4 + 46 * math.cos(rad), cy + 16 + 15 * math.sin(rad), 8, 5), fill=WHITE)


def ice_cream(d, x, y, t):
    outlined_poly(d, [(x - 10, y), (x + 10, y), (x, y + 28)], (226, 176, 110), w=1.4)
    for k in range(3):
        d.line(pts([(x - 8 + k * 6, y + 2), (x - 2 + k * 6, y + 14)]), fill=(196, 140, 80), width=p(1))
    outlined_ellipse(d, x, y - 6, 11, 9, (255, 196, 210), w=1.4)
    outlined_ellipse(d, x - 2, y - 17, 9, 8, (250, 246, 230), w=1.4)
    drip = (t * 2) % 1.0
    d.ellipse(box(x + 8, y + 2 + 8 * drip, 2.2, 3), fill=(255, 196, 210, int(255 * (1 - drip))))
    d.ellipse(box(x - 2, y - 27, 3, 3), fill=RED)


def beach_stage(img, t):
    d = stage(img, (150, 214, 255), (196, 236, 255), floor=(246, 222, 168))
    d.rectangle([0, p(176), p(DW), p(214)], fill=(96, 186, 230))
    for i in range(7):
        x = (i * 52 + t * 52) % (DW + 52) - 26
        d.arc(box(x, 180, 14, 5), 200, 340, fill=WHITE, width=p(1.6))
    d.ellipse(box(270, 46, 20, 20), fill=(255, 220, 90))
    glow(img, 270, 46, 30, 30, (255, 230, 120), 90)
    return ImageDraw.Draw(img, 'RGBA')


def s_summer(img, t):
    d = beach_stage(img, t)
    # umbrella
    d.line(pts([(268, 214), (262, 132)]), fill=(150, 110, 70), width=p(2.4))
    wedges = 6
    for k in range(wedges):
        a0 = math.pi + math.pi * k / wedges
        a1 = math.pi + math.pi * (k + 1) / wedges
        arc_pts = [(262 + 46 * math.cos(a0 + (a1 - a0) * j / 6), 136 + 28 * math.sin(a0 + (a1 - a0) * j / 6)) for j in range(7)]
        d.polygon(pts([(262, 136)] + arc_pts), fill=(255, 112, 124) if k % 2 == 0 else WHITE)
    rim = [(262 + 46 * math.cos(math.pi + math.pi * j / 36), 136 + 28 * math.sin(math.pi + math.pi * j / 36)) for j in range(37)]
    d.line(pts(rim + [(262 - 46, 136)]), fill=LINE, width=p(1.6))
    d.line(pts([(216, 136), (308, 136)]), fill=LINE, width=p(1.6))
    r = peaches(img, PX - 10, PY + bob(t, 3), t, expr='happy', mouth='smile', paws='up')
    d = ImageDraw.Draw(img, 'RGBA')
    sun_hat(d, r, t)
    ice_cream(d, r.held[0] + 2, r.held[1] - 14, t)


def s_beach(img, t):
    d = beach_stage(img, t)
    bobbing = wave(t) * 3
    cx, cy = PX + 10, PY - 4 + bobbing
    r = peaches(img, cx, cy, t, expr='happy', mouth='smile')
    d = ImageDraw.Draw(img, 'RGBA')
    float_ring(d, cx, cy + 22)
    sunglasses(d, r.eye[0] + 1, r.eye[1])
    for i in range(4):
        u = (t + i / 4) % 1.0
        d.ellipse(box(cx - 60 + i * 30, 196 - 4 * u, 3 + 3 * u, 1.2 + u), outline=(255, 255, 255, int(200 * (1 - u))), width=p(1))


SCENES = {
    # moods
    'content': s_content,
    'thriving': s_thriving,
    'restless': s_restless,
    'grumpy': s_grumpy,
    'neglected': s_neglected,
    # visitor variants
    'fancy': s_fancy,
    'angry': s_angry,
    'sneaky': s_sneaky,
    'queen': s_queen,
    'ghost': s_ghost,
    'frosty': s_frosty,
    # care actions
    'feed': s_feed,
    'water': s_water,
    'play': s_play,
    'sleep': s_sleep,
    'clean': s_clean,
    # mischief
    'turd': s_turd,
    'hole': s_hole,
    'gift': s_gift,
    'shred': s_shred,
    'walls': s_walls,
    'ruler': s_ruler,
    'crumbs': s_crumbs,
    'bite': s_bite,
    # events
    'halloween': s_halloween,
    'winter': s_winter,
    'birthday': s_birthday,
    'valentines': s_valentines,
    'cupid': s_cupid,
    'spring': s_spring,
    'bunny': s_bunny,
    'summer': s_summer,
    'beach': s_beach,
}


def render(name):
    scene = SCENES[name]
    frames = []
    for i in range(FRAMES):
        t = i / FRAMES
        img = Image.new('RGBA', (OUT_W * SS, OUT_H * SS), (0, 0, 0, 255))
        scene(img, t)
        frames.append(img.resize((OUT_W, OUT_H), Image.LANCZOS).convert('RGB'))
    # One shared palette across all frames keeps colours steady (no flicker between frames).
    strip = Image.new('RGB', (OUT_W, OUT_H * len(frames)))
    for i, f in enumerate(frames):
        strip.paste(f, (0, i * OUT_H))
    palette = strip.quantize(colors=255, method=Image.MEDIANCUT)
    paletted = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
    path = os.path.join(OUT, f'{name}.gif')
    paletted[0].save(path, save_all=True, append_images=paletted[1:], duration=FRAME_MS, loop=0, optimize=True, disposal=1)
    return frames[0], path


def contact_sheet(first_frames, path):
    cols = 6
    thumb_w, thumb_h = OUT_W // 2, OUT_H // 2
    rows = math.ceil(len(first_frames) / cols)
    sheet = Image.new('RGB', (cols * thumb_w, rows * (thumb_h + 14)), (250, 250, 250))
    d = ImageDraw.Draw(sheet)
    for i, (name, frame) in enumerate(first_frames):
        x, y = (i % cols) * thumb_w, (i // cols) * (thumb_h + 14)
        sheet.paste(frame.resize((thumb_w, thumb_h), Image.LANCZOS), (x, y))
        d.text((x + 4, y + thumb_h + 1), name, fill=(40, 40, 40))
    sheet.save(path)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    names = args or list(SCENES)
    firsts = []
    for name in names:
        frame, path = render(name)
        firsts.append((name, frame))
        print(f'{name:<10} {os.path.getsize(path) // 1024:>4} KB')
    if '--strip' in sys.argv:
        for name in names:
            strip = Image.new('RGB', (OUT_W // 2 * 4, OUT_H // 2), (255, 255, 255))
            for k, i in enumerate((0, 4, 8, 12)):
                img = Image.new('RGBA', (OUT_W * SS, OUT_H * SS), (0, 0, 0, 255))
                SCENES[name](img, i / FRAMES)
                strip.paste(img.resize((OUT_W // 2, OUT_H // 2), Image.LANCZOS).convert('RGB'), (k * OUT_W // 2, 0))
            strip.save(os.path.join(OUT, f'_strip_{name}.png'))
    if '--sheet' in sys.argv:
        contact_sheet(firsts, os.path.join(OUT, '_contact_sheet.png'))
