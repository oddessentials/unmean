"""Draws the unmean logo and og-image into assets/.

Needs Python with fontTools, the Inter 4.1 TTFs (https://github.com/rsms/inter/releases/tag/v4.1),
and Inkscape for the PNG. Set INTER_DIR to the folder holding Inter-Bold.ttf and friends, and
INKSCAPE if inkscape is not on PATH.

    INTER_DIR=path/to/Inter/extras/ttf python assets/src/build.py
"""
import os
import subprocess
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ASSETS = Path(__file__).resolve().parent.parent
INKSCAPE = os.environ.get('INKSCAPE', 'inkscape')
INTER_DIR = Path(os.environ.get('INTER_DIR', ASSETS / 'src' / 'fonts'))

INK = '#1E2330'
INK_DARK = '#E6EAF0'
CORAL = '#D2765B'
PAPER = '#FBF7F1'
MUTED = '#5B6272'
SW = 22

TAGLINE = ('A Claude Code chaperone to filter out',
           'unconstructive and demeaning prompts',
           'without interrupting your workflow.')
INSTALL = '/plugin install unmean --marketplace oddessentials/unmean'


def heart_d(cx, cy, s):
    p = lambda x, y: f'{cx + x * s:.1f},{cy + y * s:.1f}'
    return (f'M{p(0, .38)} C{p(-.12, .28)} {p(-.52, .02)} {p(-.52, -.24)} '
            f'C{p(-.52, -.5)} {p(-.16, -.58)} {p(0, -.3)} '
            f'C{p(.16, -.58)} {p(.53, -.5)} {p(.5, -.23)} '
            f'C{p(.48, .03)} {p(.11, .27)} {p(0, .38)} Z')


def crayon_heart(cx, cy, s, coral, dark='#B85A40'):
    rot = f'rotate(-10 {cx} {cy})'
    heart = heart_d(cx, cy, s)
    # diagonal crayon strokes, clipped to a slightly larger heart so a few run past the edge
    rows, y, flip = [], cy - .7 * s, 0
    while y < cy + .55 * s:
        x0, x1 = cx - .7 * s, cx + .7 * s
        a, b = (x0, x1) if flip else (x1, x0)
        rows.append(f'L{a:.1f},{y:.1f} L{b:.1f},{y + 4:.1f}')
        y += 8
        flip ^= 1
    scribble = f'M{cx + .7 * s:.1f},{cy - .74 * s:.1f} ' + ' '.join(rows)
    return (
        '<defs>'
        f'<clipPath id="hc"><path d="{heart_d(cx, cy, s * 1.03)}" transform="{rot}"/></clipPath>'
        '<filter id="crayon" x="-20%" y="-20%" width="140%" height="140%">'
        '<feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="7" result="wob"/>'
        '<feDisplacementMap in="SourceGraphic" in2="wob" scale="2.5" result="rough"/>'
        '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" result="grain"/>'
        '<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.45" result="mask"/>'
        '<feComposite in="rough" in2="mask" operator="in"/>'
        '</filter></defs>'
        '<g filter="url(#crayon)">'
        f'<path d="{heart}" fill="{coral}" transform="{rot}"/>'
        f'<g clip-path="url(#hc)" opacity=".55"><g transform="rotate(-32 {cx} {cy})">'
        f'<path d="{scribble}" fill="none" stroke="{dark}" stroke-width="3" stroke-linejoin="round"/></g></g>'
        f'<path d="{heart}" fill="none" stroke="{dark}" stroke-width="7" stroke-linejoin="round" transform="{rot}"/>'
        '</g>'
    )


def figure(ink=INK, coral=CORAL):
    pen = f'fill="none" stroke="{ink}" stroke-linecap="round" stroke-linejoin="round"'
    line = f'{pen} stroke-width="{SW}"'
    return (
        # head and closed eyes
        f'<circle cx="256" cy="112" r="56" {line}/>'
        f'<path d="M224,118 q11,10 22,0 M266,118 q11,10 22,0" {pen} stroke-width="10"/>'
        # shoulders and arms, resting on the knees
        f'<path d="M256,196 C204,196 178,232 170,282 C162,330 140,352 104,360" {line}/>'
        f'<path d="M256,196 C308,196 334,232 342,282 C350,330 372,352 408,360" {line}/>'
        # crossed legs
        f'<path d="M92,384 C132,462 300,456 372,382" {line}/>'
        f'<path d="M420,384 C380,462 212,456 140,382" {line}/>'
        # the heart, floating above the left hand
        + crayon_heart(98, 276, 94, coral)
    )


def logo(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 24 488 464">{body}</svg>'


def text_path(text, x, y, size, weight, fill, tracking=0):
    font = TTFont(INTER_DIR / f'Inter-{weight}.ttf')
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font['head'].unitsPerEm
    pen = SVGPathPen(glyphs)
    cx = x
    for ch in text:
        name = cmap[ord(ch)]
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cx, y)))
        cx += glyphs[name].width * scale + tracking
    return f'<path d="{pen.getCommands()}" fill="{fill}"/>', cx - tracking - x


def og_image(w=1280, h=640):
    scale = 400 / 488
    parts = [f'<rect width="{w}" height="{h}" fill="{PAPER}"/>',
             f'<g transform="translate(84,{(h - 464 * scale) / 2:.1f}) scale({scale:.4f}) translate(-8,-24)">{figure()}</g>']
    x = 560
    parts.append(text_path('unmean', x, 268, 128, 'Bold', INK, tracking=-3)[0])
    for i, line in enumerate(TAGLINE):
        parts.append(text_path(line, x + 4, 336 + i * 44, 32, 'Regular', MUTED)[0])
    cmd, width = text_path(INSTALL, 0, 0, 20, 'Medium', INK)
    parts.append(f'<rect x="{x}" y="490" width="{width + 40:.0f}" height="52" rx="12" fill="#FFFFFF" stroke="#E6DFD4" stroke-width="2"/>')
    parts.append(f'<g transform="translate({x + 20},523)">{cmd}</g>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{"".join(parts)}</svg>'


if __name__ == '__main__':
    (ASSETS / 'logo.svg').write_text(logo(figure()), newline='\n')
    (ASSETS / 'logo-dark.svg').write_text(logo(figure(INK_DARK)), newline='\n')
    og = ASSETS / 'src' / 'og-image.svg'
    og.write_text(og_image(), newline='\n')
    subprocess.run([INKSCAPE, str(og), '--export-type=png', '--export-width=1280',
                    f'--export-filename={ASSETS / "og-image.png"}'], check=True, capture_output=True)
