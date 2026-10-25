#!/usr/bin/env python3
"""Generates the 027Apps brand assets (identity D, logo L4 "latido").

Converts text to glyph paths so the SVGs have no font dependency (usable as
favicon, adaptive icon and anywhere else). Deterministic: same inputs, same
output. Reference docs: docs/brand/identities/d.md, docs/brand/brand.md.

Requirements: python3 with fonttools and uharfbuzz (external venv).
Fonts: variable TTFs from github.com/google/fonts (OFL): Inter[opsz,wght].ttf
and JetBrainsMono[wght].ttf. Paths passed as arguments.

Outputs (docs/brand/assets/ by default):
  wordmark-{light,dark,mono}.svg (+ bare variants without tagline)
  icon-dark.svg / icon-light.svg / mark.svg
  ic_launcher_foreground.xml (Android adaptive icon, 108 viewport)
"""

import argparse
import io
import os

import uharfbuzz as hb
from fontTools import ttLib
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.varLib.instancer import instantiateVariableFont

# Identity D palette (docs/brand/identities/d.md). Only brand assets may hold
# raw values; product code consumes semantic tokens.
TEAL = "#1CC29F"
TEAL_INK = "#09795F"  # accent teal on light surfaces (identity D, AA as text)
FG_LIGHT = "#17191C"
FG_DARK = "#F7F8F8"
MUTED_LIGHT = "#5B6472"
MUTED_DARK = "#8A8F98"
SURFACE_DARK = "#0E0F11"

PULSE = "2,14 9,14 11.5,10 14,14 17,14 18.5,16.5 20.5,1.5 22.5,23 25,14 27,10.5 29.5,14 46,14"
PULSE_STROKE = 3.0
TAGLINE = "YOUR APPS. YOUR GROUP."


def instance_font(path, axes):
    font = ttLib.TTFont(path)
    instantiateVariableFont(font, axes, inplace=True)
    return font


class Shaper:
    """Shapes a string with HarfBuzz and emits SVG path data (Y-down)."""

    def __init__(self, ttfont):
        buf = io.BytesIO()
        ttfont.save(buf)
        face = hb.Face(buf.getvalue())
        self.hbfont = hb.Font(face)
        self.upem = face.upem
        self.glyphset = ttfont.getGlyphSet()
        self.order = ttfont.getGlyphOrder()

    def shape(self, text, tracking_em=0.0):
        """Returns [(glyph_name, x_units, y_units)] and total advance (units)."""
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hbfont, buf)
        tracking = tracking_em * self.upem
        placed = []
        x = 0
        for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
            if i > 0:
                x += tracking
            placed.append((self.order[info.codepoint], x + pos.x_offset, pos.y_offset))
            x += pos.x_advance
        return placed, x

    def glyph_path(self, gname, scale, dx=0.0, dy=0.0):
        """SVG path for one glyph, baseline at y=dy, left edge at x=dx (Y-down)."""
        spen = SVGPathPen(self.glyphset)
        tpen = TransformPen(spen, (scale, 0, 0, -scale, dx, dy))
        self.glyphset[gname].draw(tpen)
        return spen.getCommands()

    def run(self, text, font_size, tracking_em, baseline_y):
        """Shapes text at baseline_y. Returns (paths, advance, y_top, y_bottom)."""
        placed, advance = self.shape(text, tracking_em)
        scale = font_size / self.upem
        paths = []
        for gname, gx, gy in placed:
            d = self.glyph_path(gname, scale, gx * scale, baseline_y - gy * scale)
            if d:
                paths.append(d)
        bounds = self.bounds(placed, scale, baseline_y)
        return paths, advance * scale, bounds[1], bounds[3]

    def bounds(self, placed, scale, baseline_y):
        """Tight bounds (SVG coords, Y-down) for placed glyphs at baseline_y."""
        xmin = ymin = 1e9
        xmax = ymax = -1e9
        for gname, gx, gy in placed:
            bp = BoundsPen(self.glyphset)
            self.glyphset[gname].draw(bp)
            if bp.bounds is None:
                continue
            x0, y0, x1, y1 = bp.bounds
            xmin = min(xmin, gx * scale + x0 * scale)
            xmax = max(xmax, gx * scale + x1 * scale)
            ymin = min(ymin, baseline_y - gy * scale - y1 * scale)
            ymax = max(ymax, baseline_y - gy * scale - y0 * scale)
        return xmin, ymin, xmax, ymax


def merge(paths):
    return "".join(f'<path d="{d}"/>' for d in paths)


def wordmark_svg(shaper_i, shaper_m, variant, bare):
    """Wordmark SVG. variant: 'light' | 'dark' | 'mono' (mono = currentColor)."""
    if variant == "mono":
        fg = brand = muted = "currentColor"
    else:
        dark = variant == "dark"
        fg = FG_DARK if dark else FG_LIGHT
        brand = TEAL if dark else TEAL_INK
        muted = MUTED_DARK if dark else MUTED_LIGHT
    size = 100.0
    pad = 2.0
    head, head_w, head_top, _ = shaper_i.run("027", size, -0.04, 0)
    cap_h = -head_top
    tail, tail_w, _, _ = shaper_i.run("Apps", size, -0.04, 0)
    base_y = pad + cap_h
    head, head_w, _, _ = shaper_i.run("027", size, -0.04, base_y)
    tail, tail_w, _, _ = shaper_i.run("Apps", size, -0.04, base_y)
    parts = [f'<g fill="{fg}">{merge(head)}</g>', f'<g fill="{brand}">{merge(tail)}</g>']
    width = head_w + tail_w + pad * 2
    if bare:
        height = cap_h + pad * 2
    else:
        tag_size = 23.0
        _, _, tag_top, tag_bottom = shaper_m.run(TAGLINE, tag_size, 0.3, 0)
        tag_cap = -tag_top
        tag_base = base_y + 16.0 + tag_cap
        tag, tag_w, _, tag_bottom = shaper_m.run(TAGLINE, tag_size, 0.3, tag_base)
        parts.append(f'<g fill="{muted}">{merge(tag)}</g>')
        height = tag_bottom + pad
    inner = "".join(parts)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.1f} {height:.1f}" '
        f'width="{width:.0f}" height="{height:.0f}">{inner}</svg>'
    )


def icon_text(shaper_m, text, size, tracking_em, baseline_y):
    """Shapes text centered on the 48-unit icon box. Returns (paths, width)."""
    placed, advance = shaper_m.shape(text, tracking_em)
    scale = size / shaper_m.upem
    width = advance * scale
    dx = (48 - width) / 2 - shaper_m.bounds(placed, scale, baseline_y)[0]
    paths = []
    for gname, gx, gy in placed:
        d = shaper_m.glyph_path(gname, scale, dx + gx * scale, baseline_y - gy * scale)
        if d:
            paths.append(d)
    return paths, width


def icon_svg(shaper_m, dark):
    surface = SURFACE_DARK if dark else "#FFFFFF"
    pulse = TEAL if dark else TEAL_INK
    ink = ("#FFFFFF", ".75") if dark else ("#0C3C32", ".8")
    num_paths, _ = icon_text(shaper_m, "027", 7.0, 0.28, 42.0)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">'
        f'<rect width="48" height="48" rx="11" fill="{surface}"/>'
        f'<polyline points="{PULSE}" fill="none" stroke="{pulse}" stroke-width="{PULSE_STROKE}" '
        'stroke-linecap="round" stroke-linejoin="round"/>'
        f'<g fill="{ink[0]}" fill-opacity="{ink[1]}">{merge(num_paths)}</g></svg>'
    )


def mark_svg():
    """Pulse only (favicon / small sizes), currentColor stroke."""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 26" width="48" height="26">'
        f'<polyline points="{PULSE}" fill="none" stroke="currentColor" stroke-width="3.4" '
        'stroke-linecap="round" stroke-linejoin="round" transform="translate(0,-1)"/></svg>'
    )


def android_foreground(shaper_m):
    """Adaptive icon foreground: 108 viewport, content inside the 66dp safe zone."""
    # The 48-unit icon design maps into the 66dp safe zone: scale 66/48, offset 21.
    s = 66.0 / 48.0
    off = 21.0
    stroke = PULSE_STROKE * s
    points = " ".join(
        f"{float(p.split(',')[0]) * s + off:.2f},{float(p.split(',')[1]) * s + off:.2f}"
        for p in PULSE.split(" ")
    )
    num_paths, _ = icon_text(shaper_m, "027", 7.0, 0.28, 42.0)
    glyphs = "".join(
        f'    <path android:fillColor="#BFFFFFFF" android:pathData="{d}"/>\n' for d in num_paths
    )
    return (
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        '    android:width="108dp" android:height="108dp"\n'
        '    android:viewportWidth="108" android:viewportHeight="108">\n'
        f'  <path android:pathData="M{points}" android:fillColor="#00000000"\n'
        f'      android:strokeColor="#FF1CC29F" android:strokeWidth="{stroke:.2f}"\n'
        '      android:strokeLineCap="round" android:strokeLineJoin="round"/>\n'
        f'{glyphs}'
        '</vector>\n'
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inter", required=True)
    ap.add_argument("--jbmono", required=True)
    ap.add_argument("--out", default="docs/brand/assets")
    args = ap.parse_args()

    inter = instance_font(args.inter, {"opsz": 32, "wght": 800})
    jbmono = instance_font(args.jbmono, {"wght": 600})
    si, sm = Shaper(inter), Shaper(jbmono)

    os.makedirs(args.out, exist_ok=True)
    outputs = {
        "wordmark-light.svg": wordmark_svg(si, sm, "light", bare=False),
        "wordmark-dark.svg": wordmark_svg(si, sm, "dark", bare=False),
        "wordmark-mono.svg": wordmark_svg(si, sm, "mono", bare=False),
        "wordmark-bare-light.svg": wordmark_svg(si, sm, "light", bare=True),
        "wordmark-bare-dark.svg": wordmark_svg(si, sm, "dark", bare=True),
        "icon-dark.svg": icon_svg(sm, dark=True),
        "icon-light.svg": icon_svg(sm, dark=False),
        "mark.svg": mark_svg(),
        "ic_launcher_foreground.xml": android_foreground(sm),
    }
    for name, content in outputs.items():
        path = os.path.join(args.out, name)
        with open(path, "w") as fh:
            fh.write(content)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
