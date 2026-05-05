"""
AutoVid — Subscribe Message Clip Injector

Fetches the appropriate subscribe clip from Supabase Storage and injects it
into a completed MP4 at the most natural audio boundary near the video midpoint.

Boundary selection (within ±5s of midpoint):
  1. Silence (≥200ms low amplitude)
  2. Exact midpoint fallback

The clip is injected as-is with no audio processing.

SQL to create assets table (run once in Supabase SQL editor):
    CREATE TABLE IF NOT EXISTS subscribe_message_assets (
        id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        type text NOT NULL CHECK (type IN ('subscribed', 'unsubscribed')),
        file_path text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO subscribe_message_assets (type, file_path)
    VALUES ('unsubscribed', 'Unsubscribed.mp4'),
           ('subscribed',   'Subscribed.mp4')
    ON CONFLICT DO NOTHING;
"""
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

import config

SUBSCRIBE_BUCKET       = "subscribe_messages"
SUBSCRIBE_TABLE        = "subscribe_message_assets"
BOUNDARY_SEARCH_RADIUS = 5.0   # seconds either side of midpoint
SILENCE_NOISE_DB       = -40
SILENCE_MIN_DUR        = 0.2   # seconds
MIN_DURATION           = 10.0  # skip injection if video is shorter than this


def _get_duration(path: str) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True,
    )
    return float(r.stdout.strip() or "0")


def _get_video_dimensions(path: str) -> tuple[int, int]:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height",
         "-of", "default=noprint_wrappers=1", path],
        capture_output=True, text=True,
    )
    w, h = 1920, 1080
    for line in r.stdout.splitlines():
        if line.startswith("width="):
            try: w = int(line.split("=")[1])
            except ValueError: pass
        elif line.startswith("height="):
            try: h = int(line.split("=")[1])
            except ValueError: pass
    return w, h


def _get_fps(path: str) -> str:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=r_frame_rate",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True,
    )
    fps = r.stdout.strip() or "30/1"
    # Evaluate fraction e.g. "30000/1001" → "29.97"
    try:
        num, den = fps.split("/")
        return str(round(int(num) / int(den), 3))
    except Exception:
        return "30"


def _find_silence_boundary(video_path: str, midpoint: float) -> Optional[float]:
    """Return timestamp (s) of silence end nearest to midpoint, or None."""
    start  = max(0.0, midpoint - BOUNDARY_SEARCH_RADIUS)
    window = BOUNDARY_SEARCH_RADIUS * 2

    r = subprocess.run(
        [
            "ffmpeg", "-y",
            "-ss", str(start), "-t", str(window),
            "-i", video_path,
            "-af", f"silencedetect=noise={SILENCE_NOISE_DB}dB:d={SILENCE_MIN_DUR}",
            "-f", "null", "-",
        ],
        capture_output=True, text=True,
    )
    candidates = []
    for m in re.finditer(r"silence_end:\s*([0-9.]+)", r.stderr):
        t = float(m.group(1)) + start
        if abs(t - midpoint) <= BOUNDARY_SEARCH_RADIUS:
            candidates.append((abs(t - midpoint), t))

    if not candidates:
        return None
    candidates.sort()
    return candidates[0][1]


def _query_asset_path(subscribe_type: str) -> str:
    """Return the file_path from subscribe_message_assets for the given type."""
    import database as db

    res = (
        db.get_client()
        .table(SUBSCRIBE_TABLE)
        .select("file_path")
        .eq("type", subscribe_type)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise ValueError(
            f"No subscribe asset found for type='{subscribe_type}' in {SUBSCRIBE_TABLE}. "
            "Run the setup SQL to insert records."
        )
    return res.data[0]["file_path"]


def _download_clip(file_path: str, dest_dir: str) -> str:
    """Download a clip from subscribe_messages bucket, return local path."""
    import requests

    base    = config.SUPABASE_URL.rstrip("/")
    key     = config.SUPABASE_SERVICE_KEY
    url     = f"{base}/storage/v1/object/{SUBSCRIBE_BUCKET}/{file_path}"
    headers = {"Authorization": f"Bearer {key}"}

    r = requests.get(url, headers=headers, timeout=(15, 180))
    if r.status_code != 200:
        raise FileNotFoundError(
            f"Subscribe clip not found in Supabase Storage (bucket='{SUBSCRIBE_BUCKET}', "
            f"path='{file_path}', HTTP {r.status_code})"
        )

    dest = os.path.join(dest_dir, os.path.basename(file_path))
    with open(dest, "wb") as f:
        f.write(r.content)
    return dest


def ensure_table_exists():
    """Create subscribe_message_assets table and seed default records if missing."""
    import database as db

    client = db.get_client()
    try:
        client.rpc(
            "exec_sql",
            {
                "query": """
                    CREATE TABLE IF NOT EXISTS subscribe_message_assets (
                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                        type text NOT NULL CHECK (type IN ('subscribed','unsubscribed')),
                        file_path text NOT NULL,
                        created_at timestamptz NOT NULL DEFAULT now()
                    );
                """
            },
        ).execute()
    except Exception:
        pass


def inject_subscribe_clip(
    main_video: str,
    subscribe_type: str,
    video_id: str,
    cb=None,
) -> str:
    """
    Inject the subscribe message clip into main_video near the midpoint.

    Args:
        main_video:     Path to the fully assembled MP4.
        subscribe_type: 'subscribed' or 'unsubscribed'
        video_id:       Used for naming temp/output files.
        cb:             Optional progress callback(dict).

    Returns:
        Path to the final MP4 with the subscribe clip injected.
    """
    def _log(msg: str):
        print(f"[SUBSCRIBE] {msg}")
        if cb:
            try: cb({"step": "SUBSCRIBE", "message": msg})
            except Exception: pass

    if subscribe_type not in ("subscribed", "unsubscribed"):
        raise ValueError(f"subscribe_type must be 'subscribed' or 'unsubscribed', got {subscribe_type!r}")

    total_dur = _get_duration(main_video)
    if total_dur < MIN_DURATION:
        _log(f"⚠️ Video too short ({total_dur:.1f}s) — skipping subscribe injection")
        return main_video

    midpoint = total_dur / 2.0
    _log(f"Duration {total_dur:.1f}s → midpoint {midpoint:.1f}s")

    # ── 1. Resolve and download clip ──────────────────────────────────────────
    file_path = _query_asset_path(subscribe_type)
    _log(f"Asset: {file_path}")

    tmpdir = tempfile.mkdtemp(prefix=f"sub_{video_id[:8]}_")
    try:
        sub_clip = _download_clip(file_path, tmpdir)
        _log(f"✅ Downloaded: {os.path.basename(sub_clip)}")

        # ── 2. Find natural cut point ─────────────────────────────────────────
        boundary = _find_silence_boundary(main_video, midpoint)
        cut_point = boundary if boundary is not None else midpoint
        _log(
            f"{'Silence boundary' if boundary else 'Midpoint fallback'} at {cut_point:.2f}s"
            + (f" (Δ={abs(cut_point-midpoint):.2f}s)" if boundary else "")
        )

        # ── 3. Split main video at cut_point (no audio filters) ───────────────
        part1 = os.path.join(tmpdir, "part1.mp4")
        part2 = os.path.join(tmpdir, "part2.mp4")

        _log("Splitting video...")
        subprocess.run([
            "ffmpeg", "-y", "-i", main_video,
            "-t", str(cut_point),
            "-c:v", "libx264", "-preset", "fast", "-crf", "22",
            "-c:a", "aac", "-b:a", "192k",
            part1,
        ], capture_output=True, check=True)

        subprocess.run([
            "ffmpeg", "-y", "-i", main_video,
            "-ss", str(cut_point),
            "-c:v", "libx264", "-preset", "fast", "-crf", "22",
            "-c:a", "aac", "-b:a", "192k",
            part2,
        ], capture_output=True, check=True)

        # ── 4. Scale subscribe clip to match main video resolution ────────────
        # No audio filters — codec conversion only for container compatibility
        w, h     = _get_video_dimensions(main_video)
        fps      = _get_fps(main_video)
        sub_prep = os.path.join(tmpdir, "sub_prep.mp4")

        subprocess.run([
            "ffmpeg", "-y", "-i", sub_clip,
            "-vf", (
                f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
                f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,"
                f"fps={fps}"
            ),
            "-c:v", "libx264", "-preset", "fast", "-crf", "22",
            "-c:a", "aac", "-b:a", "192k",
            sub_prep,
        ], capture_output=True, check=True)

        # ── 5. Concatenate using filter_complex for proper AV sync ────────────
        out_path = str(config.VIDEOS_OUTPUT_DIR / f"{video_id}_sub_injected.mp4")
        _log("Concatenating parts...")
        subprocess.run([
            "ffmpeg", "-y",
            "-i", part1, "-i", sub_prep, "-i", part2,
            "-filter_complex",
            "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[vout][aout]",
            "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", "fast", "-crf", "22",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart",
            out_path,
        ], capture_output=True, check=True)

        final_dur = _get_duration(out_path)
        _log(f"✅ Inject complete — final duration: {final_dur:.1f}s")
        return out_path

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
