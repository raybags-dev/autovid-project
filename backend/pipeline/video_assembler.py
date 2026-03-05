

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

import PIL.Image
if not hasattr(PIL.Image, "ANTIALIAS"):
    PIL.Image.ANTIALIAS = PIL.Image.LANCZOS


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
    Assemble the final video from clips + audio.

    Args:
        segments: List of segments with clip_path and duration
        audio_path: Path to the synthesized audio MP3
        video_id: Used for output filename

    Returns:
        Path to the assembled video file (no captions yet)
    """
    print(f"\n🎞️  Assembling video from {len(segments)} segments...")

    output_path = config.VIDEOS_OUTPUT_DIR / f"{video_id}_raw.mp4"

    # ── Step 1: Prepare each video clip ──────────────────────────────────────
    clips = []
    for i, seg in enumerate(segments):
        duration = seg.get("duration", 8)
        clip_path = seg.get("clip_path")
        print(f"  [{i+1}/{len(segments)}] Segment ({duration:.1f}s): {seg.get('visual_query', 'fallback')[:40]}")

        clip = _prepare_clip(clip_path, duration)
        clip = _apply_transition(clip)
        clips.append(clip)

    # ── Step 2: Concatenate all clips ─────────────────────────────────────────
    print("  🔗 Concatenating clips...")
    final_video = concatenate_videoclips(clips, method="compose")

    # ── Step 3: Load and attach audio ─────────────────────────────────────────
    print("  🎵 Attaching audio track...")
    audio = AudioFileClip(audio_path)

    # Trim video/audio to match (whichever is shorter)
    min_duration = min(final_video.duration, audio.duration)
    final_video = final_video.subclip(0, min_duration)
    audio = audio.subclip(0, min_duration)

    # Optional: normalize audio volume
    audio = audio.fx(afx.audio_normalize)
    final_video = final_video.set_audio(audio)

    # ── Step 4: Export ────────────────────────────────────────────────────────
    print(f"  💾 Exporting to {output_path.name}...")
    final_video.write_videofile(
        str(output_path),
        fps=config.VIDEO_FPS,
        codec="libx264",
        audio_codec="aac",
        bitrate=config.VIDEO_BITRATE,
        audio_bitrate=config.AUDIO_BITRATE,
        threads=4,
        preset="fast",       # "ultrafast" for speed, "slow" for quality
        verbose=False,
        logger=None,
    )

    # Cleanup clips
    for clip in clips:
        clip.close()
    final_video.close()
    audio.close()

    file_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"✅ Video assembled: {output_path.name} ({file_size:.1f} MB)")
    return str(output_path)


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


if __name__ == "__main__":
    print("Video assembler loaded. Run via orchestrator.py")
