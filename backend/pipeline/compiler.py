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


def create_compilation(
    compilation_id: str,
    clips: list[dict],   # [{video_id, file_path, start, end, title}]
    title: str,
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
    print(f"\n{'='*60}")
    print(f"[COMPILER] Starting | ID: {compilation_id[:8]}...")
    print(f"  Title:  {title}")
    print(f"  Clips:  {len(clips)}")
    print(f"{'='*60}\n")

    tmpdir = tempfile.mkdtemp(prefix="autovid_compile_")
    downloaded = []
    trimmed    = []

    try:
        # ── Step 1: Download all source clips ─────────────────────────────
        db.set_status(compilation_id, "generating")
        for i, clip in enumerate(clips):
            src  = str(config.VIDEOS_OUTPUT_DIR / f"compile_{compilation_id}_{i}_src.mp4")
            _download(clip["file_path"], src)
            downloaded.append(src)

            dur = _get_duration(src)
            start = float(clip.get("start") or 0)
            end   = clip.get("end")
            if end is not None:
                end = float(end)
                end = min(end, dur)   # clamp to actual duration
            start = max(0, min(start, dur - 1))

            print(f"   Clip {i+1}: '{clip.get('title','?')[:30]}' "
                  f"[{start:.1f}s → {end or dur:.1f}s] (dur: {dur:.1f}s)")

        # ── Step 2: Trim each clip ─────────────────────────────────────────
        db.update_video(compilation_id, status="voiced")   # reuse status for progress
        for i, (src, clip) in enumerate(zip(downloaded, clips)):
            start = float(clip.get("start") or 0)
            end   = clip.get("end")
            if end is not None:
                end = float(end)

            trimmed_path = str(config.VIDEOS_OUTPUT_DIR / f"compile_{compilation_id}_{i}_trim.mp4")

            if start == 0 and end is None:
                # No trim needed — use as-is
                trimmed.append(src)
            else:
                print(f"✂️  Trimming clip {i+1}...")
                _trim_clip(src, trimmed_path, start=start, end=end)
                trimmed.append(trimmed_path)

        # ── Step 3: Concatenate ────────────────────────────────────────────
        db.update_video(compilation_id, status="assembled")
        output_path = str(config.VIDEOS_OUTPUT_DIR / f"{compilation_id}_compilation.mp4")
        print(f"🔗 Concatenating {len(trimmed)} clips...")
        _concat_clips(trimmed, output_path)

        size_mb = Path(output_path).stat().st_size / (1024 * 1024)
        dur     = _get_duration(output_path)
        print(f"✅ Compilation ready: {size_mb:.1f}MB, {dur:.1f}s ({dur/60:.1f} min)")

        # ── Step 4: Upload to Supabase Storage ────────────────────────────
        db.update_video(compilation_id, status="captioned",
                        duration_seconds=int(dur))
        from pipeline.storage import upload_to_storage
        storage_url = upload_to_storage(output_path, compilation_id)
        db.update_video(compilation_id,
                        file_path=storage_url,
                        status="ready",
                        resolution="1920x1080")

        print(f"☁️  Uploaded: {storage_url}")
        return storage_url

    except Exception as e:
        db.set_status(compilation_id, "failed", error_message=str(e))
        print(f"❌ Compilation failed: {e}")
        raise

    finally:
        # Clean up temp files
        for f in downloaded + trimmed:
            try:
                if os.path.exists(f):
                    os.unlink(f)
            except Exception:
                pass