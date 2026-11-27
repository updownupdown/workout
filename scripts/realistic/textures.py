"""Convert Rocketbox 2048px TGA maps to 1024px WebP for the web.

Usage: python3 textures.py <Textures dir> <prefix e.g. f013> <out name e.g. female> <out dir>
The 3ds Max specular map is turned into a roughness map (glossy where specular is high).
"""
import os, sys
from PIL import Image

src, code, name, out = sys.argv[1:5]
S = 1024
for part in ['body', 'head']:
    p = lambda kind: os.path.join(src, f'{code}_{part}_{kind}.tga')
    Image.open(p('color')).convert('RGB').resize((S, S), Image.LANCZOS).save(f'{out}/{name}_{part}_color.webp', quality=82)
    Image.open(p('normal')).convert('RGB').resize((S, S), Image.LANCZOS).save(f'{out}/{name}_{part}_normal.webp', quality=88)
    sp = Image.open(p('specular')).convert('L').resize((S, S), Image.LANCZOS)
    sp.point(lambda v: int(255 * max(0.32, min(1.0, 0.95 - (v / 255) * 1.1)))).save(f'{out}/{name}_{part}_rough.webp', quality=80)
hair = os.path.join(src, f'{code}_opacity_color.tga')
if os.path.exists(hair):
    Image.open(hair).resize((512, 512), Image.LANCZOS).save(f'{out}/{name}_hair.webp', quality=85)
