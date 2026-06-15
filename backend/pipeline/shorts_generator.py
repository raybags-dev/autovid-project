
"""
AutoVid — YouTube Shorts Generator
Two modes:
  1. create_short_from_video()  — clips the best 60s from an existing video, crops to 9:16
  2. generate_short_visual()    — generates a looping portrait visual for a fresh Short
"""
import os
import subprocess
import tempfile
import uuid
from pathlib import Path

import numpy as np

# ── Constants ─────────────────────────────────────────────────────────────────
SHORT_WIDTH  = 1080
SHORT_HEIGHT = 1920
SHORT_MAX_DURATION = 180  # up to 3 minutes for YouTube Shorts
FPS = 30
LOOP_SECONDS = 4  # Generate this many seconds of unique frames, then FFmpeg-loop to full duration

# ── Ambience styles for from-scratch Shorts ──────────────────────────────────
AMBIENCE_STYLES = {
    "stars":   "Zoom through a cluster of stars — slow drift, subtle twinkle, deep space blue/purple",
    "aurora":  "Aurora borealis rippling — green and purple waves across a dark sky",
    "ocean":   "Slow-motion deep ocean — shafts of light filtering through blue water",
    "fire":    "Warm glowing embers — slow floating sparks on black background",
    "rain":    "Rainy window at night — city lights blurred through raindrops",
    "galaxy":  "Slow rotation through a spiral galaxy — deep blues and purples",
}


# ── Mode 1: Clip from existing video ─────────────────────────────────────────

def create_short_from_video(
    video_path: str,
    video_id: str,
    start_time: float = None,
    end_time: float = None,
) -> str:
    """
    Takes an existing video, crops the specified range to 9:16 portrait.

    start_time / end_time: explicit clip range in seconds (user-specified).
    If omitted, auto-detects the best segment (skips first ~25%, clips up to
    SHORT_MAX_DURATION seconds).

    Scale-to-height approach: scales so height fills 1920px, then center-crops
    to 1080px width — guarantees full frame fill with no black bars.
    """
    import tempfile
    import urllib.request

    _temp_download = None

    # If video is a remote URL (Supabase), download it first
    if video_path.startswith("http://") or video_path.startswith("https://"):
        print("⬇️  Downloading video for short creation...")
        _temp_download = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        urllib.request.urlretrieve(video_path, _temp_download.name)
        video_path = _temp_download.name
        print(f"   Downloaded to: {video_path}")

    short_path = str(Path(tempfile.gettempdir()) / f"{video_id}_short.mp4")

    # Determine clip range
    duration = _get_duration(video_path)
    if start_time is not None and end_time is not None:
        # User-specified range — cap at SHORT_MAX_DURATION
        start_time   = max(0.0, float(start_time))
        end_time     = min(float(end_time), duration)
        clip_duration = min(end_time - start_time, SHORT_MAX_DURATION)
        if clip_duration <= 0:
            clip_duration = min(duration, SHORT_MAX_DURATION)
            start_time = 0.0
    elif duration <= SHORT_MAX_DURATION:
        start_time    = 0.0
        clip_duration = duration
    else:
        # Auto: skip first ~25%, clip up to SHORT_MAX_DURATION
        quarter       = duration / 4
        start_time    = max(0.0, quarter - 10)
        clip_duration = SHORT_MAX_DURATION

    print(f"✂️  Clipping short: {start_time:.1f}s → {start_time + clip_duration:.1f}s (source: {duration:.1f}s)")

    # Scale-to-height then center-crop to 9:16 (1080×1920)
    # Scales so the full height fills 1920px regardless of source aspect ratio,
    # then crops the center 1080px horizontally — no black bars, no distortion.
    crop_filter = (
        f"scale=-1:{SHORT_HEIGHT}:flags=lanczos,"
        f"crop={SHORT_WIDTH}:{SHORT_HEIGHT}:(iw-{SHORT_WIDTH})/2:0,"
        f"setsar=1"
    )

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_time),
        "-i", video_path,
        "-t", str(clip_duration),
        "-vf", crop_filter,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        short_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg crop failed: {result.stderr[-500:]}")

    print(f"✅ Short created: {Path(short_path).name} ({os.path.getsize(short_path)/1024/1024:.1f} MB)")

    # Clean up temp download
    if _temp_download and os.path.exists(_temp_download.name):
        os.unlink(_temp_download.name)

    return short_path


# ── Mode 2: Generate portrait visual from scratch ─────────────────────────────

_CUSTOM_MP4_MAP = {
    "nebular":         Path(__file__).parent.parent / "custom_artifacts" / "nebular.mp4",
    "galaxy_spinning": Path(__file__).parent.parent / "custom_artifacts" / "gaxy_spining.mp4",
}


def generate_short_visual(duration: int = 45, ambience: str = "stars") -> str:
    """
    Generates a looping portrait (9:16) visual for a YouTube Short.
    Generates LOOP_SECONDS of unique frames then uses FFmpeg to loop to full duration.
    Returns path to the MP4 file.
    """
    import math
    output_path = str(Path(tempfile.gettempdir()) / f"short_visual_{uuid.uuid4().hex[:8]}.mp4")
    loop_frames = LOOP_SECONDS * FPS

    style = ambience.lower()

    # Custom mp4 backgrounds — loop the file, crop/scale to portrait 9:16
    if style in _CUSTOM_MP4_MAP and _CUSTOM_MP4_MAP[style].exists():
        print(f"🎬 Using custom background: {style} ({duration}s, portrait)")
        subprocess.run([
            "ffmpeg", "-y",
            "-stream_loop", "-1",
            "-i", str(_CUSTOM_MP4_MAP[style]),
            "-t", str(duration),
            "-vf", f"scale={SHORT_WIDTH}:{SHORT_HEIGHT}:force_original_aspect_ratio=increase,crop={SHORT_WIDTH}:{SHORT_HEIGHT},setsar=1,fps={FPS}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-an", output_path,
        ], check=True, capture_output=True)
        print(f"✅ Short visual ready: {output_path}")
        return output_path

    print(f"🎬 Generating Short visual: {ambience} ({duration}s, {loop_frames} frames + FFmpeg loop)")

    if style == "stars":
        frames = _gen_star_zoom(loop_frames)
    elif style == "aurora":
        frames = _gen_aurora(loop_frames)
    elif style == "ocean":
        frames = _gen_ocean(loop_frames)
    elif style == "fire":
        frames = _gen_fire(loop_frames)
    elif style == "rain":
        frames = _gen_rain(loop_frames)
    elif style == "galaxy":
        frames = _gen_galaxy(loop_frames)
    else:
        frames = _gen_star_zoom(loop_frames)  # default

    # Write the short loop segment to a temp file
    loop_path = str(Path(tempfile.gettempdir()) / f"short_loop_{uuid.uuid4().hex[:8]}.mp4")
    _frames_to_mp4(frames, loop_path, fps=FPS)

    # Use FFmpeg to loop the segment to the full target duration
    loops_needed = math.ceil(duration / LOOP_SECONDS) + 1
    result = subprocess.run([
        "ffmpeg", "-y",
        "-stream_loop", str(loops_needed),
        "-i", loop_path,
        "-t", str(duration),
        "-c", "copy",
        output_path
    ], capture_output=True, text=True)

    try:
        os.unlink(loop_path)
    except Exception:
        pass

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg loop failed: {result.stderr[-300:]}")

    print(f"✅ Short visual ready: {output_path}")
    return output_path


# ── Visual generators (portrait 1080x1920) ────────────────────────────────────

def _gen_star_zoom(n_frames: int) -> list:
    """Zoom through a star cluster — deep space, slow drift. Fully vectorized."""
    rng = np.random.default_rng(42)
    n_stars = 800
    star_x = rng.uniform(0, SHORT_WIDTH,  n_stars)
    star_y = rng.uniform(0, SHORT_HEIGHT, n_stars)
    star_b = rng.uniform(0.4, 1.0, n_stars)
    star_s = rng.uniform(0.5, 2.5, n_stars)
    j_idx  = np.arange(n_stars, dtype=np.float32)

    cx, cy = SHORT_WIDTH / 2, SHORT_HEIGHT / 2

    # Static background gradient (computed once)
    ys = np.arange(SHORT_HEIGHT, dtype=np.float32)
    intensity = (8 + (ys / SHORT_HEIGHT) * 12)
    bg = np.zeros((SHORT_HEIGHT, SHORT_WIDTH, 3), dtype=np.float32)
    bg[:, :, 0] = intensity[:, None]
    bg[:, :, 1] = (intensity / 2)[:, None]
    bg[:, :, 2] = (intensity * 2)[:, None]

    # Static nebula glow mask (computed once)
    dy_vals = np.arange(-80, 81, 4, dtype=np.float32)
    dx_vals = np.arange(-50, 51, 4, dtype=np.float32)
    DY, DX  = np.meshgrid(dy_vals, dx_vals, indexing='ij')
    dist    = np.sqrt(DX**2 + DY**2)
    nebula_mask  = dist < 80
    nebula_alpha = np.where(nebula_mask, np.maximum(0.0, 1.0 - dist / 80.0) * 0.12, 0.0)
    nebula_gy    = (cy + dy_vals).astype(int)
    nebula_gx    = (cx + dx_vals).astype(int)
    valid_y = (nebula_gy >= 0) & (nebula_gy < SHORT_HEIGHT)
    valid_x = (nebula_gx >= 0) & (nebula_gx < SHORT_WIDTH)

    frames = []
    for i in range(n_frames):
        t = i / n_frames
        zoom    = 1.0 + t * 0.8
        drift_x = np.sin(t * np.pi * 0.5) * 40
        drift_y = -t * 60

        frame = bg.copy()

        # Stars — vectorized positions and brightness
        sx = ((star_x - cx) * zoom + cx + drift_x).astype(int)
        sy = ((star_y - cy) * zoom + cy + drift_y).astype(int)
        twinkle = 0.7 + 0.3 * np.sin(t * 6 * np.pi + j_idx * 0.5)
        b = star_b * twinkle * 255
        valid = (sx >= 0) & (sx < SHORT_WIDTH) & (sy >= 0) & (sy < SHORT_HEIGHT)
        vsx, vsy, vb = sx[valid], sy[valid], b[valid]
        frame[vsy, vsx, 0] = np.minimum(255, vb)
        frame[vsy, vsx, 1] = np.minimum(255, vb * 0.85)
        frame[vsy, vsx, 2] = np.minimum(255, vb * 0.6)

        # Nebula glow — vectorized over the small grid
        glow_r = 60 + 30 * np.sin(t * np.pi)
        for di, gy in enumerate(nebula_gy):
            if not valid_y[di]:
                continue
            row_alpha = nebula_alpha[di, :]
            gx_valid  = nebula_gx[valid_x]
            a_valid   = row_alpha[valid_x]
            frame[gy, gx_valid, 0] = np.minimum(255, frame[gy, gx_valid, 0] + glow_r * a_valid)
            frame[gy, gx_valid, 1] = np.minimum(255, frame[gy, gx_valid, 1] + 20    * a_valid)
            frame[gy, gx_valid, 2] = np.minimum(255, frame[gy, gx_valid, 2] + 80    * a_valid)

        frames.append(np.clip(frame, 0, 255).astype(np.uint8))

    return frames


def _gen_aurora(n_frames: int) -> list:
    """Aurora borealis — green/purple rippling waves. Fully vectorized."""
    ys = np.arange(SHORT_HEIGHT, dtype=np.float32)
    xs = np.arange(SHORT_WIDTH,  dtype=np.float32)

    # Static star field (same every frame)
    rng_stars = np.random.default_rng(7)
    star_x = rng_stars.integers(0, SHORT_WIDTH,    200)
    star_y = rng_stars.integers(0, SHORT_HEIGHT//3, 200)
    star_b = rng_stars.uniform(100, 200, 200).astype(np.float32)

    # Static sky gradient
    darkness = (5 + (ys / SHORT_HEIGHT) * 15)  # (H,)
    sky = np.stack([darkness / 3, darkness / 2, darkness], axis=-1)  # (H, 3)
    sky_base = np.broadcast_to(sky[:, None, :], (SHORT_HEIGHT, SHORT_WIDTH, 3)).copy()

    frames = []
    for i in range(n_frames):
        t = i / FPS
        frame = sky_base.copy()

        # Aurora bands — vectorized over all (H, W) at once
        for band in range(4):
            band_center = SHORT_HEIGHT * (0.2 + band * 0.15)
            wave  = np.sin(xs * 0.008 + t * 0.8 + band * 1.2) * 60  # (W,)
            wave2 = np.sin(xs * 0.004 + t * 0.5 + band * 0.7) * 40  # (W,)
            y_pos = band_center + wave + wave2                         # (W,)
            thickness = 40 + 20 * float(np.sin(t * 1.2 + band))

            # dy[h, w] = distance of row h from band center at column w
            dy = ys[:, None] - y_pos[None, :]           # (H, W)
            alpha = np.maximum(0.0, 1.0 - np.abs(dy) / thickness) * 0.6

            g = float(180 * (0.7 + 0.3 * np.sin(t + band)))
            p = float(120 * (0.5 + 0.5 * np.sin(t * 1.3 + band + 1)))
            frame[:, :, 0] += alpha * (p / 3)
            frame[:, :, 1] += alpha * g
            frame[:, :, 2] += alpha * p

        # Stars
        frame[star_y, star_x, 0] = star_b
        frame[star_y, star_x, 1] = star_b
        frame[star_y, star_x, 2] = star_b

        frames.append(np.clip(frame, 0, 255).astype(np.uint8))
    return frames


def _gen_ocean(n_frames: int) -> list:
    """Deep ocean — light shafts through blue water. Fully vectorized."""
    ys = np.arange(SHORT_HEIGHT, dtype=np.float32)
    xs = np.arange(SHORT_WIDTH,  dtype=np.float32)

    # Static depth gradient
    depth = ys / SHORT_HEIGHT  # (H,)
    bg = np.zeros((SHORT_HEIGHT, SHORT_WIDTH, 3), dtype=np.float32)
    bg[:, :, 0] = (depth * 10)[:, None]
    bg[:, :, 1] = (40 + depth * 80)[:, None]
    bg[:, :, 2] = (120 - depth * 60)[:, None]

    intensity_base = np.maximum(0, 1 - ys / SHORT_HEIGHT) * 0.35  # (H,)

    frames = []
    for i in range(n_frames):
        t = i / FPS
        frame = bg.copy()

        # Light shafts — vectorized over (H, W) per shaft
        for shaft in range(5):
            shaft_x = SHORT_WIDTH * (0.1 + shaft * 0.2) + np.sin(t * 0.4 + shaft) * 30
            spread = 20 + ys * 0.15 + np.sin(t * 0.7 + shaft) * 10  # (H,)

            dx = np.abs(xs[None, :] - shaft_x)               # (1, W) → broadcast to (H, W)
            alpha = intensity_base[:, None] * np.maximum(0.0, 1.0 - dx / spread[:, None])

            frame[:, :, 0] += 20 * alpha
            frame[:, :, 1] += 60 * alpha
            frame[:, :, 2] += 80 * alpha

        # Floating particles
        rng = np.random.default_rng(i % 30)
        px = rng.integers(0, SHORT_WIDTH,  50)
        py = rng.integers(0, SHORT_HEIGHT, 50)
        frame[py, px, 0] += 20
        frame[py, px, 1] += 40
        frame[py, px, 2] += 60

        frames.append(np.clip(frame, 0, 255).astype(np.uint8))
    return frames


def _gen_fire(n_frames: int) -> list:
    """Warm glowing embers — floating sparks on black."""
    rng = np.random.default_rng(99)
    n_embers = 120
    ember_x = rng.uniform(0, SHORT_WIDTH,  n_embers).tolist()
    ember_y = rng.uniform(0, SHORT_HEIGHT, n_embers).tolist()
    ember_s = rng.uniform(1, 4, n_embers).tolist()
    ember_v = rng.uniform(0.3, 1.5, n_embers).tolist()

    frames = []
    for i in range(n_frames):
        t = i / FPS
        frame = np.zeros((SHORT_HEIGHT, SHORT_WIDTH, 3), dtype=np.uint8)

        # Background warm glow at bottom
        for y in range(SHORT_HEIGHT):
            glow = max(0, 1 - y / (SHORT_HEIGHT * 0.4)) * 0.3
            frame[y, :] = [int(80 * glow), int(20 * glow), 0]

        # Move embers upward
        for j in range(n_embers):
            ember_y[j] -= ember_v[j]
            ember_x[j] += np.sin(t * 1.5 + j * 0.3) * 0.8
            if ember_y[j] < 0:
                ember_y[j] = SHORT_HEIGHT
                ember_x[j] = rng.uniform(0, SHORT_WIDTH)

            ex, ey = int(ember_x[j]), int(ember_y[j])
            if 0 <= ex < SHORT_WIDTH and 0 <= ey < SHORT_HEIGHT:
                life = ember_y[j] / SHORT_HEIGHT
                r = int(255 * life)
                g = int(120 * life * life)
                s = max(1, int(ember_s[j] * life))
                x0, x1 = max(0, ex-s), min(SHORT_WIDTH,  ex+s+1)
                y0, y1 = max(0, ey-s), min(SHORT_HEIGHT, ey+s+1)
                frame[y0:y1, x0:x1] = np.clip(
                    frame[y0:y1, x0:x1] + [r, g, 0], 0, 255
                ).astype(np.uint8)

        frames.append(frame)
    return frames


def _gen_rain(n_frames: int) -> list:
    """Rainy window — city lights blurred through raindrops. Fully vectorized."""
    rng = np.random.default_rng(55)
    n_drops = 200
    drop_x = rng.uniform(0, SHORT_WIDTH,  n_drops).tolist()
    drop_y = rng.uniform(0, SHORT_HEIGHT, n_drops).tolist()
    drop_v = rng.uniform(3, 8, n_drops).tolist()
    drop_l = rng.integers(10, 40, n_drops).tolist()

    ys = np.arange(SHORT_HEIGHT, dtype=np.float32)
    xs = np.arange(SHORT_WIDTH,  dtype=np.float32)

    # Pre-render static bokeh background (city lights don't move)
    bokeh_bg = np.zeros((SHORT_HEIGHT, SHORT_WIDTH, 3), dtype=np.float32)
    rng_bokeh = np.random.default_rng(55)
    colors_list = [(255,150,50),(50,150,255),(255,255,100),(200,100,255)]
    for light in range(15):
        lx = int(SHORT_WIDTH  * (light / 15.0 + 0.03))
        ly = int(SHORT_HEIGHT * rng_bokeh.uniform(0.3, 0.8))
        col = np.array(colors_list[light % len(colors_list)], dtype=np.float32)
        radius = int(rng_bokeh.integers(40, 100))
        y0, y1 = max(0, ly - radius), min(SHORT_HEIGHT, ly + radius)
        x0, x1 = max(0, lx - radius), min(SHORT_WIDTH,  lx + radius)
        if y1 > y0 and x1 > x0:
            dy = ys[y0:y1, None] - ly
            dx = xs[None, x0:x1] - lx
            dist = np.sqrt(dx**2 + dy**2)
            alpha = np.maximum(0.0, 1.0 - dist / radius) * 0.15
            bokeh_bg[y0:y1, x0:x1] += alpha[:, :, None] * col[None, None, :]

    frames = []
    for i in range(n_frames):
        frame = bokeh_bg.copy()

        # Advance rain drops
        for j in range(n_drops):
            drop_y[j] += drop_v[j]
            if drop_y[j] > SHORT_HEIGHT:
                drop_y[j] = 0
                drop_x[j] = rng.uniform(0, SHORT_WIDTH)

        # Draw rain drops (vectorized per drop streak)
        for j in range(n_drops):
            dx_val = int(drop_x[j])
            dy_val = int(drop_y[j])
            if not (0 <= dx_val < SHORT_WIDTH):
                continue
            length = drop_l[j]
            y_end = min(dy_val + length, SHORT_HEIGHT)
            if dy_val >= y_end:
                continue
            dl = np.arange(y_end - dy_val, dtype=np.float32)
            alpha = 1.0 - dl / length
            frame[dy_val:y_end, dx_val, 0] += 150 * alpha
            frame[dy_val:y_end, dx_val, 1] += 180 * alpha
            frame[dy_val:y_end, dx_val, 2] += 220 * alpha

        frames.append(np.clip(frame, 0, 255).astype(np.uint8))
    return frames


def _gen_galaxy(n_frames: int) -> list:
    """Slow rotation through a spiral galaxy."""
    rng = np.random.default_rng(13)
    n_stars = 1200
    # Spiral galaxy
    angles = rng.uniform(0, 4 * np.pi, n_stars)
    radii  = rng.uniform(0, 1, n_stars) ** 0.5 * min(SHORT_WIDTH, SHORT_HEIGHT) * 0.45
    star_x = radii * np.cos(angles) + SHORT_WIDTH  / 2
    star_y = radii * np.sin(angles) + SHORT_HEIGHT / 2
    star_b = rng.uniform(0.3, 1.0, n_stars)
    star_c = rng.uniform(0, 1, n_stars)  # color variation

    frames = []
    cx, cy = SHORT_WIDTH / 2, SHORT_HEIGHT / 2

    for i in range(n_frames):
        t = i / n_frames
        rotation = t * 0.3   # slow rotation
        frame = np.zeros((SHORT_HEIGHT, SHORT_WIDTH, 3), dtype=np.uint8)

        # Background
        frame[:, :] = [5, 3, 12]

        for j in range(n_stars):
            angle = np.arctan2(star_y[j] - cy, star_x[j] - cx) + rotation
            r     = np.sqrt((star_x[j]-cx)**2 + (star_y[j]-cy)**2)
            sx = int(cx + r * np.cos(angle))
            sy = int(cy + r * np.sin(angle))

            if 0 <= sx < SHORT_WIDTH and 0 <= sy < SHORT_HEIGHT:
                b = int(star_b[j] * 230)
                c = star_c[j]
                if c < 0.33:
                    color = (b, int(b*0.8), int(b*0.5))   # warm yellow
                elif c < 0.66:
                    color = (int(b*0.6), int(b*0.7), b)   # cool blue
                else:
                    color = (b, b, b)                      # white
                frame[sy, sx] = color

        frames.append(frame)
    return frames


def _gen_candlelight(n_frames: int) -> list:
    """Single candle — soft warm glow, subtle flicker."""
    frames = []
    cx = SHORT_WIDTH // 2
    cy = SHORT_HEIGHT // 2 + 200   # candle positioned lower

    for i in range(n_frames):
        t = i / FPS
        frame = np.zeros((SHORT_HEIGHT, SHORT_WIDTH, 3), dtype=np.uint8)

        # Flickering glow radius
        flicker = 1.0 + 0.12 * np.sin(t * 8.3) + 0.06 * np.sin(t * 13.7)

        # Draw glow (multiple passes for soft falloff)
        for radius, intensity in [(300, 0.08), (180, 0.18), (100, 0.35), (50, 0.6)]:
            r = int(radius * flicker)
            for y in range(max(0, cy-r), min(SHORT_HEIGHT, cy+r)):
                for x in range(max(0, cx-r), min(SHORT_WIDTH, cx+r)):
                    dist = np.sqrt((x-cx)**2 + (y-cy)**2)
                    if dist < r:
                        alpha = intensity * (1 - dist/r) ** 2
                        frame[y, x] = np.clip(
                            frame[y, x] + [int(255*alpha), int(140*alpha), int(30*alpha)], 0, 255
                        ).astype(np.uint8)

        # Flame tip
        flame_h = int(40 + 15 * np.sin(t * 9.1) * flicker)
        for fy in range(flame_h):
            fw = max(1, int((1 - fy/flame_h) * 12))
            gy = cy - fy - 10
            if 0 <= gy < SHORT_HEIGHT:
                for dx in range(-fw, fw+1):
                    gx = cx + dx
                    if 0 <= gx < SHORT_WIDTH:
                        intensity = (1 - abs(dx)/max(fw,1)) * (1 - fy/flame_h)
                        frame[gy, gx] = np.clip(
                            frame[gy, gx] + [int(255*intensity), int(200*intensity*0.6), int(50*intensity*0.2)], 0, 255
                        ).astype(np.uint8)

        frames.append(frame)
    return frames


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_duration(video_path: str) -> float:
    """Get video duration in seconds using ffprobe."""
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", video_path],
        capture_output=True, text=True
    )
    try:
        return float(result.stdout.strip())
    except:
        return 60.0


def _frames_to_mp4(frames: list, output_path: str, fps: int = 30):
    """Write numpy frames to MP4 using FFmpeg pipe."""
    import subprocess as sp
    import threading
    h, w = frames[0].shape[:2]
    cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{w}x{h}",
        "-pix_fmt", "rgb24",
        "-r", str(fps),
        "-i", "pipe:0",
        "-vcodec", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        output_path
    ]
    proc = sp.Popen(cmd, stdin=sp.PIPE, stderr=sp.PIPE)
    # Drain stderr in a background thread to prevent PIPE buffer deadlock.
    # Without this, ffmpeg blocks writing progress output once the 64KB pipe
    # buffer fills, while Python is blocked writing frames to stdin → deadlock.
    stderr_chunks = []
    def _drain_stderr():
        stderr_chunks.append(proc.stderr.read())
    drain_thread = threading.Thread(target=_drain_stderr, daemon=True)
    drain_thread.start()
    for frame in frames:
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    proc.wait()
    drain_thread.join()
    if proc.returncode != 0:
        stderr_data = b"".join(stderr_chunks)
        raise RuntimeError(f"FFmpeg write failed: {stderr_data.decode()[-300:]}")

