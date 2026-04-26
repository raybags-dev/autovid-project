"""
AutoVid Pipeline — Quote Video Generator

Renders an animated quote card as MP4.
Dark aesthetic: near-black background, red text, decorative frame.
Uses PIL for frame rendering + FFmpeg concat-demuxer for efficient assembly.
"""

import os
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path
from typing import Optional, Callable

sys.path.insert(0, str(Path(__file__).parent.parent))
import config

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_OK = True
except ImportError:
    PIL_OK = False

# ── Palette ───────────────────────────────────────────────────────────────────
BG_COLOR   = (8, 8, 8)
RED        = (230, 51, 41)
RED_DIM    = (160, 35, 28)
WHITE      = (255, 255, 255)

# ── Aspect ratios ─────────────────────────────────────────────────────────────
RATIOS = {
    "16:9": (1920, 1080),
    "9:16": (1080, 1920),
    "1:1":  (1080, 1080),
}

SERIF_FONT    = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SERIF_BOLD    = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SANS_FONT     = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
MONO_FONT     = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def _font(path: str, size: int) -> "ImageFont.FreeTypeFont":
    """Load a font; fallback to default if path missing."""
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        try:
            return ImageFont.truetype(SANS_FONT, size)
        except Exception:
            return ImageFont.load_default()


def _text_size(font, text: str):
    """Return (width, height) of rendered text."""
    bbox = font.getbbox(text)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def _wrap(text: str, font, max_px: int) -> list[str]:
    """Word-wrap text to fit max_px wide."""
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        tw, _ = _text_size(font, test)
        if tw <= max_px:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


def _render_frame(
    width: int,
    height: int,
    quote_text: str,
    chars_shown: int,
    author: str,
    font_size: int,
    show_border: bool,
    show_qmarks: bool,
    show_author: bool,
    show_cursor: bool,
) -> "Image.Image":
    """Render one frame as a PIL Image (RGB)."""
    img = Image.new("RGB", (width, height), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # ── Load fonts ────────────────────────────────────────────────────────────
    qfont  = _font(SERIF_FONT,  font_size)
    qmfont = _font(SERIF_BOLD,  int(font_size * 2.4))
    afont  = _font(SANS_FONT,   max(14, font_size // 3))

    pad = int(min(width, height) * 0.09)
    text_w = width - pad * 2

    # ── Decorative border ─────────────────────────────────────────────────────
    if show_border:
        lw = max(2, width // 600)
        draw.rectangle([0, 0, width, lw], fill=RED)
        draw.rectangle([0, height - lw, width, height], fill=RED)
        draw.rectangle([0, 0, lw, height], fill=RED)
        draw.rectangle([width - lw, 0, width, height], fill=RED)
        # Corner L-marks
        cs = max(20, width // 55)
        for (cx, cy) in [(lw, lw), (width - cs - lw, lw),
                         (lw, height - cs - lw), (width - cs - lw, height - cs - lw)]:
            draw.rectangle([cx, cy, cx + cs, cy + lw * 2], fill=RED)
            draw.rectangle([cx, cy, cx + lw * 2, cy + cs], fill=RED)

    # ── Open quote mark ───────────────────────────────────────────────────────
    if show_qmarks:
        draw.text((pad, pad - font_size // 2), "\u201c", font=qmfont, fill=RED)

    # ── Quote text ────────────────────────────────────────────────────────────
    visible = quote_text[:chars_shown]
    lines   = _wrap(visible, qfont, text_w)

    lh   = int(font_size * 1.6)
    th   = len(lines) * lh
    ty   = (height - th) // 2  # vertically centred

    for i, line in enumerate(lines):
        draw.text((pad, ty + i * lh), line, font=qfont, fill=RED)

    # Typing cursor
    if show_cursor and chars_shown < len(quote_text) and lines:
        last_w, _ = _text_size(qfont, lines[-1])
        cx = pad + last_w + 4
        cy = ty + (len(lines) - 1) * lh
        cw = max(3, font_size // 14)
        draw.rectangle([cx, cy, cx + cw, cy + font_size], fill=RED)

    # ── Close quote mark ──────────────────────────────────────────────────────
    if show_qmarks and chars_shown >= len(quote_text):
        qmw, _ = _text_size(qmfont, "\u201d")
        draw.text((width - pad - qmw,
                   ty + th - int(font_size * 0.5)),
                  "\u201d", font=qmfont, fill=RED)

    # ── Author ────────────────────────────────────────────────────────────────
    if show_author and author:
        auth = author.upper()
        aw, ah = _text_size(afont, auth)
        dash   = max(22, width // 70)
        gap    = 12
        total  = dash + gap + aw
        ax     = width - pad - total
        ay     = height - pad - ah - lh // 3
        mid_y  = ay + ah // 2
        draw.rectangle([ax, mid_y - 1, ax + dash, mid_y + 1], fill=RED_DIM)
        draw.text((ax + dash + gap, ay), auth, font=afont, fill=RED_DIM)

    return img


# ── Public entry point ─────────────────────────────────────────────────────────

def generate_quote_video(
    quote_text: str,
    author: str,
    video_id: str,
    aspect_ratio: str = "16:9",
    font_size: int = 48,
    typing_speed_ms: int = 42,
    hold_duration_s: float = 5.0,
    output_dir: Optional[Path] = None,
    cb: Optional[Callable] = None,
) -> str:
    """
    Generate an animated quote-card MP4.

    Strategy: render one PNG per character reveal, then use FFmpeg's
    concat-demuxer (with per-frame `duration`) so we only generate
    len(quote_text) + a few extra frames — never thousands.

    Returns: path to the output .mp4 file.
    """
    if not PIL_OK:
        raise RuntimeError("Pillow not installed — pip install Pillow")

    def log(msg: str):
        print(f"[QUOTE] {msg}")
        if cb:
            cb({"step": "QUOTE", "message": msg})

    width, height = RATIOS.get(aspect_ratio, (1920, 1080))

    if output_dir is None:
        output_dir = config.TEMP_DIR / video_id
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    frames_dir = output_dir / "qframes"
    if frames_dir.exists():
        shutil.rmtree(str(frames_dir))
    frames_dir.mkdir()

    log(f"Rendering {width}×{height} at font_size={font_size} for {len(quote_text)} chars …")

    frame_paths  = []
    frame_durs   = []   # seconds each PNG is displayed

    def save(img: "Image.Image", idx: int) -> Path:
        p = frames_dir / f"f{idx:05d}.png"
        img.save(p, "PNG")
        frame_paths.append(p)
        return p

    idx = 0

    # ── Phase 1: blank intro (0.4 s) ─────────────────────────────────────────
    save(_render_frame(width, height, quote_text, 0, author, font_size,
                       True, False, False, False), idx)
    frame_durs.append(0.40)
    idx += 1

    # ── Phase 2: open-quote mark appears (0.3 s) ─────────────────────────────
    save(_render_frame(width, height, quote_text, 0, author, font_size,
                       True, True, False, False), idx)
    frame_durs.append(0.30)
    idx += 1

    # ── Phase 3: typing (one frame per char reveal) ───────────────────────────
    n = len(quote_text)
    for c in range(1, n + 1):
        ch = quote_text[c - 1]
        save(_render_frame(width, height, quote_text, c, author, font_size,
                           True, True, False, c < n), idx)
        # Duration reflects punctuation pauses
        if ch in ".!?":
            dur = (typing_speed_ms * 7) / 1000.0
        elif ch in ",;:":
            dur = (typing_speed_ms * 3.5) / 1000.0
        else:
            dur = typing_speed_ms / 1000.0
        frame_durs.append(dur)
        idx += 1

    # ── Phase 4: hold, then author slides in ─────────────────────────────────
    # Half the hold with no author, half with author
    half = hold_duration_s / 2.0
    save(_render_frame(width, height, quote_text, n, author, font_size,
                       True, True, False, False), idx)
    frame_durs.append(half)
    idx += 1

    save(_render_frame(width, height, quote_text, n, author, font_size,
                       True, True, True, False), idx)
    frame_durs.append(half)
    idx += 1

    # ── Phase 5: outro hold (1.0 s) ──────────────────────────────────────────
    save(_render_frame(width, height, quote_text, n, author, font_size,
                       True, True, True, False), idx)
    frame_durs.append(1.0)
    idx += 1

    log(f"{idx} frames rendered. Writing concat manifest …")

    # ── Write FFmpeg concat manifest ──────────────────────────────────────────
    manifest = output_dir / "concat.txt"
    with open(manifest, "w") as f:
        for p, d in zip(frame_paths, frame_durs):
            f.write(f"file '{p.resolve()}'\n")
            f.write(f"duration {d:.4f}\n")
        # FFmpeg concat requires the last file to be listed again (no duration)
        f.write(f"file '{frame_paths[-1].resolve()}'\n")

    log("Assembling MP4 with FFmpeg …")

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

    # Cleanup temp frames
    shutil.rmtree(str(frames_dir), ignore_errors=True)
    manifest.unlink(missing_ok=True)

    mb = os.path.getsize(output_path) / 1024 / 1024
    log(f"Done — {output_path.name} ({mb:.1f} MB)")
    return str(output_path)


if __name__ == "__main__":
    out = generate_quote_video(
        quote_text="The only way to do great work is to love what you do.",
        author="Steve Jobs",
        video_id="test_quote",
        aspect_ratio="16:9",
        font_size=52,
    )
    print("Generated:", out)
