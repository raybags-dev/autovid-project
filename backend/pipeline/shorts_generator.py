
"""
AutoVid — YouTube Shorts Generator
Two modes:
  1. create_short_from_video()  — clips the best 60s from an existing video, crops to 9:16
  2. generate_short_visual()    — generates a looping portrait visual for a fresh Short
"""
import os
import uuid
import numpy as np
from pathlib import Path
import subprocess
import tempfile

# ── Constants ─────────────────────────────────────────────────────────────────
SHORT_WIDTH  = 1080
SHORT_HEIGHT = 1920
SHORT_MAX_DURATION = 59   # YouTube Shorts must be ≤ 60 seconds
FPS = 30

# ── Ambience styles for from-scratch Shorts ──────────────────────────────────
AMBIENCE_STYLES = {
    "stars":        "Zoom through a cluster of stars — slow drift, subtle twinkle, deep space blue/purple",
    "aurora":       "Aurora borealis rippling — green and purple waves across a dark sky",
    "ocean":        "Slow-motion deep ocean — shafts of light filtering through blue water",
    "fire":         "Warm glowing embers — slow floating sparks on black background",
    "rain":         "Rainy window at night — city lights blurred through raindrops",
    "forest":       "Sunlight through forest canopy — slow sway, golden light rays",
    "citynight":    "Timelapse city at night — light trails, bokeh, warm tones",
    "clouds":       "Timelapse clouds — soft white clouds drifting across a blue sky",
    "galaxy":       "Slow rotation through a spiral galaxy — deep blues and purples",
    "candlelight":  "Single candle flame — soft warm glow, subtle flicker in darkness",
}


# ── Mode 1: Clip from existing video ─────────────────────────────────────────

def create_short_from_video(video_path: str, video_id: str) -> str:
    """
    Takes an existing landscape video, finds the most energetic 59s,
    crops to 9:16 portrait, and returns the path to the short.
    """
    import urllib.request
    import tempfile

    _temp_download = None

    # If video is a remote URL (Supabase), download it first
    if video_path.startswith("http://") or video_path.startswith("https://"):
        print(f"⬇️  Downloading video for short creation...")
        _temp_download = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        urllib.request.urlretrieve(video_path, _temp_download.name)
        video_path = _temp_download.name
        print(f"   Downloaded to: {video_path}")

    short_path = str(Path(tempfile.gettempdir()) / f"{video_id}_short.mp4")

    # Get video duration
    duration = _get_duration(video_path)
    if duration <= SHORT_MAX_DURATION:
        # Already short enough — just crop to portrait
        start_time = 0
        clip_duration = min(duration, SHORT_MAX_DURATION)
    else:
        # Find best segment — use the first 60s of the second quarter
        # (usually past intro, before outro — most content-rich)
        quarter = duration / 4
        start_time = max(0, quarter - 10)
        clip_duration = SHORT_MAX_DURATION

    print(f"✂️  Clipping short: {start_time:.1f}s → {start_time + clip_duration:.1f}s")
    print(f"   Source duration: {duration:.1f}s")

    # Crop center of landscape to portrait 9:16
    # For 1920x1080 source: crop 607x1080 from center, then scale to 1080x1920
    crop_filter = (
        f"crop=ih*9/16:ih:(iw-ih*9/16)/2:0,"
        f"scale={SHORT_WIDTH}:{SHORT_HEIGHT}:flags=lanczos"
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

def generate_short_visual(duration: int = 45, ambience: str = "stars") -> str:
    """
    Generates a looping portrait (9:16) visual for a YouTube Short.
    Returns path to the MP4 file.
    """
    output_path = str(Path(tempfile.gettempdir()) / f"short_visual_{uuid.uuid4().hex[:8]}.mp4")
    n_frames = duration * FPS

    print(f"🎬 Generating Short visual: {ambience} ({duration}s, {n_frames} frames)")

    style = ambience.lower()

    if style == "stars":
        frames = _gen_star_zoom(n_frames)
    elif style == "aurora":
        frames = _gen_aurora(n_frames)
    elif style == "ocean":
        frames = _gen_ocean(n_frames)
    elif style == "fire":
        frames = _gen_fire(n_frames)
    elif style == "rain":
        frames = _gen_rain(n_frames)
    elif style == "galaxy":
        frames = _gen_galaxy(n_frames)
    elif style == "candlelight":
        frames = _gen_candlelight(n_frames)
    else:
        frames = _gen_star_zoom(n_frames)  # default

    _frames_to_mp4(frames, output_path, fps=FPS)
    print(f"✅ Short visual ready: {output_path}")
    return output_path


# ── Visual generators (portrait 1080x1920) ────────────────────────────────────

def _gen_star_zoom(n_frames: int) -> list:
    """Zoom through a star cluster — deep space, slow drift."""
    rng = np.random.default_rng(42)
    # Generate stars
    n_stars = 800
    star_x = rng.uniform(0, SHORT_WIDTH,  n_stars)
    star_y = rng.uniform(0, SHORT_HEIGHT, n_stars)
    star_b = rng.uniform(0.4, 1.0, n_stars)   # brightness
    star_s = rng.uniform(0.5, 2.5, n_stars)   # size

    frames = []
    cx, cy = SHORT_WIDTH / 2, SHORT_HEIGHT / 2

    for i in range(n_frames):
        t = i / n_frames
        zoom = 1.0 + t * 0.8   # zoom in over time
        drift_x = np.sin(t * np.pi * 0.5) * 40
        drift_y = -t * 60

        frame = np.zeros((SHORT_HEIGHT, SHORT_WIDTH, 3), dtype=np.uint8)

        # Deep space background gradient
        for y in range(0, SHORT_HEIGHT, 4):
            intensity = int(8 + (y / SHORT_HEIGHT) * 12)
            frame[y:y+4, :] = [intensity, intensity//2, intensity*2]

        # Draw stars with zoom
        for j in range(n_stars):
            sx = int((star_x[j] - cx) * zoom + cx + drift_x)
            sy = int((star_y[j] - cy) * zoom + cy + drift_y)
            if 0 <= sx < SHORT_WIDTH and 0 <= sy < SHORT_HEIGHT:
                twinkle = 0.7 + 0.3 * np.sin(t * 6 * np.pi + j * 0.5)
                b = int(star_b[j] * twinkle * 255)
                s = max(1, int(star_s[j] * zoom))
                color = (min(255, b), min(255, int(b * 0.85)), min(255, int(b * 0.6)))
                x0, x1 = max(0, sx-s), min(SHORT_WIDTH,  sx+s+1)
                y0, y1 = max(0, sy-s), min(SHORT_HEIGHT, sy+s+1)
                frame[y0:y1, x0:x1] = color

        # Subtle nebula glow in center
        glow_r = int(60 + 30 * np.sin(t * np.pi))
        for dy in range(-80, 81, 4):
            for dx in range(-50, 51, 4):
                dist = np.sqrt(dx**2 + dy**2)
                if dist < 80:
                    gy = int(cy + dy)
                    gx = int(cx + dx)
                    if 0 <= gx < SHORT_WIDTH and 0 <= gy < SHORT_HEIGHT:
                        alpha = max(0, 1 - dist/80) * 0.12
                        frame[gy, gx] = np.clip(
                            frame[gy, gx] + np.array([glow_r, 20, 80]) * alpha, 0, 255
                        ).astype(np.uint8)

        frames.append(frame)

    return frames


def _gen_aurora(n_frames: int) -> list:
    """Aurora borealis — green/purple rippling waves."""
    frames = []
    for i in range(n_frames):
        t = i / FPS
        frame = np.zeros((SHORT_HEIGHT, SHORT_WIDTH, 3), dtype=np.uint8)

        # Dark sky gradient
        for y in range(SHORT_HEIGHT):
            darkness = int(5 + (y / SHORT_HEIGHT) * 15)
            frame[y, :] = [darkness // 3, darkness // 2, darkness]

        # Aurora bands
        for band in range(4):
            band_center = SHORT_HEIGHT * (0.2 + band * 0.15)
            for x in range(SHORT_WIDTH):
                wave = np.sin(x * 0.008 + t * 0.8 + band * 1.2) * 60
                wave2 = np.sin(x * 0.004 + t * 0.5 + band * 0.7) * 40
                y_pos = int(band_center + wave + wave2)
                thickness = 40 + int(20 * np.sin(t * 1.2 + band))
                for dy in range(-thickness, thickness):
                    gy = y_pos + dy
                    if 0 <= gy < SHORT_HEIGHT:
                        alpha = max(0, 1 - abs(dy) / thickness) * 0.6
                        g = int(180 * alpha * (0.7 + 0.3 * np.sin(t + band)))
                        p = int(120 * alpha * (0.5 + 0.5 * np.sin(t * 1.3 + band + 1)))
                        frame[gy, x] = np.clip(
                            frame[gy, x] + [p//3, g, p], 0, 255
                        ).astype(np.uint8)

        # Stars
        rng = np.random.default_rng(7)
        for _ in range(200):
            sx = rng.integers(0, SHORT_WIDTH)
            sy = rng.integers(0, SHORT_HEIGHT // 3)
            b = int(rng.uniform(100, 200))
            frame[sy, sx] = [b, b, b]

        frames.append(frame)
    return frames


def _gen_ocean(n_frames: int) -> list:
    """Deep ocean — light shafts through blue water."""
    frames = []
    for i in range(n_frames):
        t = i / FPS
        frame = np.zeros((SHORT_HEIGHT, SHORT_WIDTH, 3), dtype=np.uint8)

        for y in range(SHORT_HEIGHT):
            depth = y / SHORT_HEIGHT
            r = int(0  + depth * 10)
            g = int(40 + depth * 80)
            b = int(120 - depth * 60)
            frame[y, :] = [r, g, b]

        # Light shafts from top
        for shaft in range(5):
            shaft_x = int(SHORT_WIDTH * (0.1 + shaft * 0.2) + np.sin(t * 0.4 + shaft) * 30)
            for y in range(SHORT_HEIGHT):
                spread = int(20 + y * 0.15 + np.sin(t * 0.7 + shaft) * 10)
                intensity = max(0, 1 - y / SHORT_HEIGHT) * 0.35
                for dx in range(-spread, spread):
                    x = shaft_x + dx
                    if 0 <= x < SHORT_WIDTH:
                        alpha = intensity * max(0, 1 - abs(dx) / spread)
                        frame[y, x] = np.clip(
                            frame[y, x] + [int(20*alpha), int(60*alpha), int(80*alpha)], 0, 255
                        ).astype(np.uint8)

        # Floating particles
        rng = np.random.default_rng(i % 30)
        for _ in range(50):
            px = rng.integers(0, SHORT_WIDTH)
            py = rng.integers(0, SHORT_HEIGHT)
            frame[py, px] = np.clip(frame[py, px] + [20, 40, 60], 0, 255).astype(np.uint8)

        frames.append(frame)
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
    """Rainy window — city lights blurred through raindrops."""
    rng = np.random.default_rng(55)
    n_drops = 200
    drop_x = rng.uniform(0, SHORT_WIDTH,  n_drops).tolist()
    drop_y = rng.uniform(0, SHORT_HEIGHT, n_drops).tolist()
    drop_v = rng.uniform(3, 8, n_drops).tolist()
    drop_l = rng.integers(10, 40, n_drops).tolist()

    frames = []
    for i in range(n_frames):
        frame = np.zeros((SHORT_HEIGHT, SHORT_WIDTH, 3), dtype=np.uint8)

        # Blurred city light bokeh background
        for light in range(15):
            lx = int(SHORT_WIDTH  * (light / 15.0 + 0.03))
            ly = int(SHORT_HEIGHT * rng.uniform(0.3, 0.8))
            colors = [(255,150,50),(50,150,255),(255,255,100),(200,100,255)]
            col = colors[light % len(colors)]
            radius = rng.integers(40, 100)
            for dy in range(-radius, radius):
                for dx in range(-radius, radius):
                    dist = np.sqrt(dx**2 + dy**2)
                    if dist < radius:
                        px, py = lx + dx, ly + dy
                        if 0 <= px < SHORT_WIDTH and 0 <= py < SHORT_HEIGHT:
                            alpha = max(0, (1 - dist/radius)) * 0.15
                            frame[py, px] = np.clip(
                                frame[py, px] + np.array(col) * alpha, 0, 255
                            ).astype(np.uint8)

        # Rain drops
        for j in range(n_drops):
            drop_y[j] += drop_v[j]
            if drop_y[j] > SHORT_HEIGHT:
                drop_y[j] = 0
                drop_x[j] = rng.uniform(0, SHORT_WIDTH)

            dx, dy = int(drop_x[j]), int(drop_y[j])
            length = drop_l[j]
            for dl in range(length):
                py = dy + dl
                if 0 <= dx < SHORT_WIDTH and 0 <= py < SHORT_HEIGHT:
                    alpha = 1 - dl / length
                    frame[py, dx] = np.clip(
                        frame[py, dx] + [int(150*alpha), int(180*alpha), int(220*alpha)], 0, 255
                    ).astype(np.uint8)

        frames.append(frame)
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
    for frame in frames:
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg write failed: {proc.stderr.read().decode()[-300:]}")

