"""
Draws Peaches' built-in animated GIFs (original artwork, no external assets).
Re-run to regenerate:  python3 bot/tools/draw_peaches.py
Requires Pillow.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'peaches')
W, H = 320, 240
S = 3  # supersampling factor for smooth edges
FRAMES = 16

FUR = (236, 200, 172)
FUR_SHADE = (214, 172, 142)
BELLY = (250, 228, 210)
PINK = (244, 156, 170)
PINK_DARK = (214, 112, 132)
INK = (40, 30, 36)


def s(v):
    return int(round(v * S))


def box(cx, cy, rx, ry):
    return [s(cx - rx), s(cy - ry), s(cx + rx), s(cy + ry)]


def tail(d, x0, y0, t, color=PINK, width=6):
    pts = []
    for i in range(24):
        u = i / 23
        x = x0 - 70 * u
        y = y0 + 10 * math.sin(u * math.pi * 1.6 + t * 2 * math.pi) * u + 20 * u
        pts.append((s(x), s(y)))
    d.line(pts, fill=color, width=s(width), joint='curve')


def rat(d, cx, cy, t, fur=FUR, shade=FUR_SHADE, belly=BELLY, outline=None):
    """Sitting cartoon rat facing right; (cx, cy) is the body centre. Returns the head-top point."""
    blink = (t % 1.0) > 0.86
    tail(d, cx - 30, cy + 28, t)
    d.ellipse(box(cx, cy, 46, 40), fill=fur, outline=outline, width=s(2) if outline else 0)  # body
    d.ellipse(box(cx + 8, cy + 8, 28, 26), fill=belly)  # belly
    hx, hy = cx + 34, cy - 30
    d.ellipse(box(hx - 22, hy - 22, 17, 17), fill=shade)  # back ear
    d.ellipse(box(hx - 22, hy - 22, 10, 10), fill=PINK)
    d.ellipse(box(hx, hy, 30, 26), fill=fur, outline=outline, width=s(2) if outline else 0)  # head
    d.ellipse(box(hx + 26, hy + 8, 16, 12), fill=fur)  # snout
    d.ellipse(box(hx + 40, hy + 6, 5, 4), fill=PINK_DARK)  # nose
    d.ellipse(box(hx - 8, hy - 26, 18, 18), fill=fur)  # front ear
    d.ellipse(box(hx - 8, hy - 26, 11, 11), fill=PINK)
    if blink:
        d.line([s(hx + 6), s(hy - 2), s(hx + 16), s(hy - 2)], fill=INK, width=s(2))
    else:
        d.ellipse(box(hx + 11, hy - 3, 5, 6), fill=INK)
        d.ellipse(box(hx + 13, hy - 6, 1.6, 1.6), fill=(255, 255, 255))
    d.ellipse(box(hx + 18, hy + 10, 5, 3), fill=(255, 180, 190))  # cheek
    wob = math.sin(t * 2 * math.pi * 2) * 2
    for dy in (-3, 3, 9):
        d.line([s(hx + 34), s(hy + 10 + dy * 0.4), s(hx + 58), s(hy + 6 + dy + wob)], fill=(120, 100, 100), width=s(1))
    d.ellipse(box(cx + 22, cy + 38, 10, 5), fill=PINK)  # feet
    d.ellipse(box(cx - 10, cy + 39, 10, 5), fill=PINK)
    d.ellipse(box(cx + 30, cy + 12, 7, 6), fill=PINK)  # paw
    return hx - 4, hy - 20


def night_sky(img, t):
    d = ImageDraw.Draw(img)
    for y in range(H * S):
        u = y / (H * S)
        c = (int(30 + 40 * u), int(18 + 14 * u), int(56 + 30 * u))
        d.line([0, y, W * S, y], fill=c)
    d.ellipse(box(262, 46, 26, 26), fill=(255, 244, 200))  # moon
    bite_u = 40 / H
    d.ellipse(box(274, 40, 24, 24), fill=(int(30 + 40 * bite_u), int(18 + 14 * bite_u), int(56 + 30 * bite_u)))  # crescent bite, sky-coloured
    for i, (sx, sy) in enumerate([(30, 30), (90, 18), (150, 40), (205, 22), (120, 70), (40, 90)]):
        tw = 1.2 + 0.8 * math.sin(t * 2 * math.pi + i)
        d.ellipse(box(sx, sy, tw, tw), fill=(255, 255, 230))
    d.rectangle([0, s(205), W * S, H * S], fill=(26, 20, 34))  # ground
    return d


def bat(d, x, y, t, size=1.0):
    flap = math.sin(t * 2 * math.pi * 3) * 8 * size
    body = [(x, y), (x - 14 * size, y - flap), (x - 7 * size, y + 2), (x, y + 4 * size), (x + 7 * size, y + 2), (x + 14 * size, y - flap)]
    d.polygon([(s(a), s(b)) for a, b in body], fill=(18, 12, 22))


def pumpkin(img, x, y, t):
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    flicker = 0.75 + 0.25 * math.sin(t * 2 * math.pi * 3) * math.sin(t * 2 * math.pi * 5 + 1)
    gd.ellipse(box(x, y, 60, 46), fill=(255, 150, 40, int(90 * flicker)))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(s(14))))
    d = ImageDraw.Draw(img)
    for dx in (-18, 18, 0):
        d.ellipse(box(x + dx, y, 22, 26), fill=(240, 120, 30), outline=(190, 80, 20), width=s(2))
    d.rectangle(box(x, y - 28, 4, 7), fill=(80, 110, 40))
    lit = (255, int(210 + 40 * flicker), int(90 * flicker))
    d.polygon([(s(x - 16), s(y - 6)), (s(x - 6), s(y - 6)), (s(x - 11), s(y - 15))], fill=lit)
    d.polygon([(s(x + 6), s(y - 6)), (s(x + 16), s(y - 6)), (s(x + 11), s(y - 15))], fill=lit)
    d.polygon([(s(x - 20), s(y + 4)), (s(x + 20), s(y + 4)), (s(x + 12), s(y + 14)), (s(x + 4), s(y + 9)), (s(x - 4), s(y + 14)), (s(x - 12), s(y + 9))], fill=lit)


def witch_hat(d, x, y, t):
    tilt = math.sin(t * 2 * math.pi) * 3
    d.ellipse(box(x, y, 34, 7), fill=(60, 30, 90))
    d.polygon([(s(x - 20), s(y - 2)), (s(x + 20), s(y - 2)), (s(x + 6 + tilt), s(y - 44)), (s(x - 8 + tilt * 1.6), s(y - 56))], fill=(80, 40, 120))
    d.polygon([(s(x - 19), s(y - 4)), (s(x + 19), s(y - 4)), (s(x + 16), s(y - 12)), (s(x - 16), s(y - 12))], fill=(255, 140, 30))
    d.rectangle(box(x, y - 8, 4, 4), fill=(255, 220, 90))


def party_hat(d, x, y, t):
    d.polygon([(s(x - 18), s(y)), (s(x + 18), s(y)), (s(x), s(y - 46))], fill=(90, 200, 255))
    for i in range(3):
        yy = y - 10 - i * 12
        half = 18 * (1 - (y - yy) / 46)
        d.line([s(x - half), s(yy), s(x + half), s(yy)], fill=(255, 90, 160), width=s(4))
    bob = math.sin(t * 2 * math.pi * 2) * 2
    d.ellipse(box(x, y - 48 + bob, 6, 6), fill=(255, 230, 80))


def cake(d, x, y, t):
    d.rectangle([s(x - 34), s(y - 20), s(x + 34), s(y + 20)], fill=(250, 220, 235))
    d.rectangle([s(x - 34), s(y - 20), s(x + 34), s(y - 10)], fill=(255, 150, 190))
    for i in range(5):
        d.ellipse(box(x - 28 + i * 14, y - 10, 5, 5), fill=(255, 150, 190))
    d.rectangle([s(x - 3), s(y - 40), s(x + 3), s(y - 20)], fill=(120, 200, 255))
    fl = 1 + 0.25 * math.sin(t * 2 * math.pi * 4)
    d.ellipse(box(x, y - 46, 4 * fl, 7 * fl), fill=(255, 200, 60))
    d.ellipse(box(x, y - 45, 2, 3.5), fill=(255, 250, 200))


def confetti(d, t):
    colors = [(255, 90, 160), (90, 200, 255), (255, 230, 80), (140, 230, 120)]
    for i in range(26):
        x = (i * 53) % W
        y = ((i * 37) + t * H * 1.0) % H
        d.rectangle(box(x, y, 2.5, 4), fill=colors[i % 4])


def ghost(d, cx, cy, t):
    """Peaches under a bedsheet: her ears poke through, tail peeks out the bottom."""
    tail(d, cx - 24, cy + 40, t, color=(244, 156, 170, 200))
    pts = []
    for i in range(40):
        a = math.pi + math.pi * i / 39
        pts.append((cx + 52 * math.cos(a), cy - 10 + 56 * math.sin(a)))
    for i in range(9):
        x = cx + 52 - i * 13
        y = cy + 46 + (6 if i % 2 else -2) + math.sin(t * 2 * math.pi + i) * 3
        pts.append((x, y))
    d.ellipse(box(cx - 22, cy - 62, 14, 14), fill=FUR)
    d.ellipse(box(cx + 22, cy - 62, 14, 14), fill=FUR)
    d.ellipse(box(cx - 22, cy - 62, 8, 8), fill=PINK)
    d.ellipse(box(cx + 22, cy - 62, 8, 8), fill=PINK)
    d.polygon([(s(x), s(y)) for x, y in pts], fill=(245, 245, 255, 235))
    d.ellipse(box(cx - 14, cy - 18, 7, 10), fill=INK)
    d.ellipse(box(cx + 14, cy - 18, 7, 10), fill=INK)
    d.ellipse(box(cx, cy + 2, 8, 6), fill=INK)


def render(name, draw_frame):
    frames = []
    for i in range(FRAMES):
        t = i / FRAMES
        img = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 255))
        draw_frame(img, t)
        frames.append(img.resize((W, H), Image.LANCZOS).convert('RGB').convert('P', palette=Image.ADAPTIVE, colors=255))
    path = os.path.join(OUT, f'{name}.gif')
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=90, loop=0, optimize=True, disposal=2)
    frames[0].convert('RGB').save(os.path.join(OUT, f'_{name}_preview.png'))
    print(path, os.path.getsize(path))


def halloween(img, t):
    d = night_sky(img, t)
    bat(d, 60 + 30 * math.sin(t * 2 * math.pi), 50 + 8 * math.cos(t * 4 * math.pi), t, 1.8)
    bat(d, 200 - 20 * math.sin(t * 2 * math.pi), 74, t + 0.3, 1.3)
    pumpkin(img, 246, 182, t)
    d = ImageDraw.Draw(img)
    bounce = abs(math.sin(t * 2 * math.pi)) * -6
    hat_x, hat_y = rat(d, 112, 150 + bounce, t)
    witch_hat(d, hat_x + 2, hat_y + 2, t)


def ghost_frame(img, t):
    d = night_sky(img, t)
    bat(d, 250, 100 + 6 * math.sin(t * 2 * math.pi), t, 1.5)
    float_y = math.sin(t * 2 * math.pi) * 8
    ghost(ImageDraw.Draw(img, 'RGBA'), 150, 130 + float_y, t)


def birthday(img, t):
    d = ImageDraw.Draw(img)
    for y in range(H * S):
        u = y / (H * S)
        d.line([0, y, W * S, y], fill=(int(150 + 30 * u), int(200 - 10 * u), int(255 - 20 * u)))
    d.rectangle([0, s(205), W * S, H * S], fill=(120, 170, 120))
    confetti(d, t)
    cake(d, 238, 186, t)
    bounce = abs(math.sin(t * 2 * math.pi)) * -6
    hx, hy = rat(d, 108, 150 + bounce, t)
    party_hat(d, hx + 2, hy + 4, t)


def winter_sky(img, t):
    d = ImageDraw.Draw(img)
    for y in range(H * S):
        u = y / (H * S)
        d.line([0, y, W * S, y], fill=(int(24 + 30 * u), int(40 + 40 * u), int(86 + 40 * u)))
    d.rectangle([0, s(200), W * S, H * S], fill=(236, 244, 255))  # snow ground
    d.ellipse(box(60, 206, 90, 14), fill=(250, 252, 255))
    d.ellipse(box(250, 208, 110, 12), fill=(250, 252, 255))
    return d


def snowfall(d, t, count=34):
    for i in range(count):
        x = (i * 47 + 13 * math.sin(t * 2 * math.pi + i)) % W
        y = ((i * 29) + t * H) % H
        r = 1.6 + (i % 3) * 0.8
        d.ellipse(box(x, y, r, r), fill=(255, 255, 255))


def santa_hat(d, x, y, t):
    flop = math.sin(t * 2 * math.pi) * 4
    d.polygon([(s(x - 20), s(y)), (s(x + 18), s(y)), (s(x + 30 + flop), s(y - 26)), (s(x + 2), s(y - 40))], fill=(214, 40, 48))
    d.ellipse(box(x + 32 + flop, y - 26, 7, 7), fill=(255, 255, 255))
    d.rounded_rectangle([s(x - 24), s(y - 6), s(x + 22), s(y + 6)], radius=s(6), fill=(255, 255, 255))


def present(d, x, y, w, h, color, ribbon):
    d.rectangle([s(x - w), s(y - h), s(x + w), s(y + h)], fill=color)
    d.rectangle([s(x - 3), s(y - h), s(x + 3), s(y + h)], fill=ribbon)
    d.rectangle([s(x - w), s(y - 3), s(x + w), s(y + 3)], fill=ribbon)
    d.ellipse(box(x - 7, y - h - 5, 7, 5), fill=ribbon)
    d.ellipse(box(x + 7, y - h - 5, 7, 5), fill=ribbon)


def earmuffs_scarf(d, hx, hy, cx, cy, t):
    d.arc([s(hx - 34), s(hy - 34), s(hx + 18), s(hy + 6)], 200, 340, fill=(90, 90, 110), width=s(4))
    d.ellipse(box(hx - 8, hy - 26, 12, 12), fill=(120, 200, 255))  # earmuff over front ear
    sway = math.sin(t * 2 * math.pi) * 4
    d.rounded_rectangle([s(cx + 8), s(cy - 22), s(cx + 52), s(cy - 10)], radius=s(5), fill=(46, 160, 90))
    d.polygon([(s(cx + 14), s(cy - 14)), (s(cx + 26), s(cy - 14)), (s(cx + 22 + sway), s(cy + 22)), (s(cx + 10 + sway), s(cy + 20))], fill=(46, 160, 90))
    for k in range(3):
        d.line([s(cx + 12 + sway * 0.5), s(cy + 2 + k * 6), s(cx + 24 + sway * 0.5), s(cy + 2 + k * 6)], fill=(230, 60, 60), width=s(2))


def snowman(d, x, y, t):
    d.ellipse(box(x, y, 24, 22), fill=(250, 252, 255), outline=(200, 214, 235), width=s(2))
    d.ellipse(box(x, y - 32, 17, 16), fill=(250, 252, 255), outline=(200, 214, 235), width=s(2))
    d.ellipse(box(x - 6, y - 35, 2.2, 2.2), fill=INK)
    d.ellipse(box(x + 6, y - 35, 2.2, 2.2), fill=INK)
    d.polygon([(s(x), s(y - 30)), (s(x + 14), s(y - 28)), (s(x), s(y - 26))], fill=(255, 140, 30))
    d.rectangle([s(x - 13), s(y - 50), s(x + 13), s(y - 46)], fill=INK)
    d.rectangle([s(x - 9), s(y - 66), s(x + 9), s(y - 48)], fill=INK)


def winter(img, t):
    d = winter_sky(img, t)
    present(d, 236, 186, 20, 16, (60, 140, 220), (255, 220, 80))
    present(d, 276, 192, 14, 11, (220, 60, 80), (250, 250, 250))
    present(d, 256, 160, 12, 10, (80, 180, 110), (230, 60, 60))
    bounce = abs(math.sin(t * 2 * math.pi)) * -6
    hx, hy = rat(d, 108, 152 + bounce, t)
    santa_hat(d, hx + 2, hy + 4, t)
    snowfall(d, t)


def frosty(img, t):
    d = winter_sky(img, t)
    snowman(d, 252, 182, t)
    bounce = abs(math.sin(t * 2 * math.pi)) * -4
    cx, cy = 110, 152 + bounce
    hx, hy = rat(d, cx, cy, t)
    earmuffs_scarf(d, hx + 4, hy + 20, cx, cy, t)
    snowfall(d, t, 44)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    render('halloween', halloween)
    render('ghost', ghost_frame)
    render('birthday', birthday)
    render('winter', winter)
    render('frosty', frosty)
