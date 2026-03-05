"""
AutoVid — Looping Visual Generator
Generates beautiful looping abstract animations for Script Studio videos.
Uses numpy + moviepy only — no external APIs, completely free.

Styles:
  gradient_wave   — flowing colour gradients
  particle_field  — floating light particles
  aurora          — northern lights shimmer
  geometric_pulse — pulsing geometric shapes
  colour_wash     — calm shifting hues
  starfield       — deep space with moving stars
"""
import sys
import math
import random
import numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
import config

FPS    = 24
WIDTH  = 1280
HEIGHT = 720


# ── Frame generators ──────────────────────────────────────────────────────────

def _gradient_wave_frame(t: float) -> np.ndarray:
    x = np.linspace(0, 2 * math.pi, WIDTH)
    y = np.linspace(0, 2 * math.pi, HEIGHT)
    X, Y = np.meshgrid(x, y)

    wave  = np.sin(X + t * 0.8) * np.cos(Y * 0.5 - t * 0.4)
    wave2 = np.cos(X * 0.7 - t * 0.5) * np.sin(Y + t * 0.6)
    combined = (wave + wave2 + 2) / 4  # 0..1

    r = (combined * 0.6 + 0.15) * 255
    g = (np.sin(combined * math.pi + t * 0.3) * 0.4 + 0.35) * 255
    b = (np.cos(combined * math.pi * 0.7 - t * 0.2) * 0.4 + 0.55) * 255

    frame = np.stack([r, g, b], axis=-1).clip(0, 255).astype(np.uint8)
    return frame


def _aurora_frame(t: float) -> np.ndarray:
    frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.float32)
    x = np.linspace(0, math.pi * 4, WIDTH)

    for i in range(5):
        freq  = 0.6 + i * 0.3
        phase = t * (0.4 + i * 0.15) + i * 1.2
        amp   = 0.12 + i * 0.04
        centre = 0.35 + amp * np.sin(x * freq + phase)

        y_coords = np.linspace(0, 1, HEIGHT).reshape(-1, 1)
        dist     = np.abs(y_coords - centre)
        curtain  = np.exp(-dist ** 2 / 0.008) * (0.7 + 0.3 * np.sin(x * 3 + phase))

        # Aurora colours: green/teal/purple/blue
        colours = [
            [0.0, 1.0, 0.5],
            [0.0, 0.8, 1.0],
            [0.4, 0.2, 1.0],
            [0.1, 0.9, 0.7],
            [0.6, 0.1, 0.9],
        ]
        c = colours[i % len(colours)]
        frame[:, :, 0] += curtain * c[0]
        frame[:, :, 1] += curtain * c[1]
        frame[:, :, 2] += curtain * c[2]

    # Dark background gradient
    bg = np.linspace(0.02, 0.08, HEIGHT).reshape(-1, 1)
    frame[:, :, 2] += bg * 0.6

    return (frame.clip(0, 1) * 255).astype(np.uint8)


def _colour_wash_frame(t: float) -> np.ndarray:
    # Slowly shifting full-frame colour with subtle vignette
    hue_shift = (math.sin(t * 0.2) + 1) / 2  # 0..1
    # HSV→RGB for base colour
    h = (hue_shift * 300 + 160) % 360  # blues/purples/teals
    s, v = 0.7, 0.85

    h6 = h / 60
    i  = int(h6) % 6
    f  = h6 - int(h6)
    p, q, tv = v*(1-s), v*(1-s*f), v*(1-s*(1-f))
    rgb_map = [(v,tv,p),(q,v,p),(p,v,tv),(p,q,v),(tv,p,v),(v,p,q)]
    r, g, b  = rgb_map[i]

    # Add subtle noise and vignette
    noise = np.random.uniform(0, 0.04, (HEIGHT, WIDTH, 3)).astype(np.float32)
    frame = np.full((HEIGHT, WIDTH, 3), [r, g, b], dtype=np.float32) + noise

    # Vignette
    cx, cy = WIDTH / 2, HEIGHT / 2
    X, Y   = np.meshgrid(np.arange(WIDTH), np.arange(HEIGHT))
    dist   = np.sqrt(((X - cx)/cx) ** 2 + ((Y - cy)/cy) ** 2)
    vig    = (1 - dist * 0.45).clip(0, 1)
    frame  *= vig[:, :, np.newaxis]

    # Gentle wave overlay
    x = np.linspace(0, 2*math.pi, WIDTH)
    wave = (np.sin(x + t * 0.5) * 0.04 + 0.96)
    frame *= wave[np.newaxis, :, np.newaxis]

    return (frame.clip(0, 1) * 255).astype(np.uint8)


def _starfield_frame(t: float) -> np.ndarray:
    rng   = np.random.default_rng(42)
    n     = 300
    xs    = rng.uniform(0, 1, n)
    ys    = rng.uniform(0, 1, n)
    sizes = rng.uniform(0.5, 3.0, n)
    speed = rng.uniform(0.005, 0.02, n)

    frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.float32)

    # Moving stars
    xs_t = (xs + speed * t) % 1.0
    for i in range(n):
        px = int(xs_t[i] * WIDTH)
        py = int(ys[i] * HEIGHT)
        r  = max(1, int(sizes[i]))
        bright = 0.6 + 0.4 * math.sin(t * speed[i] * 20 + i)
        y0, y1 = max(0, py - r), min(HEIGHT, py + r + 1)
        x0, x1 = max(0, px - r), min(WIDTH, px + r + 1)
        frame[y0:y1, x0:x1] += bright * 0.9

    # Nebula background
    X, Y = np.meshgrid(np.linspace(0, math.pi*2, WIDTH), np.linspace(0, math.pi, HEIGHT))
    nebula = (np.sin(X * 0.5 + t * 0.08) * np.cos(Y + t * 0.06) + 1) * 0.04
    frame[:, :, 2] += nebula * 1.2  # blue tint nebula
    frame[:, :, 0] += nebula * 0.4  # slight purple

    return (frame.clip(0, 1) * 255).astype(np.uint8)


def _geometric_pulse_frame(t: float) -> np.ndarray:
    frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.float32)
    cx, cy = WIDTH / 2, HEIGHT / 2

    X, Y = np.meshgrid(np.arange(WIDTH, dtype=np.float32), np.arange(HEIGHT, dtype=np.float32))
    dist = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2)

    # Concentric pulsing rings
    for i in range(8):
        r0    = 60 + i * 70
        pulse = r0 + 30 * math.sin(t * 1.2 + i * 0.8)
        ring  = np.exp(-((dist - pulse) ** 2) / 800)
        hue   = (i / 8 + t * 0.05) % 1.0
        h6    = hue * 6
        hi    = int(h6) % 6
        f_    = h6 - int(h6)
        q_    = 1 - f_
        rgb   = [(1,f_,0),(q_,1,0),(0,1,f_),(0,q_,1),(f_,0,1),(1,0,q_)][hi]
        frame[:, :, 0] += ring * rgb[0] * 0.8
        frame[:, :, 1] += ring * rgb[1] * 0.8
        frame[:, :, 2] += ring * rgb[2] * 0.8

    # Slow rotation overlay
    angle = np.arctan2(Y - cy, X - cx)
    spin  = (np.sin(angle * 6 + t * 0.4) + 1) * 0.04
    frame += spin[:, :, np.newaxis]

    return (frame.clip(0, 1) * 255).astype(np.uint8)


def _particle_field_frame(t: float) -> np.ndarray:
    frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.float32)
    rng   = np.random.default_rng(123)
    n     = 200

    px = rng.uniform(0, 1, n)
    py = rng.uniform(0, 1, n)
    vx = rng.uniform(-0.02, 0.02, n)
    vy = rng.uniform(-0.015, 0.015, n)
    cols = rng.uniform(0, 1, (n, 3)).astype(np.float32)
    cols[:, 2] = cols[:, 2] * 0.4 + 0.6  # bias toward blue

    pxt = (px + vx * t) % 1.0
    pyt = (py + vy * t) % 1.0

    bright = 0.5 + 0.5 * np.sin(t * 0.8 + np.arange(n) * 0.4)

    for i in range(n):
        xi = int(pxt[i] * WIDTH)
        yi = int(pyt[i] * HEIGHT)
        b  = float(bright[i])
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                yw, xw = yi + dy, xi + dx
                if 0 <= yw < HEIGHT and 0 <= xw < WIDTH:
                    fade = math.exp(-(dx*dx + dy*dy) / 3)
                    frame[yw, xw] += cols[i] * b * fade * 0.8

    # Deep background
    frame += 0.02

    return (frame.clip(0, 1) * 255).astype(np.uint8)


FRAME_FUNCS = {
    'gradient_wave':   _gradient_wave_frame,
    'aurora':          _aurora_frame,
    'colour_wash':     _colour_wash_frame,
    'starfield':       _starfield_frame,
    'geometric_pulse': _geometric_pulse_frame,
    'particle_field':  _particle_field_frame,
}


# ── Public API ────────────────────────────────────────────────────────────────

def generate_visual(style: str, duration: float, video_id: str) -> str:
    """
    Generate a looping visual animation video.

    Args:
        style:     One of FRAME_FUNCS keys
        duration:  Total seconds of video to generate
        video_id:  For file naming

    Returns:
        Path to the generated MP4 file
    """
    from moviepy.editor import VideoClip

    frame_fn = FRAME_FUNCS.get(style, _colour_wash_frame)
    loop_dur = 8.0  # base loop duration in seconds

    def make_frame(t):
        # Loop the animation by using t mod loop_dur
        return frame_fn(t % loop_dur)

    out_path = config.VIDEOS_OUTPUT_DIR / f"{video_id}_visual.mp4"
    print(f"🎨 Generating looping visual: {style} ({duration:.0f}s)...")

    clip = VideoClip(make_frame, duration=duration)
    clip.write_videofile(
        str(out_path),
        fps=FPS,
        codec="libx264",
        preset="fast",
        logger=None,
    )
    clip.close()

    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"✅ Visual ready: {out_path.name} ({size_mb:.1f}MB)")
    return str(out_path)