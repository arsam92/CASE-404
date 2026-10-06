#!/usr/bin/env python3
"""Generates CASE 404 launcher/app icons and splash with PIL — 100% original assets.
Run from project root: python3 scripts/gen_icon.py"""
from PIL import Image, ImageDraw, ImageFont
import os, glob

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'icons')
os.makedirs(OUT, exist_ok=True)

BG = (10, 14, 23, 255)        # #0a0e17
RED = (255, 59, 78)           # #ff3b4e
DIM = (143, 160, 189)
PANEL = (17, 26, 44)

def font(size):
    for p in [
        '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def draw_icon(size, scale=1.0, bg=BG):
    img = Image.new('RGBA', (size, size), bg)
    d = ImageDraw.Draw(img)
    s = size * scale
    off = (size - s) / 2
    # subtle frame
    m = s * 0.10
    d.rounded_rectangle([off + m, off + m, off + s - m, off + s - m],
                        radius=s * 0.09, outline=(30, 42, 68, 255), width=max(1, int(s * 0.015)))
    # CASE text
    f_case = font(int(s * 0.11))
    tb = d.textbbox((0, 0), 'CASE', font=f_case)
    w, h = tb[2] - tb[0], tb[3] - tb[1]
    d.text((off + (s - w) / 2 - tb[0], off + s * 0.235), 'CASE', font=f_case, fill=DIM)
    # 404 text
    f_num = font(int(s * 0.36))
    tb = d.textbbox((0, 0), '404', font=f_num)
    w, h = tb[2] - tb[0], tb[3] - tb[1]
    d.text((off + (s - w) / 2 - tb[0], off + s * 0.40), '404', font=f_num, fill=RED)
    # underline bar
    d.rounded_rectangle([off + s * 0.30, off + s * 0.80, off + s * 0.70, off + s * 0.815],
                        radius=s * 0.008, fill=(232, 176, 75, 255))
    return img

def rounded(img, radius_ratio):
    size = img.size[0]
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size, size], radius=int(size * radius_ratio), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out

# web / store icons
for size in (96, 192, 512):
    draw_icon(size).save(os.path.join(OUT, f'icon-{size}.png'))
# favicon-size square
draw_icon(48).save(os.path.join(OUT, 'icon-48.png'))

# android mipmaps (launched via cap add later — write to a staging dir too)
ANDROID_RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
if os.path.isdir(ANDROID_RES):
    mips = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    for name, size in mips.items():
        d = os.path.join(ANDROID_RES, f'mipmap-{name}')
        os.makedirs(d, exist_ok=True)
        draw_icon(size).save(os.path.join(d, 'ic_launcher.png'))
        rounded(draw_icon(size), 0.5).save(os.path.join(d, 'ic_launcher_round.png'))
        # adaptive icon foreground: content in middle ~66%
        draw_icon(size, scale=0.62, bg=(0, 0, 0, 0)).save(os.path.join(d, 'ic_launcher_foreground.png'))
    print('android icons written')
else:
    print('android res not found — run again after `npx cap add android`')

# splash (dark, centered mark)
SW = SH = 1920
sp = Image.new('RGBA', (SW, SH), BG)
mark = draw_icon(560)
sp.paste(mark, ((SW - 560) // 2, (SH - 560) // 2 - 100), mark)
f_sub = font(34)
d = ImageDraw.Draw(sp)
tb = d.textbbox((0, 0), '23 CASES. ONE TRUTH.', font=f_sub)
d.text(((SW - (tb[2] - tb[0])) / 2, (SH + 560) // 2 - 60), '23 CASES. ONE TRUTH.', font=f_sub, fill=DIM)
os.makedirs(os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable'), exist_ok=True)
if os.path.isdir(os.path.join(ROOT, 'android')):
    sp.convert('RGB').save(os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'drawable', 'splash.png'))
    print('splash written')
print('done')
