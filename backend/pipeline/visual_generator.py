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
WIDTH  = 1920
HEIGHT = 1080


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


def _liquid_red_frame(t: float) -> np.ndarray:
    """Viscous crimson liquid blobs morphing through dark space."""
    W, H = WIDTH, HEIGHT
    Xn = np.linspace(0, 1, W)
    Yn = np.linspace(0, 1, H).reshape(-1, 1)
    bs = [
        (0.32 + 0.24*math.sin(t*0.40 + 0.00), 0.30 + 0.22*math.cos(t*0.35 + 1.0), 0.048),
        (0.65 + 0.22*math.cos(t*0.31 + 2.10), 0.60 + 0.24*math.sin(t*0.43 + 0.5), 0.042),
        (0.48 + 0.20*math.sin(t*0.53 + 4.20), 0.75 + 0.16*math.cos(t*0.37 + 2.8), 0.036),
        (0.18 + 0.18*math.cos(t*0.43 + 1.50), 0.18 + 0.17*math.sin(t*0.27 + 3.5), 0.032),
        (0.82 + 0.14*math.sin(t*0.36 + 5.10), 0.42 + 0.19*math.cos(t*0.49 + 0.8), 0.028),
    ]
    field = np.zeros((H, W), dtype=np.float32)
    for bx, by, sigma in bs:
        dx = Xn - bx
        dy = Yn - by
        field += np.exp(-(dx*dx + dy*dy) / (sigma * sigma * 2))
    liquid = 1.0 / (1.0 + np.exp(-9.0 * (field - 0.55)))
    hi     = np.exp(-((field - 0.88)**2) / 0.018) * 0.45
    pulse  = 0.88 + 0.12 * math.sin(t * 0.65)
    r = np.clip(liquid * 0.50 * pulse + hi * 0.75 + 0.015, 0, 1)
    g = np.clip(liquid * 0.01 + hi * 0.08,                  0, 1)
    b = np.clip(liquid * 0.04 + hi * 0.04,                  0, 1)
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)


def _liquid_blue_frame(t: float) -> np.ndarray:
    """Deep indigo-blue viscous blobs in dark space."""
    W, H = WIDTH, HEIGHT
    Xn = np.linspace(0, 1, W)
    Yn = np.linspace(0, 1, H).reshape(-1, 1)
    bs = [
        (0.28 + 0.26*math.cos(t*0.38 + 0.00), 0.32 + 0.21*math.sin(t*0.33 + 1.2), 0.046),
        (0.68 + 0.21*math.sin(t*0.29 + 2.40), 0.62 + 0.23*math.cos(t*0.41 + 0.7), 0.040),
        (0.50 + 0.22*math.cos(t*0.51 + 4.50), 0.78 + 0.15*math.sin(t*0.35 + 3.1), 0.034),
        (0.16 + 0.19*math.sin(t*0.45 + 1.80), 0.16 + 0.18*math.cos(t*0.25 + 3.8), 0.030),
        (0.80 + 0.13*math.cos(t*0.34 + 5.30), 0.45 + 0.20*math.sin(t*0.47 + 1.1), 0.027),
    ]
    field = np.zeros((H, W), dtype=np.float32)
    for bx, by, sigma in bs:
        dx = Xn - bx
        dy = Yn - by
        field += np.exp(-(dx*dx + dy*dy) / (sigma * sigma * 2))
    liquid = 1.0 / (1.0 + np.exp(-9.0 * (field - 0.55)))
    hi     = np.exp(-((field - 0.88)**2) / 0.018) * 0.45
    pulse  = 0.88 + 0.12 * math.sin(t * 0.58)
    r = np.clip(liquid * 0.04 * pulse + hi * 0.12,           0, 1)
    g = np.clip(liquid * 0.06 * pulse + hi * 0.20,           0, 1)
    b = np.clip(liquid * 0.55 * pulse + hi * 0.85 + 0.012,   0, 1)
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)


def _liquid_black_frame(t: float) -> np.ndarray:
    """Near-black viscous blobs with subtle silver-grey shimmer."""
    W, H = WIDTH, HEIGHT
    Xn = np.linspace(0, 1, W)
    Yn = np.linspace(0, 1, H).reshape(-1, 1)
    bs = [
        (0.35 + 0.25*math.sin(t*0.37 + 0.00), 0.33 + 0.22*math.cos(t*0.32 + 1.1), 0.050),
        (0.66 + 0.22*math.cos(t*0.28 + 2.30), 0.63 + 0.22*math.sin(t*0.40 + 0.6), 0.044),
        (0.50 + 0.20*math.sin(t*0.50 + 4.40), 0.77 + 0.14*math.cos(t*0.36 + 2.9), 0.037),
        (0.17 + 0.18*math.cos(t*0.42 + 1.60), 0.17 + 0.16*math.sin(t*0.26 + 3.6), 0.031),
    ]
    field = np.zeros((H, W), dtype=np.float32)
    for bx, by, sigma in bs:
        dx = Xn - bx
        dy = Yn - by
        field += np.exp(-(dx*dx + dy*dy) / (sigma * sigma * 2))
    liquid = 1.0 / (1.0 + np.exp(-8.0 * (field - 0.58)))
    hi     = np.exp(-((field - 0.86)**2) / 0.020) * 0.35
    val = np.clip(liquid * 0.22 + hi * 0.55 + 0.008, 0, 1)
    return (np.stack([val, val, val], axis=-1) * 255).astype(np.uint8)


def _aurora_dark_frame(t: float) -> np.ndarray:
    """Deep obsidian aurora — barely-there dark curtains of light."""
    frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.float32)
    x = np.linspace(0, math.pi * 4, WIDTH)
    for i in range(4):
        freq  = 0.5 + i * 0.25
        phase = t * (0.25 + i * 0.10) + i * 1.4
        amp   = 0.10 + i * 0.03
        centre = 0.40 + amp * np.sin(x * freq + phase)
        y_coords = np.linspace(0, 1, HEIGHT).reshape(-1, 1)
        dist     = np.abs(y_coords - centre)
        curtain  = np.exp(-dist ** 2 / 0.012) * (0.4 + 0.2 * np.sin(x * 2 + phase))
        colours = [
            [0.05, 0.05, 0.18],
            [0.08, 0.03, 0.22],
            [0.03, 0.06, 0.16],
            [0.10, 0.04, 0.20],
        ]
        c = colours[i % len(colours)]
        frame[:, :, 0] += curtain * c[0]
        frame[:, :, 1] += curtain * c[1]
        frame[:, :, 2] += curtain * c[2]
    bg = np.linspace(0.01, 0.04, HEIGHT).reshape(-1, 1)
    frame[:, :, 2] += bg * 0.8
    return (frame.clip(0, 1) * 255).astype(np.uint8)


def _neon_purple_frame(t: float) -> np.ndarray:
    """Vivid neon purple/magenta blobs pulsing on pure black."""
    W, H = WIDTH, HEIGHT
    Xn = np.linspace(0, 1, W)
    Yn = np.linspace(0, 1, H).reshape(-1, 1)
    bs = [
        (0.30 + 0.27*math.sin(t*0.42 + 0.00), 0.28 + 0.23*math.cos(t*0.37 + 1.0), 0.044),
        (0.70 + 0.23*math.cos(t*0.33 + 2.20), 0.65 + 0.25*math.sin(t*0.46 + 0.4), 0.038),
        (0.50 + 0.21*math.sin(t*0.55 + 4.30), 0.80 + 0.16*math.cos(t*0.39 + 2.6), 0.033),
        (0.15 + 0.19*math.cos(t*0.44 + 1.70), 0.14 + 0.17*math.sin(t*0.28 + 3.4), 0.029),
    ]
    field = np.zeros((H, W), dtype=np.float32)
    for bx, by, sigma in bs:
        dx = Xn - bx
        dy = Yn - by
        field += np.exp(-(dx*dx + dy*dy) / (sigma * sigma * 2))
    liquid = 1.0 / (1.0 + np.exp(-10.0 * (field - 0.52)))
    hi     = np.exp(-((field - 0.85)**2) / 0.016) * 0.55
    pulse  = 0.85 + 0.15 * math.sin(t * 0.72)
    glow   = field * 0.06
    r = np.clip(liquid * 0.60 * pulse + hi * 0.95 + glow * 0.4 + 0.01, 0, 1)
    g = np.clip(liquid * 0.08 * pulse + hi * 0.20 + glow * 0.1,        0, 1)
    b = np.clip(liquid * 0.70 * pulse + hi * 1.00 + glow * 0.5 + 0.01, 0, 1)
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)


def _cosmic_dust_frame(t: float) -> np.ndarray:
    """Golden dust and light filaments drifting through deep space."""
    rng   = np.random.default_rng(77)
    n     = 400
    px    = rng.uniform(0, 1, n)
    py    = rng.uniform(0, 1, n)
    sizes = rng.uniform(1, 4, n)
    speed = rng.uniform(0.003, 0.015, n)
    gold  = rng.uniform(0.6, 1.0, n)

    frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.float32)
    px_t  = (px + speed * t * 0.5) % 1.0
    py_t  = (py - speed * t * 0.3) % 1.0

    for i in range(n):
        xi = int(px_t[i] * WIDTH)
        yi = int(py_t[i] * HEIGHT)
        r  = max(1, int(sizes[i]))
        bright = 0.5 + 0.5 * math.sin(t * speed[i] * 15 + i)
        g = gold[i]
        y0, y1 = max(0, yi - r), min(HEIGHT, yi + r + 1)
        x0, x1 = max(0, xi - r), min(WIDTH,  xi + r + 1)
        frame[y0:y1, x0:x1, 0] += bright * g * 0.9
        frame[y0:y1, x0:x1, 1] += bright * g * 0.65
        frame[y0:y1, x0:x1, 2] += bright * g * 0.08

    X, Y   = np.meshgrid(np.linspace(0, math.pi*2, WIDTH), np.linspace(0, math.pi, HEIGHT))
    nebula = (np.sin(X * 0.4 + t * 0.06) * np.cos(Y + t * 0.05) + 1) * 0.03
    frame[:, :, 0] += nebula * 1.0
    frame[:, :, 1] += nebula * 0.55
    frame[:, :, 2] += nebula * 0.05

    return (frame.clip(0, 1) * 255).astype(np.uint8)


def _ember_glow_frame(t: float) -> np.ndarray:
    """Floating amber embers rising from the dark — warm and hypnotic."""
    rng   = np.random.default_rng(55)
    n     = 250
    px    = rng.uniform(0, 1, n)
    py    = rng.uniform(0, 1, n)
    sizes = rng.uniform(1.5, 5, n)
    speed = rng.uniform(0.008, 0.025, n)
    heat  = rng.uniform(0.5, 1.0, n)

    frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.float32)
    px_t  = (px + rng.uniform(-0.002, 0.002, n) * t) % 1.0
    py_t  = (py - speed * t) % 1.0

    for i in range(n):
        xi = int(px_t[i] * WIDTH)
        yi = int(py_t[i] * HEIGHT)
        r  = max(1, int(sizes[i]))
        bright = 0.4 + 0.6 * abs(math.sin(t * speed[i] * 12 + i))
        h  = heat[i]
        y0, y1 = max(0, yi - r), min(HEIGHT, yi + r + 1)
        x0, x1 = max(0, xi - r), min(WIDTH,  xi + r + 1)
        frame[y0:y1, x0:x1, 0] += bright * h * 1.00
        frame[y0:y1, x0:x1, 1] += bright * h * 0.35
        frame[y0:y1, x0:x1, 2] += bright * h * 0.02

    bg_y = np.linspace(0.08, 0.0, HEIGHT).reshape(-1, 1)
    frame[:, :, 0] += bg_y * 0.6
    frame[:, :, 1] += bg_y * 0.15

    return (frame.clip(0, 1) * 255).astype(np.uint8)


def _rain_frame(t: float) -> np.ndarray:
    """Rainy window at night — city lights blurred through raindrops (landscape 1920x1080)."""
    rng = np.random.default_rng(55)
    n_drops = 300
    # Fixed per-drop x position and velocity (deterministic)
    drop_x = rng.uniform(0, WIDTH,  n_drops)
    drop_v = rng.uniform(80, 220, n_drops)   # pixels per second
    drop_y0 = rng.uniform(0, HEIGHT, n_drops)
    drop_l  = rng.integers(12, 45, n_drops).astype(np.float32)

    # Static bokeh city-lights background
    bokeh_bg = np.zeros((HEIGHT, WIDTH, 3), dtype=np.float32)
    rng_b = np.random.default_rng(55)
    colors_list = [(255, 150, 50), (50, 150, 255), (255, 255, 100), (200, 100, 255)]
    ys = np.arange(HEIGHT, dtype=np.float32)
    xs = np.arange(WIDTH,  dtype=np.float32)
    for li in range(22):
        lx = int(WIDTH  * (li / 22.0 + 0.02))
        ly = int(HEIGHT * rng_b.uniform(0.25, 0.75))
        col = np.array(colors_list[li % len(colors_list)], dtype=np.float32)
        radius = int(rng_b.integers(50, 130))
        y0, y1 = max(0, ly - radius), min(HEIGHT, ly + radius)
        x0, x1 = max(0, lx - radius), min(WIDTH,  lx + radius)
        if y1 > y0 and x1 > x0:
            dy = ys[y0:y1, None] - ly
            dx = xs[None, x0:x1] - lx
            dist = np.sqrt(dx ** 2 + dy ** 2)
            alpha = np.maximum(0.0, 1.0 - dist / radius) * 0.15
            bokeh_bg[y0:y1, x0:x1] += alpha[:, :, None] * col[None, None, :]

    frame = bokeh_bg.copy()
    # Compute deterministic drop y positions at time t
    drop_y = (drop_y0 + drop_v * t) % HEIGHT

    for j in range(n_drops):
        dx_val = int(drop_x[j])
        dy_val = int(drop_y[j])
        if not (0 <= dx_val < WIDTH):
            continue
        length = int(drop_l[j])
        y_end = min(dy_val + length, HEIGHT)
        if dy_val >= y_end:
            continue
        dl = np.arange(y_end - dy_val, dtype=np.float32)
        alpha = 1.0 - dl / length
        frame[dy_val:y_end, dx_val, 0] += 150 * alpha
        frame[dy_val:y_end, dx_val, 1] += 180 * alpha
        frame[dy_val:y_end, dx_val, 2] += 220 * alpha

    return np.clip(frame, 0, 255).astype(np.uint8)


def _flythrough_stars_frame(t: float) -> np.ndarray:
    """Camera flying forward through a star field — stars zoom toward the viewer."""
    rng = np.random.default_rng(77)
    n   = 600
    cx, cy = WIDTH / 2, HEIGHT / 2

    # Initial 3D positions: x, y in [-1.5, 1.5], z in (0, 1]
    xs_base = rng.uniform(-1.5, 1.5, n).astype(np.float32)
    ys_base = rng.uniform(-1.5, 1.5, n).astype(np.float32)
    zs_base = rng.uniform(0.02, 1.0, n).astype(np.float32)
    # Stagger initial z so stars are spread through depth
    phase   = rng.uniform(0, 1.0, n).astype(np.float32)

    SPEED = 0.12  # forward flight speed

    # z decreases as we fly forward; wrap so stars reappear from far away
    zs = ((zs_base - (t * SPEED + phase) % 1.0) % 1.0) + 0.005

    # Perspective projection
    fov = WIDTH * 0.45
    screen_x = xs_base / zs * fov + cx
    screen_y = ys_base / zs * fov + cy

    # Size and brightness increase as star approaches (z → 0)
    sizes      = np.clip(0.04 / zs, 1, 12).astype(np.float32)
    brightness = np.clip(0.08 / zs, 0, 1).astype(np.float32)

    frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.float32)

    for i in range(n):
        px = int(screen_x[i])
        py = int(screen_y[i])
        if not (0 <= px < WIDTH and 0 <= py < HEIGHT):
            continue
        r = int(sizes[i])
        b = float(brightness[i])
        z = float(zs[i])
        y0 = max(0, py - r); y1 = min(HEIGHT, py + r + 1)
        x0 = max(0, px - r); x1 = min(WIDTH, px + r + 1)
        # Slightly warmer (orange-white) for very close stars, blue-white for far
        col = np.array([0.95 + 0.05 * (z < 0.15), 0.90 + 0.08 * (z < 0.15), 1.0], np.float32)
        frame[y0:y1, x0:x1] += col * b

    # Subtle central blue glow (motion blur feel)
    X, Y   = np.meshgrid(np.arange(WIDTH, dtype=np.float32), np.arange(HEIGHT, dtype=np.float32))
    dist_c = np.sqrt(((X - cx) / cx) ** 2 + ((Y - cy) / cy) ** 2)
    frame[:, :, 2] += np.exp(-dist_c * 4) * 0.06

    return (frame.clip(0, 1) * 255).astype(np.uint8)


FRAME_FUNCS = {
    # Original generators
    'gradient_wave':   _gradient_wave_frame,
    'aurora':          _aurora_frame,
    'colour_wash':     _colour_wash_frame,
    'starfield':       _starfield_frame,
    'geometric_pulse': _geometric_pulse_frame,
    'particle_field':  _particle_field_frame,
    # Liquid blob moods (match frontend mood IDs)
    'fluid_red':       _liquid_red_frame,
    'fluid_blue':      _liquid_blue_frame,
    'fluid_black':     _liquid_black_frame,
    # Aurora variants
    'aurora_blue':     _aurora_frame,
    'aurora_dark':     _aurora_dark_frame,
    # New visual options
    'neon_purple':     _neon_purple_frame,
    'cosmic_dust':     _cosmic_dust_frame,
    'ember_glow':      _ember_glow_frame,
    # Rain — city lights blurred through rainy window
    'rain':            _rain_frame,
    # Flythrough star field — stars zoom toward viewer
    'flythrough_stars': _flythrough_stars_frame,
}


# ── Public API ────────────────────────────────────────────────────────────────

_CUSTOM_MP4_MAP = {
    "nebular":         Path(__file__).parent.parent / "custom_artifacts" / "nebular.mp4",
    "galaxy_spinning": Path(__file__).parent.parent / "custom_artifacts" / "gaxy_spining.mp4",
}


def _generate_from_custom_mp4(source: Path, duration: float, video_id: str) -> str:
    """Loop a custom mp4 file to the target duration, scaled to 1920x1080."""
    import subprocess
    out_path = str(config.VIDEOS_OUTPUT_DIR / f"{video_id}_visual.mp4")
    subprocess.run([
        "ffmpeg", "-y",
        "-stream_loop", "-1",
        "-i", str(source),
        "-t", str(duration),
        "-vf", f"scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=24",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-an", out_path,
    ], check=True, capture_output=True)
    size_mb = Path(out_path).stat().st_size / (1024 * 1024)
    print(f"✅ Custom background ready: {Path(out_path).name} ({size_mb:.1f}MB)")
    return out_path


def generate_visual(style: str, duration: float, video_id: str) -> str:
    """
    Generate a looping visual animation video.

    Args:
        style:     One of FRAME_FUNCS keys (or a custom mp4 id)
        duration:  Total seconds of video to generate
        video_id:  For file naming

    Returns:
        Path to the generated MP4 file
    """
    # Custom mp4 backgrounds — loop the file instead of generating frames
    if style in _CUSTOM_MP4_MAP and _CUSTOM_MP4_MAP[style].exists():
        return _generate_from_custom_mp4(_CUSTOM_MP4_MAP[style], duration, video_id)

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