"""
AutoVid — Compilation Pipeline
Combines multiple existing videos into one longer video.
- Downloads source videos from Supabase URLs
- Applies basic trim (start/end time per clip)
- Concatenates losslessly with FFmpeg
- Uploads result to Supabase Storage
"""
import os
import subprocess
import tempfile
import urllib.request
from pathlib import Path
from typing import List, Optional

import config
import database as db


def _download(url: str, dest: str):
    """Download a remote URL to a local path."""
    if url.startswith("http"):
        print(f"⬇️  Downloading {url[-40:]}...")
        urllib.request.urlretrieve(url, dest)
    else:
        # Already a local path
        import shutil
        shutil.copy(url, dest)


def _get_duration(path: str) -> float:
    """Get video duration in seconds via ffprobe."""
    r = subprocess.run([
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        path
    ], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def _trim_clip(input_path: str, output_path: str,
               start: float = 0.0, end: Optional[float] = None):
    """
    Trim a clip to [start, end] seconds.
    Uses stream copy (no re-encode) for speed and quality.
    If end is None, trims from start to video end.
    """
    cmd = ["ffmpeg", "-y", "-i", input_path]
    if start > 0:
        cmd += ["-ss", str(start)]
    if end is not None:
        duration = end - start
        cmd += ["-t", str(duration)]
    cmd += [
        "-c", "copy",          # lossless stream copy
        "-avoid_negative_ts", "make_zero",
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        # Re-encode fallback if stream copy fails (e.g. seek issues)
        print(f"   Stream copy failed, re-encoding clip...")
        cmd2 = ["ffmpeg", "-y", "-i", input_path]
        if start > 0:
            cmd2 = ["ffmpeg", "-y", "-ss", str(start), "-i", input_path]
        if end is not None:
            cmd2 += ["-t", str(end - start)]
        cmd2 += [
            "-c:v", "libx264", "-crf", "18", "-preset", "fast",
            "-c:a", "aac", "-b:a", "192k",
            output_path
        ]
        subprocess.run(cmd2, capture_output=True, check=True)


def _concat_clips(clip_paths: list[str], output_path: str):
    """Concatenate clips using FFmpeg concat demuxer (lossless if same codec)."""
    # Write concat list file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt",
                                     delete=False) as f:
        for p in clip_paths:
            f.write(f"file '{p}'\n")
        list_file = f.name

    try:
        result = subprocess.run([
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", list_file,
            "-c", "copy",
            output_path
        ], capture_output=True, text=True)

        if result.returncode != 0:
            # Re-encode if codecs differ between clips
            print("   Concat with copy failed, re-encoding for compatibility...")
            subprocess.run([
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", list_file,
                "-c:v", "libx264", "-crf", "18", "-preset", "fast",
                "-c:a", "aac", "-b:a", "192k",
                "-movflags", "+faststart",
                output_path
            ], capture_output=True, check=True)
    finally:
        os.unlink(list_file)


def _log(step: str, msg: str, cb=None):
    print(f"[{step}] {msg}")
    if cb:
        cb({"step": step, "message": msg})


def create_compilation(
    compilation_id: str,
    clips: list[dict],   # [{video_id, file_path, start, end, title}]
    title: str,
    cb=None,
) -> str:
    """
    Main compilation entry point.

    clips: list of dicts with:
        - video_id:  source video ID
        - file_path: Supabase URL or local path
        - start:     trim start in seconds (default 0)
        - end:       trim end in seconds (default None = full clip)
        - title:     clip title for logging

    Returns path to final compiled video.
    """
    _log("START", f"Video compilation | ID: {compilation_id[:8]}... | {len(clips)} clips", cb)

    tmpdir = tempfile.mkdtemp(prefix="autovid_compile_")
    downloaded = []
    trimmed    = []

    try:
        # ── Step 1: Download all source clips ─────────────────────────────
        db.set_status(compilation_id, "generating")
        db.update_video(compilation_id, labels=["compilation", "video"])
        for i, clip in enumerate(clips):
            fp = clip.get("file_path", "")
            is_remote = fp.startswith("http://") or fp.startswith("https://")
            if not fp or (not is_remote and not os.path.exists(fp)):
                raise ValueError(
                    f"Clip {i+1} '{(clip.get('title') or '')[:30]}': video file not found — "
                    f"it may have been cleaned up after processing. "
                    f"Only videos with cloud storage URLs can be used in compilations."
                )
            _log("DOWNLOAD", f"Downloading clip {i+1}/{len(clips)}: {clip.get('title','?')[:30]}", cb)
            src  = str(config.VIDEOS_OUTPUT_DIR / f"compile_{compilation_id}_{i}_src.mp4")
            _download(fp, src)
            downloaded.append(src)

            dur = _get_duration(src)
            start = float(clip.get("start") or 0)
            end   = clip.get("end")
            if end is not None:
                end = float(end)
                end = min(end, dur)
            start = max(0, min(start, dur - 1))
            _log("DOWNLOAD", f"✅ Clip {i+1} ready [{start:.1f}s → {end or dur:.1f}s] ({dur:.1f}s total)", cb)

        # ── Step 2: Trim each clip ─────────────────────────────────────────
        db.update_video(compilation_id, status="voiced")
        for i, (src, clip) in enumerate(zip(downloaded, clips)):
            start = float(clip.get("start") or 0)
            end   = clip.get("end")
            if end is not None:
                end = float(end)

            trimmed_path = str(config.VIDEOS_OUTPUT_DIR / f"compile_{compilation_id}_{i}_trim.mp4")

            if start == 0 and end is None:
                trimmed.append(src)
            else:
                _log("TRIM", f"✂️ Trimming clip {i+1}...", cb)
                _trim_clip(src, trimmed_path, start=start, end=end)
                trimmed.append(trimmed_path)

        # ── Step 3: Concatenate ────────────────────────────────────────────
        db.update_video(compilation_id, status="assembled")
        output_path = str(config.VIDEOS_OUTPUT_DIR / f"{compilation_id}_compilation.mp4")
        _log("CONCAT", f"🔗 Concatenating {len(trimmed)} video clips...", cb)
        _concat_clips(trimmed, output_path)

        size_mb = Path(output_path).stat().st_size / (1024 * 1024)
        dur     = _get_duration(output_path)
        _log("CONCAT", f"✅ Video compilation ready: {size_mb:.1f}MB, {dur:.1f}s", cb)

        # ── Step 4: Upload to Supabase Storage ────────────────────────────
        db.update_video(compilation_id, status="captioned", duration_seconds=int(dur))
        _log("UPLOAD", "☁️ Uploading MP4 to Supabase Storage...", cb)
        from pipeline.storage import upload_to_storage
        storage_url = upload_to_storage(output_path, compilation_id)
        db.update_video(compilation_id,
                        file_path=storage_url,
                        status="ready",
                        resolution="1920x1080")

        _log("DONE", f"✅ Video compilation ready! {storage_url[-40:]}", cb)
        return storage_url

    except Exception as e:
        db.set_status(compilation_id, "failed", error_message=str(e))
        _log("ERROR", f"❌ Compilation failed: {e}", cb)
        raise

    finally:
        # Clean up temp files
        for f in downloaded + trimmed:
            try:
                if os.path.exists(f):
                    os.unlink(f)
            except Exception:
                pass


def _extract_audio(video_path: str, output_mp3: str):
    """
    Extract audio track from a video file as MP3.
    Downloads first if video_path is a remote URL.
    """
    local_path = video_path
    tmp_download = None

    if video_path.startswith("http://") or video_path.startswith("https://"):
        print(f"⬇️  Downloading video for audio extraction...")
        import tempfile as _tf
        tmp_download = _tf.mktemp(suffix=".mp4")
        _download(video_path, tmp_download)
        local_path = tmp_download

    try:
        result = subprocess.run([
            "ffmpeg", "-y",
            "-i", local_path,
            "-vn",              # no video stream
            "-acodec", "libmp3lame",
            "-b:a", "192k",
            "-ar", "44100",
            output_mp3,
        ], capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Audio extraction failed: {result.stderr[-400:]}")
        print(f"   ✅ Audio extracted → {Path(output_mp3).name}")
    finally:
        if tmp_download and os.path.exists(tmp_download):
            os.unlink(tmp_download)


def _concat_audio_files(audio_files: list, output_path: str):
    """Concatenate multiple MP3 files into a single MP3."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        for p in audio_files:
            f.write(f"file '{p}'\n")
        list_file = f.name

    try:
        result = subprocess.run([
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", list_file,
            "-acodec", "libmp3lame",
            "-b:a", "192k",
            "-ar", "44100",
            output_path,
        ], capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Audio concat failed: {result.stderr[-400:]}")
    finally:
        os.unlink(list_file)


def create_mp3_compilation(
    compilation_id: str,
    clips: list,   # [{video_id, file_path, narration_url, title, ...}]
    title: str,
    cb=None,
) -> str:
    """
    Concatenate narration MP3 tracks from multiple videos into a single podcast-style MP3.
    If a clip has no narration_url, automatically extracts audio from its video file.
    Returns the Supabase URL of the combined MP3.
    """
    _log("START", f"MP3 podcast compilation | ID: {compilation_id[:8]}... | {len(clips)} clips", cb)

    tmpdir = tempfile.mkdtemp(prefix="autovid_mp3_")
    audio_files = []

    try:
        db.set_status(compilation_id, "generating")
        # Tag explicitly as mp3 compilation so frontend detection is unambiguous
        db.update_video(compilation_id, labels=["compilation", "mp3"])

        for i, clip in enumerate(clips):
            narration_url = clip.get("narration_url")
            file_path     = clip.get("file_path", "")
            clip_title    = (clip.get("title") or f"Clip {i+1}")[:30]

            dest = os.path.join(tmpdir, f"audio_{i:03d}.mp3")

            if narration_url:
                _log("AUDIO", f"Clip {i+1}/{len(clips)} '{clip_title}': downloading saved narration MP3...", cb)
                _download(narration_url, dest)
                audio_files.append(dest)
                _log("AUDIO", f"✅ Clip {i+1} audio ready", cb)
            elif file_path:
                is_remote = file_path.startswith("http://") or file_path.startswith("https://")
                if not is_remote and not os.path.exists(file_path):
                    _log("AUDIO", f"⚠️ Clip {i+1} '{clip_title}': local file no longer exists — skipping", cb)
                    continue
                _log("AUDIO", f"Clip {i+1}/{len(clips)} '{clip_title}': extracting audio from video...", cb)
                _extract_audio(file_path, dest)
                audio_files.append(dest)
                _log("AUDIO", f"✅ Clip {i+1} audio extracted", cb)
            else:
                _log("AUDIO", f"⚠️ Clip {i+1} '{clip_title}': no audio source, skipping", cb)

        if not audio_files:
            raise ValueError("No audio sources found — all clips were skipped")

        # Concatenate
        db.update_video(compilation_id, status="voiced")
        output_mp3 = os.path.join(tmpdir, f"{compilation_id}_podcast.mp3")
        _log("CONCAT", f"🔗 Concatenating {len(audio_files)} audio tracks into MP3...", cb)
        _concat_audio_files(audio_files, output_mp3)

        size_mb = Path(output_mp3).stat().st_size / (1024 * 1024)
        _log("CONCAT", f"✅ MP3 ready: {size_mb:.1f}MB", cb)

        # Upload to Supabase narrations bucket
        db.update_video(compilation_id, status="assembled")
        _log("UPLOAD", "☁️ Uploading MP3 to Supabase Storage (narrations bucket)...", cb)
        from pipeline.storage import upload_narration_to_storage
        narration_url_out = upload_narration_to_storage(output_mp3, compilation_id)

        # Store in BOTH narration_url and file_path — file_path ends in _narration.mp3
        db.update_video(compilation_id,
                        narration_url=narration_url_out,
                        file_path=narration_url_out,
                        status="ready")

        _log("DONE", f"✅ MP3 podcast ready! Download via Spotify button.", cb)
        return narration_url_out

    except Exception as e:
        db.set_status(compilation_id, "failed", error_message=str(e))
        _log("ERROR", f"❌ MP3 compilation failed: {e}", cb)
        raise

    finally:
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)