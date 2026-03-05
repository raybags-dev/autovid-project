"""
AutoVid — Script Studio Pipeline
Generates a video from a user-provided script (no AI script generation).

Pipeline:
  1. TTS — synthesize the user's script into voice audio
  2. Visual — generate a looping abstract animation for the full duration
  3. Music — generate background music track
  4. Mix — combine voice + music into final audio
  5. Assemble — lay the looping visual over the full audio duration
  6. Captions — burn captions from the narration
  7. Upload to Supabase Storage
"""
import sys
import subprocess
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import config
import database as db
import pipeline.tts as tts
from pipeline.visual_generator import generate_visual
from pipeline.music_mixer import generate_music, mix_audio

try:
    import pipeline.caption as captioner
except ModuleNotFoundError:
    import pipeline.caption as captioner


def _log(stage: str, msg: str, cb=None):
    full = f"[{stage}] {msg}"
    print(full)
    if cb:
        try: cb(stage, msg)
        except Exception: pass


def run_script_pipeline(
    video_id:    str,
    title:       str,
    script:      str,
    profile:     str = "educational",
    visual_style: str = "gradient_wave",
    music_style:  str = "ambient",
    cb=None,
):
    """
    Full script-first video generation pipeline.

    Args:
        video_id:     DB record ID (already created by caller)
        title:        Video title
        script:       Full narration text from user
        profile:      Content profile (affects caption style, not script)
        visual_style: One of the visual_generator styles
        music_style:  One of the music_mixer styles
        cb:           Optional callback(stage, message) for progress
    """
    print(f"\n{'='*60}")
    print(f"[SCRIPT PIPELINE] Starting | ID: {video_id[:8]}...")
    print(f"  Title:   {title}")
    print(f"  Words:   {len(script.split())}")
    print(f"  Visual:  {visual_style}")
    print(f"  Music:   {music_style}")
    print(f"{'='*60}\n")

    voice_path     = None
    mixed_path     = None
    visual_path    = None
    captioned_path = None

    try:
        # ── Step 1: TTS ───────────────────────────────────────────────────────
        _log("VOICE", f"Synthesizing {len(script)} chars of narration...", cb)
        db.set_status(video_id, "voiced")
        voice_result = tts.synthesize(script, video_id)
        voice_path   = voice_result["path"]
        duration     = voice_result["duration"]
        print(f"   Duration: {duration:.1f}s ({duration/60:.1f} min)")

        # ── Step 2: Looping visual ────────────────────────────────────────────
        _log("VISUAL", f"Generating {visual_style} loop ({duration:.0f}s)...", cb)
        db.set_status(video_id, "assembled")
        visual_path = generate_visual(visual_style, duration, video_id)

        # ── Step 3: Background music ──────────────────────────────────────────
        _log("MUSIC", f"Generating {music_style} background track...", cb)
        music_path = generate_music(music_style, duration, video_id)

        # ── Step 4: Mix audio ─────────────────────────────────────────────────
        _log("MIXING", "Mixing voice + music...", cb)
        mixed_path_str = str(config.AUDIO_OUTPUT_DIR / f"{video_id}_mixed.mp3")
        mixed_path = mix_audio(voice_path, music_path, mixed_path_str, music_volume=0.16)

        # ── Step 5: Combine visual + audio ───────────────────────────────────
        _log("ASSEMBLE", "Combining visual video with mixed audio...", cb)
        final_path = str(config.VIDEOS_OUTPUT_DIR / f"{video_id}_final.mp4")

        subprocess.run([
            "ffmpeg", "-y",
            "-i", visual_path,          # looping visual video (has no audio)
            "-i", mixed_path,           # mixed audio (voice + music)
            "-map", "0:v:0",            # video from visual
            "-map", "1:a:0",            # audio from mixed
            "-c:v", "copy",             # copy video stream (no re-encode)
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",                # end when shorter stream ends
            final_path,
        ], capture_output=True, check=True)

        size_mb = Path(final_path).stat().st_size / (1024 * 1024)
        print(f"✅ Assembled: {video_id[:8]}_final.mp4 ({size_mb:.1f}MB)")

        # ── Step 6: Thumbnail ─────────────────────────────────────────────────
        _log("THUMBNAIL", "Extracting thumbnail...", cb)
        thumb_path = str(config.VIDEOS_OUTPUT_DIR / f"{video_id}_thumb.jpg")
        subprocess.run([
            "ffmpeg", "-y",
            "-ss", "3",
            "-i", visual_path,
            "-vframes", "1",
            "-q:v", "2",
            thumb_path,
        ], capture_output=True)

        # ── Step 7: Burn captions ─────────────────────────────────────────────
        _log("CAPTIONS", "Transcribing and burning captions...", cb)
        try:
            captioned_path = captioner.add_captions(final_path, mixed_path, video_id)
            final_path     = captioned_path
        except Exception as e:
            print(f"⚠️  Captions failed (non-fatal): {e}")
            # Continue without captions

        # ── Step 8: Upload to Supabase Storage ───────────────────────────────
        _log("STORAGE", "Uploading to Supabase Storage...", cb)
        public_url = None
        try:
            from pipeline.storage import upload_to_storage
            public_url = upload_to_storage(final_path, video_id)
            print(f"✅ Storage URL: {public_url}")
        except Exception as e:
            print(f"⚠️  Storage upload failed: {e}")
            public_url = None

        # ── Save to DB ────────────────────────────────────────────────────────
        # Merge into one call to avoid partial updates
        db.update_video(video_id,
            file_path=public_url or final_path,
            status="ready",
            title=title,
            description=f"Script Studio video — {len(script.split())} words · {duration/60:.1f} min",
            duration_seconds=int(duration),
        )

        print(f"\n✅ Script pipeline complete: {video_id[:8]}")

        # ── Cleanup intermediates (safe — final video kept if no storage URL) ─
        cleanup_paths = [voice_path, mixed_path, visual_path]
        for path in cleanup_paths:
            if path and Path(path).exists():
                try:
                    Path(path).unlink()
                    print(f"🧹 Cleaned: {Path(path).name}")
                except Exception:
                    pass
        # Clean music mp3 and captioned intermediate only if storage succeeded
        if public_url:
            for extra in [
                config.AUDIO_OUTPUT_DIR / f"{video_id}_music.mp3",
                config.VIDEOS_OUTPUT_DIR / f"{video_id}_captioned.mp4",
            ]:
                if extra.exists() and str(extra) != final_path:
                    extra.unlink(missing_ok=True)
        else:
            print("⚠️  Storage upload failed — final video kept at:", final_path)

        return final_path

    except Exception as e:
        import traceback
        print(f"\n❌ Script pipeline FAILED: {e}")
        traceback.print_exc()
        db.set_failed(video_id, str(e))
        raise

    finally:
        # Safety net — clean only raw music scratch file
        try:
            raw = config.AUDIO_OUTPUT_DIR / f"{video_id}_music.raw"
            raw.unlink(missing_ok=True)
        except Exception:
            pass
        # Clean music raw file
        music_raw = config.AUDIO_OUTPUT_DIR / f"{video_id}_music.mp3"
        if music_raw.exists():
            music_raw.unlink(missing_ok=True)
        # Clean captioned intermediate
        cap_file = config.VIDEOS_OUTPUT_DIR / f"{video_id}_captioned.mp4"
        if cap_file.exists():
            cap_file.unlink(missing_ok=True)

