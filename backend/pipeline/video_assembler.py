"""
AutoVid Pipeline — Step 4: Video Assembler

Combines stock video clips + synthesized audio into a final 1080p video.
Uses MoviePy + FFmpeg under the hood.

What this does:
  1. For each segment, resize/crop the clip to 1920x1080
  2. Trim clip to match segment duration (loop if clip is too short)
  3. Stack all segment clips sequentially
  4. Overlay the audio track perfectly synced
  5. Add a subtle background music bed (optional)
  6. Export to MP4 H.264 at 5Mbps (YouTube recommended)
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import os
import subprocess
from pathlib import Path
from typing import Optional
import config

# Use moviepy — install: pip install moviepy
from moviepy.editor import (
    VideoFileClip, ColorClip, CompositeVideoClip,
    AudioFileClip, concatenate_videoclips, afx
)
from moviepy.video.fx.all import resize, crop

# ── Pillow compatibility (ANTIALIAS removed in Pillow 10+) ───────────────────
import PIL.Image
if not hasattr(PIL.Image, "ANTIALIAS"):
    PIL.Image.ANTIALIAS = PIL.Image.LANCZOS




# ── Clip Preparation ──────────────────────────────────────────────────────────

def _prepare_clip(clip_path: Optional[str], duration: float) -> VideoFileClip:
    """
    Load a stock clip and fit it to the required duration at 1920x1080.
    If clip_path is None, returns a dark fallback color clip.
    """
    W = config.VIDEO_RESOLUTION_W
    H = config.VIDEO_RESOLUTION_H

    if clip_path is None or not os.path.exists(clip_path):
        # Fallback: animated dark gradient clip
        print(f"  ℹ️  Using fallback color clip ({duration:.1f}s)")
        return ColorClip(size=(W, H), color=(10, 15, 25), duration=duration)

    try:
        clip = VideoFileClip(clip_path, audio=False)

        # Loop if the clip is shorter than needed
        if clip.duration < duration:
            loops = int(duration / clip.duration) + 1
            from moviepy.editor import concatenate_videoclips
            clip = concatenate_videoclips([clip] * loops)

        # Trim to exact duration
        clip = clip.subclip(0, duration)

        # Resize/crop to fill 1920x1080 (cover, not letterbox)
        clip_ratio = clip.w / clip.h
        target_ratio = W / H

        if clip_ratio > target_ratio:
            # Wider than target — scale by height then crop width
            clip = clip.resize(height=H)
            excess = clip.w - W
            clip = clip.crop(x1=excess // 2, x2=clip.w - excess // 2)
        else:
            # Taller than target — scale by width then crop height
            clip = clip.resize(width=W)
            excess = clip.h - H
            clip = clip.crop(y1=excess // 2, y2=clip.h - excess // 2)

        return clip

    except Exception as e:
        print(f"⚠️  Clip prep failed ({clip_path}): {e} — using fallback")
        return ColorClip(size=(W, H), color=(10, 15, 25), duration=duration)


# ── Transitions ───────────────────────────────────────────────────────────────

def _apply_transition(clip: VideoFileClip, fade_duration: float = 0.3) -> VideoFileClip:
    """Apply a subtle fade-in/fade-out to each clip for smooth transitions."""
    return clip.fadein(fade_duration).fadeout(fade_duration)


# ── Main Assembler ────────────────────────────────────────────────────────────

def assemble_video(segments: list[dict], audio_path: str, video_id: str) -> str:
    """
    Assemble the final video from clips + audio using FFmpeg directly.
    Much faster than MoviePy — normalises each clip then concat + mux in one pass.

    Returns: Path to assembled video (no captions yet)
    """
    import tempfile
    print(f"\n🎞️  Assembling video from {len(segments)} segments...")

    output_path = config.VIDEOS_OUTPUT_DIR / f"{video_id}_raw.mp4"
    tmp_dir     = config.VIDEOS_OUTPUT_DIR / f"tmp_{video_id[:8]}"
    tmp_dir.mkdir(exist_ok=True)

    TARGET_W, TARGET_H, TARGET_FPS = 1920, 1080, 30

    # ── Step 1: Normalise clips in parallel using ThreadPoolExecutor ──────────
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def _normalise_clip(i, seg):
        clip_path = seg.get("clip_path")
        duration  = seg.get("duration", 8)
        label     = seg.get("visual_query", "clip")[:40]
        norm_path = str(tmp_dir / f"norm_{i:03d}.mp4")
        if clip_path and Path(clip_path).exists():
            result = subprocess.run([
                "ffmpeg", "-y",
                "-i", clip_path,
                "-t", str(duration),
                "-vf", f"scale={TARGET_W}:{TARGET_H}:force_original_aspect_ratio=decrease,"
                       f"pad={TARGET_W}:{TARGET_H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={TARGET_FPS}",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                "-threads", "0",   # let FFmpeg use all available CPU cores
                "-an",
                norm_path
            ], capture_output=True)
            if result.returncode != 0 or not Path(norm_path).exists():
                _make_black_clip(norm_path, duration, TARGET_W, TARGET_H, TARGET_FPS)
        else:
            _make_black_clip(norm_path, duration, TARGET_W, TARGET_H, TARGET_FPS)
        return (i, norm_path, label, duration)

    print(f"  ⚡ Normalising {len(segments)} clips in parallel...")
    results_map = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(_normalise_clip, i, seg): i for i, seg in enumerate(segments)}
        for fut in as_completed(futures):
            i, norm_path, label, duration = fut.result()
            results_map[i] = norm_path
            print(f"  [{i+1}/{len(segments)}] ✓ {label} ({duration:.1f}s)")

    normalised = [results_map[i] for i in range(len(segments))]

    # ── Step 2: Write concat list ────────────────────────────────────────────
    concat_list = tmp_dir / "concat.txt"
    concat_list.write_text("\n".join(f"file '{p}'" for p in normalised))

    # ── Step 3: Concat all clips (stream copy — instant) ────────────────────
    print("  🔗 Concatenating clips...")
    silent_path = str(tmp_dir / "silent.mp4")
    subprocess.run([
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
        "-c", "copy",
        silent_path
    ], capture_output=True, check=True)

    # ── Step 4: Mux with audio ───────────────────────────────────────────────
    print("  🎵 Muxing audio...")
    subprocess.run([
        "ffmpeg", "-y",
        "-i", silent_path,
        "-i", audio_path,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        str(output_path)
    ], capture_output=True, check=True)

    # ── Step 5: Cleanup temp dir ─────────────────────────────────────────────
    import shutil
    try:
        shutil.rmtree(tmp_dir)
    except Exception:
        pass

    file_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"✅ Video assembled: {output_path.name} ({file_size:.1f} MB)")
    return str(output_path)


def _make_black_clip(output_path: str, duration: float, w: int, h: int, fps: int):
    """Generate a plain black fallback clip."""
    subprocess.run([
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"color=c=black:s={w}x{h}:r={fps}",
        "-t", str(duration),
        "-c:v", "libx264", "-preset", "ultrafast",
        "-an", output_path
    ], capture_output=True)


def generate_thumbnail(video_path: str, video_id: str, time_offset: float = 3.0) -> str:
    """
    Extract a thumbnail from the video at the specified time.
    Uses FFmpeg to grab a frame.

    Returns: path to thumbnail JPEG
    """
    thumb_path = config.VIDEOS_OUTPUT_DIR / f"{video_id}_thumb.jpg"

    result = subprocess.run([
        "ffmpeg", "-y",
        "-ss", str(time_offset),
        "-i", video_path,
        "-vframes", "1",
        "-q:v", "2",
        "-vf", f"scale={config.VIDEO_RESOLUTION_W}:{config.VIDEO_RESOLUTION_H}:force_original_aspect_ratio=decrease,pad={config.VIDEO_RESOLUTION_W}:{config.VIDEO_RESOLUTION_H}:(ow-iw)/2:(oh-ih)/2",
        str(thumb_path),
    ], capture_output=True, text=True)

    if result.returncode == 0 and thumb_path.exists():
        print(f"📸 Thumbnail: {thumb_path.name}")
        return str(thumb_path)
    else:
        print(f"⚠️  Thumbnail failed: {result.stderr}")
        return None


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # This test requires actual clip files and audio
    print("Video assembler loaded. Run via orchestrator.py")
