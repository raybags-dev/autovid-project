"""
AutoVid Pipeline — Quote Video Generator

Renders an animated quote card as MP4, replicating the HTML animation:
  Phase 1  0.5s   — blank canvas, border/corners fade in
  Phase 2  0.4s   — open-quote mark appears
  Phase 3  0.6s   — idle cursor blinks
  Phase 4  varies — typing (character by character, punctuation pauses)
  Phase 5  0.35s  — close-quote mark appears
  Phase 6  2.8s   — shake simulation (text vibrates)
  Phase 7  0.5s   — author line fades in
  Phase 8  hold   — all elements held on screen (hold_duration_s)
  Phase 9  1.5s   — fade-to-black outro

Layout mirrors the HTML #stage flex-column centered layout:
  open-quote (left-aligned)
  quote-text (centered, italic serif)
  close-quote (right-aligned)
  author line (right-aligned, 24px below close-quote)

CSS reference values kept exactly:
  Border:  2px, full-width / full-height lines
  Corners: 18×18 px L-marks, 10px from each edge
  Red:     #e63329
  BG:      #080808
"""

import math
import os
import random
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Callable, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))
import config

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_OK = True
except ImportError:
    PIL_OK = False

# ── Exact colours from the HTML ───────────────────────────────────────────────
BG_COLOR    = (8,   8,   8)        # --bg: #080808
RED         = (230, 51,  41)       # --red-primary: #e63329
RED_LINE    = (230, 51,  41, 153)  # --red-line: rgba(230,51,41,0.6)  (not used for PIL fills)
RED_AUTHOR  = (173, 38,  31)       # rgba(230,51,41,0.75) approximated

# ── Aspect ratios ─────────────────────────────────────────────────────────────
RATIOS = {
    "16:9": (1920, 1080),
    "9:16": (1080, 1920),
    "1:1":  (1080, 1080),
}

# ── Font paths (server: DejaVu always present; better fonts downloaded once) ──
_ASSETS = Path(__file__).parent.parent / "assets" / "fonts"
_DEJAVU_SERIF      = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
_DEJAVU_SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
_DEJAVU_SANS       = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

_FONT_URLS = {
    "playfair_italic": (
        "https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/static/PlayfairDisplay-Italic.ttf",
        "PlayfairDisplay-Italic.ttf",
    ),
    "playfair_bold": (
        "https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/static/PlayfairDisplay-Bold.ttf",
        "PlayfairDisplay-Bold.ttf",
    ),
    "cormorant_semibold": (
        "https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond-SemiBold.ttf",
        "CormorantGaramond-SemiBold.ttf",
    ),
}


def _fetch_font(key: str) -> Optional[str]:
    """Download and cache a font. Returns local path or None on failure."""
    url, filename = _FONT_URLS[key]
    dest = _ASSETS / filename
    if dest.exists():
        return str(dest)
    try:
        _ASSETS.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(url, str(dest))
        return str(dest)
    except Exception as e:
        print(f"[QUOTE] Could not download {filename}: {e}")
        return None


def _load(path: Optional[str], fallback: str, size: int) -> "ImageFont.FreeTypeFont":
    for p in [path, fallback, _DEJAVU_SANS]:
        if p:
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def _measure(font, text: str):
    """(width, height) of text rendered with font."""
    bb = font.getbbox(text)
    return bb[2] - bb[0], bb[3] - bb[1]


def _wrap(text: str, font, max_px: int) -> list:
    """Word-wrap text to fit max_px wide."""
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if _measure(font, test)[0] <= max_px:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


def _calc_layout(width, height, full_text, font_size, fonts):
    """
    Pre-calculate the centered content block so all frames share the same
    layout regardless of how many chars are currently shown.

    Returns a dict of pixel coordinates.
    """
    pad_x = int(width * 0.10)
    pad_y = int(height * 0.10)
    text_w = width - pad_x * 2

    qm_size   = int(font_size * 2.4)        # CSS: font-size clamp(48px,8vw,120px)
    auth_size = max(12, int(width * 0.014)) # CSS: clamp(10px,1.4vw,15px)
    auth_size = min(auth_size, 18)

    f_text   = fonts["text"]
    f_qmark  = fonts["qmark"]
    f_author = fonts["author"]

    # Measure a representative large character for each font
    _, qm_h    = _measure(f_qmark,  "\u201c")
    _, auth_h  = _measure(f_author, "A")

    all_lines   = _wrap(full_text, f_text, text_w)
    line_h      = int(font_size * 1.45)   # CSS: line-height: 1.45
    text_h      = len(all_lines) * line_h
    author_margin = 24                    # CSS: margin-top: 24px

    # Block: open-qmark + text + close-qmark + author
    # (close-qmark is placed after text block; author below it)
    block_h = qm_h + text_h + qm_h + author_margin + auth_h

    block_top = max(pad_y, (height - block_h) // 2)

    qm_open_y  = block_top
    text_top   = block_top + qm_h
    qm_close_y = text_top + text_h - int(qm_h * 0.15)  # slight overlap like HTML
    author_y   = text_top + text_h + qm_h * 0 + author_margin  # 24px below text bottom

    # Author right-aligns within pad_x margin
    # Measure full "— AUTHOR NAME" width
    dash_w = 28
    gap    = 14
    _, _ah = _measure(f_author, "A")

    return {
        "pad_x":      pad_x,
        "pad_y":      pad_y,
        "text_w":     text_w,
        "all_lines":  all_lines,
        "line_h":     line_h,
        "text_h":     text_h,
        "qm_h":       qm_h,
        "auth_h":     auth_h,
        "qm_open_y":  qm_open_y,
        "text_top":   text_top,
        "qm_close_y": qm_close_y,
        "author_y":   author_y,
        "dash_w":     dash_w,
        "gap":        gap,
        "auth_size":  auth_size,
    }


def _draw_border(draw, width, height):
    """Exact CSS: 2px lines at all 4 edges."""
    draw.rectangle([0, 0, width, 2],           fill=RED)
    draw.rectangle([0, height - 2, width, height], fill=RED)
    draw.rectangle([0, 0, 2, height],           fill=RED)
    draw.rectangle([width - 2, 0, width, height], fill=RED)


def _draw_corners(draw, width, height):
    """
    Exact CSS: .corner is 18×18 px, positioned 10px from each edge.
    Each corner is an L-mark: horizontal bar (18×2) + vertical bar (2×18).
    """
    cs = 18   # corner size px
    o  = 10   # offset from edge
    t  = 2    # bar thickness

    def corner(x, y, flip_x=False, flip_y=False):
        hx0 = x - cs if flip_x else x
        hx1 = x      if flip_x else x + cs
        hy0 = y - t  if flip_y else y
        hy1 = y      if flip_y else y + t
        draw.rectangle([hx0, hy0, hx1, hy1], fill=RED)  # H bar

        vx0 = x - t if flip_x else x
        vx1 = x     if flip_x else x + t
        vy0 = y - cs if flip_y else y
        vy1 = y      if flip_y else y + cs
        draw.rectangle([vx0, vy0, vx1, vy1], fill=RED)  # V bar

    corner(o,           o,            False, False)   # top-left
    corner(width - o,   o,            True,  False)   # top-right
    corner(o,           height - o,   False, True)    # bottom-left
    corner(width - o,   height - o,   True,  True)    # bottom-right


def _render_frame(
    width, height, quote_text, chars_shown, author,
    fonts, layout,
    show_border=True,
    show_qmark_open=True,
    show_qmark_close=False,
    show_cursor=False,
    show_author=False,
    text_color=None,
    dx=0, dy=0,           # shake offset
):
    """Render one frame. dx/dy are shake offsets applied to the text block."""
    if text_color is None:
        text_color = RED

    img  = Image.new("RGB", (width, height), BG_COLOR)
    draw = ImageDraw.Draw(img)

    L  = layout
    f  = fonts

    # ── Border & corners ──────────────────────────────────────────────────────
    if show_border:
        _draw_border(draw, width, height)
        _draw_corners(draw, width, height)

    # ── Open quote mark ───────────────────────────────────────────────────────
    if show_qmark_open:
        draw.text(
            (L["pad_x"] + dx, L["qm_open_y"] + dy),
            "\u201c", font=f["qmark"], fill=text_color,
        )

    # ── Quote text ────────────────────────────────────────────────────────────
    visible = quote_text[:chars_shown]
    lines   = _wrap(visible, f["text"], L["text_w"])

    for i, line in enumerate(lines):
        # Centered within text_w
        lw, _ = _measure(f["text"], line)
        x = L["pad_x"] + (L["text_w"] - lw) // 2 + dx
        y = L["text_top"] + i * L["line_h"] + dy
        draw.text((x, y), line, font=f["text"], fill=text_color)

    # Cursor: thin vertical bar after last char on last line
    if show_cursor and chars_shown < len(quote_text) and lines:
        last_line = lines[-1]
        lw, _   = _measure(f["text"], last_line)
        cx = L["pad_x"] + (L["text_w"] - lw) // 2 + lw + 4 + dx
        cy = L["text_top"] + (len(lines) - 1) * L["line_h"] + dy
        cw = max(2, int(layout["line_h"] * 0.04))
        ch = int(layout["line_h"] * 0.85)
        draw.rectangle([cx, cy, cx + cw, cy + ch], fill=text_color)

    # ── Close quote mark ──────────────────────────────────────────────────────
    if show_qmark_close and chars_shown >= len(quote_text):
        qm_w, _ = _measure(f["qmark"], "\u201d")
        draw.text(
            (width - L["pad_x"] - qm_w + dx, L["qm_close_y"] + dy),
            "\u201d", font=f["qmark"], fill=text_color,
        )

    # ── Author line (right-aligned, below text block) ─────────────────────────
    if show_author and author:
        auth_text = author.upper()
        aw, ah = _measure(f["author"], auth_text)
        total_w = L["dash_w"] + L["gap"] + aw
        ax = width - L["pad_x"] - total_w + dx
        ay = L["author_y"] + dy

        # Dash  ─
        mid = ay + ah // 2
        draw.rectangle([ax, mid - 1, ax + L["dash_w"], mid + 1], fill=RED_AUTHOR)
        # Name
        draw.text((ax + L["dash_w"] + L["gap"], ay), auth_text,
                  font=f["author"], fill=RED_AUTHOR)

    return img


# ── Public entry point ────────────────────────────────────────────────────────

def generate_quote_video(
    quote_text: str,
    author: str,
    video_id: str,
    aspect_ratio: str = "16:9",
    font_size: int = 52,
    typing_speed_ms: int = 42,
    hold_duration_s: float = 5.0,
    output_dir: Optional[Path] = None,
    cb: Optional[Callable] = None,
) -> str:
    """
    Generate animated quote-card MP4 that mirrors the original HTML animation.
    Returns path to the .mp4 file.
    """
    if not PIL_OK:
        raise RuntimeError("Pillow not installed")

    def log(msg):
        print(f"[QUOTE] {msg}")
        if cb:
            cb({"step": "QUOTE", "message": msg})

    width, height = RATIOS.get(aspect_ratio, (1920, 1080))

    # ── Download / load fonts ─────────────────────────────────────────────────
    log("Loading fonts …")
    pf_italic = _fetch_font("playfair_italic")
    pf_bold   = _fetch_font("playfair_bold")
    cg_semi   = _fetch_font("cormorant_semibold")

    qm_size   = int(font_size * 2.4)
    auth_size = min(18, max(12, int(width * 0.014)))

    fonts = {
        "text":   _load(pf_italic, _DEJAVU_SERIF,      font_size),
        "qmark":  _load(pf_bold,   _DEJAVU_SERIF_BOLD,  qm_size),
        "author": _load(cg_semi,   _DEJAVU_SANS,        auth_size),
    }

    # ── Set up dirs ───────────────────────────────────────────────────────────
    if output_dir is None:
        output_dir = config.TEMP_DIR / video_id
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    frames_dir = output_dir / "qframes"
    if frames_dir.exists():
        shutil.rmtree(str(frames_dir))
    frames_dir.mkdir()

    # ── Pre-calculate layout (fixed for all frames) ───────────────────────────
    layout = _calc_layout(width, height, quote_text, font_size, fonts)
    n = len(quote_text)

    log(f"Rendering {width}×{height}, {n} chars, font={font_size}px …")

    frame_paths = []
    frame_durs  = []
    idx = 0

    def push(img, dur):
        nonlocal idx
        p = frames_dir / f"f{idx:05d}.png"
        img.save(p, "PNG")
        frame_paths.append(p)
        frame_durs.append(dur)
        idx += 1

    def F(chars=0, open_q=True, close_q=False, cursor=False,
          author=False, color=None, dx=0, dy=0):
        return _render_frame(
            width, height, quote_text, chars, author if author else "",
            fonts, layout,
            show_border=True,
            show_qmark_open=open_q,
            show_qmark_close=close_q,
            show_cursor=cursor,
            show_author=author,
            text_color=color,
            dx=dx, dy=dy,
        )

    # ── Phase 1: blank canvas with border (0.5 s) ─────────────────────────────
    push(F(0, open_q=False), 0.50)

    # ── Phase 2: open-quote mark appears (0.4 s) ──────────────────────────────
    push(F(0, open_q=True), 0.40)

    # ── Phase 3: idle cursor (0.6 s) ──────────────────────────────────────────
    push(F(0, open_q=True, cursor=True), 0.60)

    # ── Phase 4: typing ───────────────────────────────────────────────────────
    for c in range(1, n + 1):
        ch = quote_text[c - 1]
        push(F(c, cursor=(c < n)), _char_dur(ch, typing_speed_ms))

    # ── Phase 5: close-quote appears (0.35 s) ────────────────────────────────
    push(F(n, close_q=True), 0.35)

    # ── Phase 6: shake simulation (2.8 s, 14 frames × 0.2 s) ─────────────────
    # Amplitude grows over time just like the original nervousJitter escalation
    for i in range(14):
        progress = (i + 1) / 14.0
        amp = int(progress * progress * 5)          # 0 → 5 px
        dx  = random.randint(-amp, amp)
        dy  = random.randint(-amp, amp)
        push(F(n, close_q=True, dx=dx, dy=dy), 0.20)

    # ── Phase 7: author fades in (0.5 s) ─────────────────────────────────────
    push(F(n, close_q=True, author=True), 0.50)

    # ── Phase 8: hold (full hold_duration_s) ──────────────────────────────────
    push(F(n, close_q=True, author=True), hold_duration_s)

    # ── Phase 9: outro fade-to-black (6 steps × 0.25 s = 1.5 s) ─────────────
    steps = 6
    for i in range(1, steps + 1):
        factor = 1.0 - (i / steps)          # 1.0 → 0.0
        faded  = tuple(int(c * factor) for c in RED)
        push(F(n, close_q=True, author=True, color=faded), 0.25)

    log(f"{idx} frames queued. Assembling MP4 …")

    # ── FFmpeg concat manifest ────────────────────────────────────────────────
    manifest = output_dir / "concat.txt"
    with open(manifest, "w") as mf:
        for p, d in zip(frame_paths, frame_durs):
            mf.write(f"file '{p.resolve()}'\n")
            mf.write(f"duration {d:.4f}\n")
        mf.write(f"file '{frame_paths[-1].resolve()}'\n")

    output_path = output_dir / f"{video_id}_quote.mp4"
    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(manifest),
        "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed:\n{result.stderr[-800:]}")

    shutil.rmtree(str(frames_dir), ignore_errors=True)
    manifest.unlink(missing_ok=True)

    mb = os.path.getsize(output_path) / 1024 / 1024
    log(f"Done — {output_path.name} ({mb:.1f} MB)")
    return str(output_path)


def _char_dur(ch: str, speed_ms: int) -> float:
    """Duration a single character frame is shown — mirrors HTML logic."""
    if ch in ".!?":
        return speed_ms * 7 / 1000.0
    if ch in ",;:":
        return speed_ms * 3.5 / 1000.0
    return speed_ms / 1000.0


if __name__ == "__main__":
    out = generate_quote_video(
        quote_text="The only way to do great work is to love what you do.",
        author="Steve Jobs",
        video_id="test_quote",
        aspect_ratio="16:9",
        font_size=52,
        hold_duration_s=5.0,
    )
    print("Generated:", out)
