"""
AutoVid — Background Music Mixer
Uses custom MP3 tracks from backend/custom_bg_music/ instead of synthesis.
Loops/trims tracks to the required duration via FFmpeg.

Music styles: none, ambient, wilderness, studio, meditation, lofi
"""
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
import config

# ── Custom music library ───────────────────────────────────────────────────────
# Maps style key → filename inside backend/custom_bg_music/
_MUSIC_DIR = Path(__file__).parent.parent / "custom_bg_music"

MUSIC_STYLES = {
    "none":                    None,
    "Birds_Atmosphere_Piano":  "Birds_Atmosphere_Piano.mp3",
    "Birds_Atmosphere_Wing":   "Birds_Atmosphere_Wing.mp3",
    "Laidback_Fevorite":       "Laidback_Fevorite.mp3",
    "Pads_EPiano":             "Pads_EPiano.mp3",
    "Pads":                    "Pads.mp3",
    "swingPiano":              "swingPiano.mp3",
    "suspenseful_bell":        "suspenseful_bell.mp3",
    "suspenseful_piano":       "suspenseful_piano.mp3",
    "suspenseful_slow":        "suspenseful_slow.mp3",
    # legacy keys kept for backwards-compatibility
    "ambient":    "Birds_Atmosphere_Piano.mp3",
    "wilderness": "Birds_Atmosphere_Wing.mp3",
    "studio":     "Laidback_Fevorite.mp3",
    "meditation": "Pads_EPiano.mp3",
    "lofi":       "Pads.mp3",
}

# Default fallback when an unknown style is requested
_DEFAULT_STYLE = "Birds_Atmosphere_Piano"


# ── Public API ────────────────────────────────────────────────────────────────

def generate_music(style: str, duration: float, video_id: str,
                   music_delay: float = 0.0) -> str | None:
    """
    Prepare a background music track of the given duration.
    Loops / trims the source MP3 file with FFmpeg.
    music_delay: extra seconds added so the looped track covers the pre-delay offset.
    Returns path to the prepared MP3, or None if style is 'none' or file missing.
    """
    if style == "none":
        return None

    filename = MUSIC_STYLES.get(style) or MUSIC_STYLES.get(_DEFAULT_STYLE)
    if not filename:
        return None

    src = _MUSIC_DIR / filename
    if not src.exists():
        print(f"⚠️  Music file not found: {src} — skipping background music")
        return None

    out_path = config.AUDIO_OUTPUT_DIR / f"{video_id}_music.mp3"
    target_dur = duration + 2.0 + music_delay  # slight tail + pre-delay offset

    print(f"🎵  Preparing {style} music ({target_dur:.0f}s) from {filename}...")

    try:
        result = subprocess.run([
            "ffmpeg", "-y",
            "-stream_loop", "-1",          # loop input indefinitely
            "-i", str(src),
            "-t", str(target_dur),         # trim to required duration
            "-af", "afade=t=out:st={:.1f}:d=3".format(max(0, target_dur - 3)),
            "-q:a", "4",
            str(out_path),
        ], capture_output=True, timeout=120)

        if result.returncode != 0:
            print(f"⚠️  FFmpeg music error: {result.stderr.decode()[-300:]}")
            return None

    except subprocess.TimeoutExpired:
        print("⚠️  Music FFmpeg timed out — skipping music")
        return None
    except Exception as e:
        print(f"⚠️  Music FFmpeg exception: {e}")
        return None

    if out_path.exists() and out_path.stat().st_size > 0:
        print(f"✅  Music ready: {out_path.name}")
        return str(out_path)

    print("⚠️  Music preparation failed — continuing without background music")
    return None


def apply_narration_delay(voice_path: str, delay_s: float, output_path: str) -> str:
    """
    Prepend silence to a narration audio file so the spoken content starts at delay_s.
    Video + ambience + music begin at t=0; narration begins at t=delay_s.
    Returns output_path.
    """
    delay_ms = int(delay_s * 1000)
    print(f"⏱  Delaying narration by {delay_s:.1f}s ({delay_ms}ms)...")
    subprocess.run([
        "ffmpeg", "-y", "-i", voice_path,
        "-af", f"adelay={delay_ms}:all=1",
        "-q:a", "3", output_path,
    ], capture_output=True, check=True)
    return output_path


def mix_audio(voice_path: str, music_path: str | None, output_path: str,
              music_volume: float = 0.10, music_delay: float = 0.0) -> str:
    """
    Mix narration voice with background music.
    music_volume: 0.0–1.0 relative to voice (0.10 = music at 10% of voice level)
    music_delay:  unused — narration delay is applied upstream via apply_narration_delay().
    Returns output_path.
    """
    if not music_path:
        shutil.copy2(voice_path, output_path)
        return output_path

    print(f"🎚  Mixing voice + music (music @ {int(music_volume * 100)}%)...")

    music_filter = f"[1:a]volume={music_volume}[music]"

    subprocess.run([
        "ffmpeg", "-y",
        "-i", voice_path,
        "-i", music_path,
        "-filter_complex",
        f"{music_filter};[0:a][music]amix=inputs=2:duration=first:normalize=0[out]",
        "-map", "[out]",
        "-q:a", "3",
        output_path,
    ], capture_output=True, check=True)

    print(f"✅  Mixed audio: {Path(output_path).name}")
    return output_path


def mix_background_music(video_path: str, style: str, video_id: str,
                          music_volume: float = 0.08,
                          music_delay: float = 0.0) -> str:
    """
    High-level helper: prepare background music and mix it into a video file.
    music_delay: unused — narration delay is applied upstream via apply_narration_delay().
    Returns path to the output video. Falls back to original on any error.
    """
    out_path = Path(video_path)
    if not out_path.exists():
        return video_path

    # Get video duration
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", video_path],
            capture_output=True, text=True, check=True,
        )
        duration = float(result.stdout.strip()) + 2.0
    except Exception as e:
        print(f"⚠️  Could not get video duration: {e}")
        return video_path

    music_path = generate_music(style, duration, f"{video_id}_bg", music_delay=music_delay)
    if not music_path:
        return video_path

    bg_filter = f"[1:a]volume={music_volume}[bg]"

    tmp = str(out_path).replace(".mp4", "_musixed.mp4")
    try:
        subprocess.run([
            "ffmpeg", "-y",
            "-i", video_path,
            "-i", music_path,
            "-filter_complex",
            f"{bg_filter};[0:a][bg]amix=inputs=2:duration=first:normalize=0[aout]",
            "-map", "0:v",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            tmp,
        ], capture_output=True, check=True)

        shutil.move(tmp, video_path)
        print(f"✅  Background music ({style}) mixed into video")
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Music mix FFmpeg error: {e.stderr.decode()[:200]}")
        Path(tmp).unlink(missing_ok=True)
    finally:
        Path(music_path).unlink(missing_ok=True)

    return video_path
