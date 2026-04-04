"""
AutoVid Pipeline — Master Orchestrator

Pipeline order:
  1.  Create DB record
  2.  Generate script (Groq)
  3.  Synthesize voice (ElevenLabs) → saves audio/[id].mp3
  4.  Align segments to audio timing
  5.  Fetch stock video clips (Pexels/Pixabay)
  6.  Assemble raw video (MoviePy) — clips + audio merged → videos/[id]_raw.mp4
  7.  Generate thumbnail from raw video
  8.  Burn captions (Whisper + FFmpeg) → videos/[id]_captioned.mp4
  9.  Merge audio into captioned video (guarantees sound) → videos/[id]_final.mp4
  10. Auto-label (Groq)
  11. Upload to YouTube (optional)
  12. Auto-cleanup all temp/intermediate files

Cleanup policy:
  - Temp clips:     always deleted after assembly
  - Raw video:      deleted after captions burned
  - Audio MP3:      deleted after merged into final video
  - Final video:    KEPT (needed for YouTube upload + playback)
  - Thumbnail:      KEPT
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import os
import time
import subprocess
import traceback
import shutil
from typing import Callable, Optional

import config
import database as db
from pipeline.storage import upload_to_storage, upload_narration_to_storage
from pipeline import script_gen, tts, video_fetcher, video_assembler, youtube_uploader
try:
    import pipeline.caption as captioner       # caption.py
except ModuleNotFoundError:
    import pipeline.caption as captioner     # captioner.py fallback


# Moods that use generated animations instead of Pexels stock footage
GENERATED_VISUAL_MOODS = {
    "fluid_red", "fluid_blue", "fluid_black",
    "aurora_blue", "aurora_dark",
    "gradient_wave", "starfield", "geometric_pulse",
    "colour_wash", "particle_field",
    "neon_purple", "cosmic_dust", "ember_glow",
    "rain",   # ← rain animation; also the mandatory background for stickfigure mode
}


# ── Logger ────────────────────────────────────────────────────────────────────

def _log(step: str, message: str, cb: Optional[Callable] = None):
    print(f"[{step}] {message}")
    if cb:
        cb({"step": step, "message": message})


# ── Pipeline Steps ────────────────────────────────────────────────────────────

def step_generate_script(prompt: str, video_id: str, profile: str = 'funny', cb=None) -> dict:
    _log("SCRIPT", f"Generating script for: '{prompt}'", cb)
    script_data = script_gen.generate_script(prompt, profile=profile)
    db.set_script(
        video_id,
        title=script_data["title"],
        description=script_data["description"],
        script=script_data["full_narration"],
    )
    return script_data


def step_synthesize_voice(script_data: dict, video_id: str, cb=None) -> dict:
    _log("VOICE", "Synthesizing audio...", cb)
    audio_result = tts.synthesize(script_data["full_narration"], video_id)
    db.set_audio_ready(video_id, duration_seconds=int(audio_result["duration"]))
    return audio_result


def step_align_segments(script_data: dict, audio_result: dict, cb=None) -> list:
    _log("ALIGN", "Aligning script segments to audio timing...", cb)
    return tts.align_segments_to_audio(script_data, audio_result["path"])


def step_fetch_clips(segments: list, video_id: str, mood: str = None, cb=None) -> list:
    _log("CLIPS", f"Fetching {len(segments)} stock video clips...", cb)
    if mood:
        segments = video_fetcher.enrich_segments_with_mood(segments, mood)
        _log("CLIPS", f"Visual mood: {mood}", cb)
    return video_fetcher.fetch_all_clips(segments, video_id)


def step_assemble_video(segments: list, audio_result: dict, video_id: str, cb=None) -> str:
    _log("ASSEMBLE", "Assembling video from clips + audio...", cb)
    raw_path = video_assembler.assemble_video(segments, audio_result["path"], video_id)
    db.set_video_assembled(video_id, raw_path, resolution="1920x1080")
    return raw_path


def step_generate_thumbnail(raw_video_path: str, video_id: str, cb=None) -> Optional[str]:
    _log("THUMBNAIL", "Extracting thumbnail...", cb)
    thumb_path = video_assembler.generate_thumbnail(raw_video_path, video_id, time_offset=3.0)
    if thumb_path:
        db.update_video(video_id, thumbnail_url=thumb_path)
    return thumb_path


def step_burn_captions(raw_video_path: str, audio_path: str, video_id: str, cb=None, is_short: bool = False) -> str:
    _log("CAPTIONS", "Transcribing audio + burning captions...", cb)
    captioned_path = captioner.add_captions(raw_video_path, audio_path, video_id, is_short=is_short)
    db.set_captioned(video_id)
    return captioned_path


def step_merge_audio(captioned_path: str, audio_path: str, video_id: str, cb=None) -> str:
    """
    Final merge: take the captioned video + original audio and combine them.
    This guarantees audio is present in the final output regardless of
    what happened during the caption burning step.

    Input:  [id]_captioned.mp4  +  [id].mp3
    Output: [id]_final.mp4
    """
    _log("MERGE", "Merging audio into final video...", cb)

    final_path = config.VIDEOS_OUTPUT_DIR / f"{video_id}_final.mp4"

    cmd = [
        "ffmpeg", "-y",
        "-i", captioned_path,       # video with burned captions
        "-i", audio_path,           # original clean audio
        "-map", "0:v:0",            # video stream from captioned file
        "-map", "1:a:0",            # audio stream from original MP3
        "-c:v", "copy",             # no re-encode video (fast)
        "-af", "dynaudnorm=p=0.95:m=5:s=15",  # keeps narration level consistent throughout
        "-c:a", "aac",              # encode audio as AAC
        "-b:a", config.AUDIO_BITRATE,
        "-shortest",                # trim to shortest stream
        str(final_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Audio merge failed:\n{result.stderr[-500:]}")

    size_mb = os.path.getsize(final_path) / (1024 * 1024)
    _log("MERGE", f"✅ Final video: {final_path.name} ({size_mb:.1f} MB)", cb)

    # Update DB with final file path
    db.update_video(video_id, file_path=str(final_path))

    return str(final_path)


def step_auto_label(script_data: dict, video_id: str, cb=None) -> dict:
    _log("LABEL", "Auto-generating labels and category...", cb)
    label_data = script_gen.generate_labels(
        title=script_data["title"],
        description=script_data["description"],
        script=script_data["full_narration"],
    )
    db.set_labels(video_id, label_data["labels"], label_data["category"])
    return label_data


def step_upload_youtube(
    final_path: str, script_data: dict, label_data: dict,
    thumb_path: Optional[str], video_id: str, cb=None
) -> dict:
    _log("YOUTUBE", "Uploading to YouTube...", cb)
    db.set_status(video_id, "uploading")

    result = youtube_uploader.upload_video(
        video_path=final_path,
        title=script_data["title"],
        description=script_data["description"],
        labels=label_data.get("labels", []) + label_data.get("youtube_tags", []),
        category=label_data.get("category", "Entertainment"),
        thumbnail_path=thumb_path,
        privacy="public",
    )
    youtube_uploader.record_upload()
    db.set_posted(video_id, result["youtube_id"], result["youtube_url"])
    return result


def step_save_mixed_mp3(final_path: str, video_id: str, cb=None) -> Optional[str]:
    """
    Extract the fully-mixed audio (narration + background music) from the final
    video file and upload it to Supabase as a permanent MP3.
    Overwrites narration_url with this richer version.
    Non-fatal — failure is logged but does not abort the pipeline.
    """
    mixed_mp3 = config.AUDIO_OUTPUT_DIR / f"{video_id}_mixed.mp3"
    _log("MP3", "Extracting mixed audio from final video...", cb)

    cmd = [
        "ffmpeg", "-y",
        "-i", str(final_path),
        "-vn",                  # drop video stream
        "-acodec", "libmp3lame",
        "-q:a", "2",            # high-quality VBR (~190 kbps)
        str(mixed_mp3),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not mixed_mp3.exists():
        _log("MP3", f"⚠️  Mixed MP3 extraction failed: {result.stderr[-200:]}", cb)
        return None

    size_mb = mixed_mp3.stat().st_size / (1024 * 1024)
    _log("MP3", f"✅ Mixed MP3: {mixed_mp3.name} ({size_mb:.1f} MB)", cb)

    try:
        url = upload_narration_to_storage(
            str(mixed_mp3), video_id, cb,
            filename=f"{video_id}_mixed.mp3",
        )
        db.update_video(video_id, narration_url=url)
        _log("MP3", "✅ Mixed MP3 saved to cloud", cb)
        return url
    except Exception as e:
        _log("MP3", f"⚠️  Mixed MP3 upload failed: {e}", cb)
        return None
    finally:
        mixed_mp3.unlink(missing_ok=True)


# ── Cleanup ───────────────────────────────────────────────────────────────────

def cleanup(video_id: str, audio_path=None, captioned_path=None, delete_final: bool = True):
    """
    Delete ALL local files for a video. Supabase Storage is the source of truth.
    Safe to call with None args and after failures — skips gracefully.
    """
    deleted = []

    def _rm(path):
        try:
            p = Path(path)
            if p.exists():
                p.unlink(missing_ok=True)
                deleted.append(p.name)
        except Exception as e:
            print(f"⚠️  Could not delete {path}: {e}")

    def _rmdir(path):
        try:
            p = Path(path)
            if p.exists() and p.is_dir():
                shutil.rmtree(p)
                deleted.append(p.name + "/")
        except Exception as e:
            print(f"⚠️  Could not delete dir {path}: {e}")

    # Temp clip dirs
    _rmdir(config.TEMP_DIR / video_id)
    for d in config.VIDEOS_OUTPUT_DIR.glob(f"tmp_{video_id[:8]}*"):
        _rmdir(d)

    # All audio variants (narration, mixed, music)
    for suffix in [".mp3", "_mixed.mp3", "_music.mp3", "_bg_music.mp3", "_narration.mp3"]:
        _rm(config.AUDIO_OUTPUT_DIR / f"{video_id}{suffix}")
    if audio_path:
        _rm(audio_path)

    # Intermediate videos
    for suffix in ["_raw.mp4", "_captioned.mp4", "_musixed.mp4"]:
        _rm(config.VIDEOS_OUTPUT_DIR / f"{video_id}{suffix}")
    if captioned_path:
        _rm(captioned_path)

    # Final + thumbnail — always delete (Supabase is the permanent store)
    if delete_final:
        _rm(config.VIDEOS_OUTPUT_DIR / f"{video_id}_final.mp4")
        _rm(config.VIDEOS_OUTPUT_DIR / f"{video_id}_thumb.jpg")

    if deleted:
        print(f"🗑️  Cleanup {video_id[:8]}: removed {len(deleted)} file(s)")
    else:
        print(f"✅ Cleanup {video_id[:8]}: nothing to remove")


def start_output_sweeper():
    """
    Background thread: every 30 min delete output files older than 1 hour.
    Safety net so disk never fills even if a pipeline crashes before cleanup.
    """
    import threading

    def _sweep():
        while True:
            time.sleep(1800)
            try:
                cutoff = time.time() - 3600  # 1-hour TTL
                swept = 0
                for folder in [config.VIDEOS_OUTPUT_DIR, config.AUDIO_OUTPUT_DIR, config.TEMP_DIR]:
                    if not folder.exists():
                        continue
                    for item in folder.rglob("*"):
                        try:
                            if item.is_file() and item.stat().st_mtime < cutoff:
                                item.unlink(missing_ok=True)
                                swept += 1
                            elif item.is_dir() and item != folder:
                                item.rmdir()   # only removes if empty
                        except Exception:
                            pass
                if swept:
                    print(f"🧹 Sweeper: removed {swept} stale output file(s)")
            except Exception as e:
                print(f"⚠️  Sweeper error: {e}")

    threading.Thread(target=_sweep, daemon=True, name="output-sweeper").start()
    print("🧹 Output sweeper started (1-hr TTL, runs every 30 min)")


def cleanup_output_folder():
    """
    Clean ALL generated files from /output (useful for dev reset).
    Keeps the folder structure, deletes all files inside.
    Run manually: python pipeline/orchestrator.py --cleanup
    """
    count = 0
    for folder in [config.VIDEOS_OUTPUT_DIR, config.AUDIO_OUTPUT_DIR, config.TEMP_DIR]:
        if folder.exists():
            for f in folder.rglob("*"):
                if f.is_file():
                    f.unlink()
                    count += 1
            # Remove empty subdirectories
            for d in sorted(folder.rglob("*"), reverse=True):
                if d.is_dir():
                    try:
                        d.rmdir()
                    except OSError:
                        pass
    print(f"🗑️  Cleaned /output — deleted {count} files")


# ── Main Pipeline ─────────────────────────────────────────────────────────────

def _step_stickfigure_composite(video_path: str, script_text: str, duration: float, video_id: str, cb=None) -> str:
    """
    Auto-match stick-figure clips to the script and composite them onto the video.
    Returns composited path, or original path if no clips matched / on error.
    """
    try:
        from pipeline.stickfigure_matcher import match_clips_to_script
        from pipeline.stickfigure_compositor import composite_video
        _log("STICKFIGURES", "🕹 Matching stickfigure clips to script...", cb)
        overlays = match_clips_to_script(script_text, duration)
        if not overlays:
            _log("STICKFIGURES", "⚠️ No stickfigure clips matched — using background only", cb)
            return video_path
        _log("STICKFIGURES", f"🕹 Compositing {len(overlays)} stickfigure clip(s)...", cb)
        out_path = str(Path(config.VIDEOS_OUTPUT_DIR) / f"{video_id}_sf.mp4")
        result   = composite_video(video_path, overlays, out_path)
        _log("STICKFIGURES", f"✅ {len(overlays)} stickfigure(s) composited", cb)
        return result
    except Exception as e:
        _log("STICKFIGURES", f"⚠️ Stickfigure composite skipped: {e}", cb)
        return video_path


def run_pipeline(
    prompt: str,
    profile: str = 'educational',
    auto_upload: bool = True,
    visual_mood: str = None,
    music_style: str = 'ambient',
    music_volume: float = 0.06,
    music_delay: float = 0.0,
    progress_callback: Optional[Callable] = None,
    video_id: str = None,   # pre-created DB record ID (optional)
    use_stickfigures: bool = False,
    use_stock_footage: bool = True,
) -> dict:
    """
    Run the full AutoVid pipeline from prompt → final video → YouTube.

    Args:
        prompt:            The video idea from the user
        auto_upload:       Upload to YouTube when done (default True)
        progress_callback: Optional fn called at each step with progress info

    Returns:
        Final video record dict from the database
    """
    cb         = progress_callback
    start_time = time.time()
    # NOTE: do NOT reset video_id here — caller may pass a pre-created one
    audio_path     = None
    captioned_path = None

    try:
        # ── 1. Create DB record (or use pre-created ID from API) ────────────
        if not video_id:
            record   = db.create_video(prompt)
            video_id = record["id"]
        _log("START", f"Pipeline started | ID: {video_id[:8]}...", cb)

        # ── 2. Script ─────────────────────────────────────────────────────────
        script_data = step_generate_script(prompt, video_id, profile=profile, cb=cb)

        # ── 3. Voice ──────────────────────────────────────────────────────────
        audio_result = step_synthesize_voice(script_data, video_id, cb)
        audio_path   = audio_result["path"]

        # ── 3a. Upload narration MP3 to Supabase Storage ──────────────────────
        try:
            narration_url = upload_narration_to_storage(audio_path, video_id, cb)
            db.update_video(video_id, narration_url=narration_url)
            _log("VOICE", f"✅ Narration MP3 saved to cloud", cb)
        except Exception as e:
            _log("VOICE", f"⚠️  Narration upload skipped: {e}", cb)

        # ── 4. Align ──────────────────────────────────────────────────────────
        segments = step_align_segments(script_data, audio_result, cb)

        # ── 5 & 6. Fetch clips OR generate animation ──────────────────────────
        # Stickfigure mode forces the rain procedural background
        if use_stickfigures:
            _mood = "rain"
        elif not use_stock_footage:
            _mood = "aurora_dark"  # CSS-only animated background, no Pexels fetch
        else:
            _mood = visual_mood or video_fetcher.get_mood_for_topic(prompt)

        if _mood in GENERATED_VISUAL_MOODS:
            from pipeline.visual_generator import generate_visual
            _log("VISUALS", f"Generating {_mood} animation ({audio_result['duration']:.0f}s)...", cb)
            raw_video_path = generate_visual(_mood, audio_result["duration"], video_id)
            db.set_video_assembled(video_id, raw_video_path, resolution="1920x1080")
        else:
            segments = step_fetch_clips(segments, video_id, mood=_mood, cb=cb)
            raw_video_path = step_assemble_video(segments, audio_result, video_id, cb)

        # ── 6b. Stickfigure overlay (only when requested) ─────────────────────
        if use_stickfigures:
            script_text = script_data.get("full_narration", prompt)
            raw_video_path = _step_stickfigure_composite(
                raw_video_path, script_text, audio_result["duration"], video_id, cb
            )
            db.set_video_assembled(video_id, raw_video_path, resolution="1920x1080")

        # ── 7. Thumbnail ──────────────────────────────────────────────────────
        thumb_path = step_generate_thumbnail(raw_video_path, video_id, cb)

        # ── 8. Burn captions ──────────────────────────────────────────────────
        captioned_path = step_burn_captions(raw_video_path, audio_path, video_id, cb)

        # ── 9. Merge audio into final video ───────────────────────────────────
        # This is the definitive final file — captions + guaranteed audio
        final_path = step_merge_audio(captioned_path, audio_path, video_id, cb)

        # ── 9a. Mix background music ──────────────────────────────────────────
        if music_style and music_style != 'none':
            try:
                from pipeline.music_mixer import mix_background_music
                _log("MUSIC", f"Mixing background music ({music_style}) @ {int(music_volume*100)}%...", cb)
                mixed = mix_background_music(final_path, music_style, video_id, music_volume=music_volume, music_delay=music_delay)
                if mixed and mixed != final_path:
                    final_path = mixed
                    _log("MUSIC", "✅ Background music mixed", cb)
            except Exception as e:
                _log("MUSIC", f"⚠️  Music mixing skipped: {e}", cb)

        # ── 9a-ii. Save mixed MP3 (narration + music) to Supabase ────────────
        try:
            step_save_mixed_mp3(final_path, video_id, cb)
        except Exception as e:
            _log("MP3", f"⚠️  Mixed MP3 step failed (non-fatal): {e}", cb)

        # ── 9b. Upload final video to Supabase Storage ────────────────────────
        # This gives us a permanent public URL for playback in the dashboard
        # even after local files are cleaned up
        try:
            storage_url = upload_to_storage(final_path, video_id, cb)
            if storage_url:
                db.update_video(video_id, file_path=storage_url)
                _log("STORAGE", f"✅ Uploaded to Supabase Storage", cb)
        except Exception as e:
            _log("STORAGE", f"⚠️  Storage upload failed (non-fatal): {e}", cb)
            # Keep local path in DB as fallback

        # ── 10. Auto-label ────────────────────────────────────────────────────
        label_data = step_auto_label(script_data, video_id, cb)

        # ── 11. Upload to YouTube ─────────────────────────────────────────────
        if auto_upload:
            step_upload_youtube(final_path, script_data, label_data, thumb_path, video_id, cb)
        else:
            db.set_ready(video_id)
            _log("READY", "Video ready — skipping YouTube upload (auto_upload=False)", cb)

        # ── 12. Auto-generate companion short in production ───────────────────
        if os.getenv("APP_ENV") == "production":
            try:
                _log("SHORT", "🎬 Production mode — spawning companion short...", cb)
                import threading
                def _spawn_short():
                    try:
                        run_short_pipeline(
                            prompt=prompt,
                            ambience="stars",
                            auto_upload_youtube=True,
                        )
                    except Exception as se:
                        print(f"⚠️  Companion short failed (non-fatal): {se}")
                threading.Thread(target=_spawn_short, daemon=True).start()
            except Exception as se:
                _log("SHORT", f"⚠️ Could not spawn companion short: {se}", cb)

        elapsed = time.time() - start_time
        _log("DONE", f"✅ Pipeline complete in {elapsed:.0f}s", cb)
        return db.get_video(video_id)

    except Exception as e:
        error_msg = str(e)
        trace     = traceback.format_exc()
        print(f"\n❌ Pipeline FAILED: {error_msg}")
        print(trace)
        if video_id:
            db.set_failed(video_id, f"{error_msg}\n\n{trace[-300:]}")
        raise

    finally:
        # Always clean up local files — runs on success AND failure
        if video_id:
            try:
                cleanup(video_id, audio_path, captioned_path, delete_final=True)
            except Exception as ce:
                print(f"⚠️  Post-pipeline cleanup error: {ce}")


# ── Retry Failed ──────────────────────────────────────────────────────────────

def retry_failed(video_id: str, cb=None) -> dict:
    """Retry a failed video from scratch using its original prompt."""
    video = db.get_video(video_id)
    if not video:
        raise ValueError(f"Video {video_id} not found")
    if video["status"] != "failed":
        raise ValueError(f"Video {video_id} status is '{video['status']}', not 'failed'")
    db.update_video(video_id, status="generating", error_message=None)
    return run_pipeline(video["prompt"], auto_upload=True, progress_callback=cb)


SHORT_MAX_DURATION = 90  # seconds — YouTube Shorts limit


def run_short_pipeline(prompt: str, ambience: str = "rain", video_id: str = None, cb=None, auto_upload_youtube: bool = False, music_style: str = "Laidback_Fevorite", music_volume: float = 0.04, music_delay: float = 0.0, angle: str = None, custom_script: str = None, use_stickfigures: bool = False, use_stock_footage: bool = True) -> dict:
    """
    YouTube Shorts pipeline — portrait 9:16, TTS narration, enforced 90s max.
    auto_upload_youtube=True posts directly to YouTube (used in prod companion short).
    custom_script: optional pre-written narration text — skips LLM script generation.
    """
    from pipeline.shorts_generator import generate_short_visual
    from pipeline.script_gen import generate_short_script

    start_time = time.time()
    audio_path     = None
    captioned_path = None

    try:
        # 1. Create DB record tagged as short
        if not video_id:
            record = db.create_video(f"[Short] {prompt}")
            video_id = record["id"]
        db.update_video(video_id, labels=["short", "Shorts", "AI"], status="generating")
        _log("START", f"Short pipeline | ID: {video_id[:8]}...", cb)

        # 2. Script — either LLM-generated or custom
        if custom_script and custom_script.strip():
            _log("SCRIPT", "Using custom script (bypassing LLM generation)...", cb)
            words = custom_script.strip().split()
            estimated_duration = max(30, int((len(words) / 150) * 60))
            narration = custom_script.strip() + "  . . ."
            script_data = {
                "title": f"[Short] {prompt[:80]}",
                "description": prompt,
                "full_narration": narration,
                "estimated_duration": estimated_duration,
                "is_short": True,
                "suggested_labels": ["Shorts", "AI"],
                "category": "Education",
            }
            db.set_script(video_id, title=script_data["title"], description=script_data["description"], script=narration)
            _log("SCRIPT", f"✅ Custom script ready — {len(words)} words (~{estimated_duration}s)", cb)
        else:
            _log("SCRIPT", f"Generating short script for: '{prompt}'" + (f" [{angle[:30]}...]" if angle else ""), cb)
            script_data = generate_short_script(prompt, angle=angle)
            db.set_script(
                video_id,
                title=script_data["title"],
                description=script_data["description"],
                script=script_data["full_narration"],
            )
            _log("SCRIPT", f"✅ Script ready — {len(script_data['full_narration'].split())} words (~{script_data['estimated_duration']}s)", cb)

        # 3. Voice
        _log("VOICE", "Synthesizing audio narration...", cb)
        audio_result = tts.synthesize(script_data["full_narration"], video_id)
        audio_path   = audio_result["path"]
        duration     = audio_result["duration"]
        db.set_audio_ready(video_id, duration_seconds=int(duration))
        _log("VOICE", f"✅ Audio ready: {duration:.1f}s", cb)

        # 3a. Enforce 90-second limit — speed up audio if needed
        if duration > SHORT_MAX_DURATION:
            _log("VOICE", f"⚡ Fitting audio to {SHORT_MAX_DURATION}s (was {duration:.1f}s)...", cb)
            duration = tts.fit_audio_to_duration(audio_path, float(SHORT_MAX_DURATION))
            db.update_video(video_id, duration_seconds=int(duration))
            _log("VOICE", f"✅ Audio fitted to {duration:.1f}s", cb)

        # 3b. Upload narration MP3
        try:
            narration_url = upload_narration_to_storage(audio_path, video_id, cb)
            db.update_video(video_id, narration_url=narration_url)
            _log("VOICE", "✅ Narration MP3 saved to cloud", cb)
        except Exception as e:
            _log("VOICE", f"⚠️ Narration upload skipped: {e}", cb)

        # 4. Generate portrait 9:16 visual — capped at SHORT_MAX_DURATION + 2s buffer
        if use_stickfigures:
            _ambience = "rain"
        elif not use_stock_footage:
            _ambience = "aurora_dark"
        else:
            _ambience = ambience
        visual_duration = min(int(duration) + 2, SHORT_MAX_DURATION + 2)
        _log("VISUALS", f"Generating portrait visual: {_ambience} ({visual_duration}s)...", cb)
        visual_path = generate_short_visual(duration=visual_duration, ambience=_ambience)
        db.set_video_assembled(video_id, visual_path, resolution="1080x1920")

        # 4b. Stickfigure overlay (only when requested)
        if use_stickfigures:
            script_text = script_data.get("full_narration", prompt)
            visual_path = _step_stickfigure_composite(
                visual_path, script_text, duration, video_id, cb
            )
            db.set_video_assembled(video_id, visual_path, resolution="1080x1920")

        # 5. Thumbnail
        thumb_path = step_generate_thumbnail(visual_path, video_id, cb)

        # 6. Burn captions
        captioned_path = step_burn_captions(visual_path, audio_path, video_id, cb, is_short=True)

        # 7. Merge audio
        final_path = step_merge_audio(captioned_path, audio_path, video_id, cb)

        # 7a. Mix background music
        if music_style and music_style != 'none':
            try:
                from pipeline.music_mixer import mix_background_music
                _log("MUSIC", f"Mixing background music ({music_style}) @ {int(music_volume*100)}%...", cb)
                mixed = mix_background_music(final_path, music_style, video_id, music_volume=music_volume, music_delay=music_delay)
                if mixed and mixed != final_path:
                    final_path = mixed
                    _log("MUSIC", "✅ Background music mixed", cb)
            except Exception as e:
                _log("MUSIC", f"⚠️  Music mixing skipped: {e}", cb)

        # 7a-ii. Save mixed MP3 (narration + music) to Supabase
        try:
            step_save_mixed_mp3(final_path, video_id, cb)
        except Exception as e:
            _log("MP3", f"⚠️  Mixed MP3 step failed (non-fatal): {e}", cb)

        # 8. Upload to Supabase
        try:
            storage_url = upload_to_storage(final_path, video_id, cb)
            if storage_url:
                db.update_video(video_id, file_path=storage_url)
                _log("STORAGE", "✅ Short uploaded to Supabase Storage", cb)
        except Exception as e:
            _log("STORAGE", f"⚠️ Storage upload failed: {e}", cb)

        # 9. Auto-label
        step_auto_label(script_data, video_id, cb)

        # 10. Upload to YouTube or set ready
        if auto_upload_youtube:
            _log("YOUTUBE", "Uploading companion short to YouTube...", cb)
            label_data = db.get_video(video_id)
            step_upload_youtube(final_path, script_data, label_data, thumb_path, video_id, cb)
        else:
            db.set_ready(video_id)
            _log("READY", "⚡ Short is ready — review in Shorts tab before uploading.", cb)

        elapsed = time.time() - start_time
        _log("DONE", f"✅ Short pipeline complete in {elapsed:.0f}s", cb)
        return db.get_video(video_id)

    except Exception as e:
        error_msg = str(e)
        trace     = traceback.format_exc()
        print(f"\n❌ Short pipeline FAILED: {error_msg}")
        print(trace)
        if video_id:
            db.set_failed(video_id, f"{error_msg}\n\n{trace[-300:]}")
        raise

    finally:
        if video_id:
            try:
                cleanup(video_id, audio_path, captioned_path, delete_final=True)
            except Exception as ce:
                print(f"⚠️  Short cleanup error: {ce}")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--cleanup":
        # python pipeline/orchestrator.py --cleanup
        print("🗑️  Cleaning entire /output folder...")
        cleanup_output_folder()
    else:
        prompt = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else \
            "A penguin tries stand-up comedy at a corporate event"

        print(f"🎬 AutoVid Pipeline Test")
        print(f"   Prompt: '{prompt}'\n")

        result = run_pipeline(prompt, auto_upload=False)
        print(f"\n📦 Final record:")
        for k, v in result.items():
            if v:
                print(f"   {k}: {str(v)[:80]}")