
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
from pipeline.storage import upload_to_storage
from pipeline import script_gen, tts, video_fetcher, video_assembler, youtube_uploader
try:
    import pipeline.caption as captioner       # caption.py
except ModuleNotFoundError:
    import pipeline.caption as captioner     # captioner.py fallback


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


def step_burn_captions(raw_video_path: str, audio_path: str, video_id: str, cb=None) -> str:
    _log("CAPTIONS", "Transcribing audio + burning captions...", cb)
    captioned_path = captioner.add_captions(raw_video_path, audio_path, video_id)
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


# ── Cleanup ───────────────────────────────────────────────────────────────────

def cleanup(video_id: str, audio_path: str, captioned_path: str):
    """
    Delete all intermediate files. Keep only:
      - [id]_final.mp4    → the finished video
      - [id]_thumb.jpg    → thumbnail

    Deleted:
      - output/temp/[id]/     → downloaded stock clips
      - output/audio/[id].mp3 → synthesized audio (merged into final)
      - output/videos/[id]_raw.mp4        → pre-caption video
      - output/videos/[id]_captioned.mp4  → pre-merge video
    """
    # 1. Temp clips folder
    temp_dir = config.TEMP_DIR / video_id
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
        print(f"🗑️  Deleted temp clips: {temp_dir.name}/")

    # 2. Audio MP3 (already merged into final)
    audio_file = Path(audio_path)
    if audio_file.exists():
        audio_file.unlink()
        print(f"🗑️  Deleted audio: {audio_file.name}")

    # 3. Captioned intermediate (before audio merge)
    captioned_file = Path(captioned_path)
    if captioned_file.exists():
        captioned_file.unlink()
        print(f"🗑️  Deleted intermediate: {captioned_file.name}")

    # Note: _raw.mp4 is deleted inside captioner.py after captions are burned
    print(f"✅ Cleanup complete — only final video + thumbnail kept")


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

def run_pipeline(
    prompt: str,
    profile: str = 'funny',
    auto_upload: bool = True,
    visual_mood: str = None,
    progress_callback: Optional[Callable] = None,
    video_id: str = None,   # pre-created DB record ID (optional)
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

        # ── 4. Align ──────────────────────────────────────────────────────────
        segments = step_align_segments(script_data, audio_result, cb)

        # ── 5. Fetch clips ────────────────────────────────────────────────────
        _mood = visual_mood or video_fetcher.get_mood_for_topic(prompt)
        segments = step_fetch_clips(segments, video_id, mood=_mood, cb=cb)

        # ── 6. Assemble raw video ─────────────────────────────────────────────
        raw_video_path = step_assemble_video(segments, audio_result, video_id, cb)

        # ── 7. Thumbnail ──────────────────────────────────────────────────────
        thumb_path = step_generate_thumbnail(raw_video_path, video_id, cb)

        # ── 8. Burn captions ──────────────────────────────────────────────────
        captioned_path = step_burn_captions(raw_video_path, audio_path, video_id, cb)

        # ── 9. Merge audio into final video ───────────────────────────────────
        # This is the definitive final file — captions + guaranteed audio
        final_path = step_merge_audio(captioned_path, audio_path, video_id, cb)

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

        # ── 12. Cleanup intermediate files ────────────────────────────────────
        cleanup(video_id, audio_path, captioned_path)

        elapsed = time.time() - start_time
        _log("DONE", f"✅ Pipeline complete in {elapsed:.0f}s", cb)
        _log("DONE", f"📁 Final video: {final_path}", cb)

        return db.get_video(video_id)

    except Exception as e:
        error_msg = str(e)
        trace     = traceback.format_exc()
        print(f"\n❌ Pipeline FAILED: {error_msg}")
        print(trace)
        if video_id:
            db.set_failed(video_id, f"{error_msg}\n\n{trace[-300:]}")
        raise


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

