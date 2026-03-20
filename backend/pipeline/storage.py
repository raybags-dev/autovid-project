"""
AutoVid — Supabase Storage
Uploads final videos to Supabase Storage bucket for permanent public playback.

Setup (one-time in Supabase dashboard):
  1. Storage → New bucket → name: "videos" → Public: ON → Save
  2. That's it. The SUPABASE_SERVICE_KEY in .env handles auth.
"""
import os
from pathlib import Path
import config

BUCKET = "videos"


SUPABASE_MAX_MB = 4800  # Pro tier: 5 GB max file size — compress only if truly oversized


def _compress_video(input_path: Path, output_path: Path, target_mb: int = 40) -> Path:
    """
    Compress video to fit within target_mb using ffmpeg CRF encoding.
    Returns path to compressed file (may be input_path if already small enough).
    """
    import subprocess
    size_mb = input_path.stat().st_size / (1024 * 1024)
    if size_mb <= target_mb:
        return input_path  # already small enough

    print(f"📦 Compressing {size_mb:.1f}MB → target {target_mb}MB...")

    # Calculate bitrate to hit target size
    # Get duration via ffprobe
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(input_path)
    ], capture_output=True, text=True)
    duration = float(result.stdout.strip() or "300")

    # target_mb * 8 bits/byte * 1024 kbits/mbit / duration = kbps total
    total_kbps = int((target_mb * 8 * 1024) / duration)
    video_kbps = max(200, total_kbps - 128)  # reserve 128k for audio

    subprocess.run([
        "ffmpeg", "-y",
        "-i", str(input_path),
        "-c:v", "libx264",
        "-b:v", f"{video_kbps}k",
        "-c:a", "aac", "-b:a", "128k",
        "-preset", "fast",
        "-movflags", "+faststart",
        str(output_path),
    ], capture_output=True, check=True)

    new_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"   ✅ Compressed: {size_mb:.1f}MB → {new_mb:.1f}MB")
    return output_path


def _stream_upload(url: str, file_path: Path, content_type: str, headers: dict) -> None:
    """
    Upload a file to a URL using chunked streaming via requests.
    Avoids loading the entire file into memory — critical for large videos.
    Raises on non-2xx status.
    """
    import requests

    with open(file_path, "rb") as f:
        resp = requests.post(
            url,
            data=f,
            headers={**headers, "Content-Type": content_type},
            timeout=(30, 600),  # 30s connect, 10min transfer
        )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Storage upload failed {resp.status_code}: {resp.text[:300]}")


def upload_to_storage(local_path: str, video_id: str, cb=None) -> str:
    """
    Upload a local video file to Supabase Storage bucket.
    Uses chunked streaming (no full-file read into RAM) for speed.
    Returns the permanent public URL for playback.
    """
    if not config.SUPABASE_SERVICE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_KEY not set in .env")

    local_path = Path(local_path)
    if not local_path.exists():
        raise FileNotFoundError(f"Video file not found: {local_path}")

    # Compress only if truly oversized (Pro tier limit)
    size_mb = local_path.stat().st_size / (1024 * 1024)
    upload_path = local_path
    compressed_tmp = None

    if size_mb > SUPABASE_MAX_MB:
        compressed_tmp = local_path.parent / f"{video_id}_upload_compressed.mp4"
        upload_path = _compress_video(local_path, compressed_tmp, target_mb=40)

    filename = f"{video_id}_final.mp4"
    final_mb = upload_path.stat().st_size / (1024 * 1024)
    print(f"☁️  Uploading to Supabase Storage: {filename} ({final_mb:.1f} MB)")

    base = config.SUPABASE_URL.rstrip("/")
    upload_url = f"{base}/storage/v1/object/{BUCKET}/{filename}"
    auth_headers = {
        "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}",
        "x-upsert": "true",
    }

    # Delete old version first (idempotent)
    try:
        import requests as _r
        _r.delete(
            f"{base}/storage/v1/object/{BUCKET}",
            json={"prefixes": [filename]},
            headers=auth_headers,
            timeout=10,
        )
    except Exception:
        pass

    # Stream upload — no full read into memory
    _stream_upload(upload_url, upload_path, "video/mp4", auth_headers)

    # Clean up temp compressed file
    if compressed_tmp and compressed_tmp.exists():
        compressed_tmp.unlink(missing_ok=True)

    public_url = f"{base}/storage/v1/object/public/{BUCKET}/{filename}"
    print(f"   ✅ Stored at: {public_url}")
    return public_url


CLIP_BUCKET = "stickfigures"


def upload_clip_to_storage(local_path: str, filename: str) -> str:
    """
    Upload a stick-figure clip to Supabase Storage (stickfigures bucket, public).
    Creates the bucket if it doesn't exist.
    Returns the permanent public URL.
    """
    import requests as _r
    from supabase import create_client
    import config as _cfg

    local_path = Path(local_path)
    if not local_path.exists():
        raise FileNotFoundError(f"Clip not found: {local_path}")

    base = _cfg.SUPABASE_URL.rstrip("/")
    auth_headers = {
        "Authorization": f"Bearer {_cfg.SUPABASE_SERVICE_KEY}",
        "x-upsert": "true",
    }

    # Ensure bucket exists (silently ignore if already exists)
    try:
        sb = create_client(_cfg.SUPABASE_URL, _cfg.SUPABASE_SERVICE_KEY)
        sb.storage.create_bucket(CLIP_BUCKET, options={"public": True})
    except Exception:
        pass

    size_mb = local_path.stat().st_size / (1024 * 1024)
    print(f"☁️  Uploading clip: {filename} ({size_mb:.1f} MB)")
    upload_url = f"{base}/storage/v1/object/{CLIP_BUCKET}/{filename}"
    _stream_upload(upload_url, local_path, "video/mp4", auth_headers)

    public_url = f"{base}/storage/v1/object/public/{CLIP_BUCKET}/{filename}"
    print(f"   ✅ Clip stored: {public_url}")
    return public_url


def upload_narration_to_storage(audio_path: str, video_id: str, cb=None, filename: str = None) -> str:
    """
    Upload the raw narration MP3 to Supabase Storage (narrations bucket).
    Returns the permanent public URL, or raises on failure.
    Create bucket 'narrations' in Supabase → Public: ON before using.
    """
    NARRATION_BUCKET = "narrations"

    if not config.SUPABASE_SERVICE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_KEY not set in .env")

    audio_path = Path(audio_path)

    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    filename = filename or f"{video_id}_narration.mp3"
    size_mb  = audio_path.stat().st_size / (1024 * 1024)
    print(f"🎙  Uploading narration to Supabase: {filename} ({size_mb:.1f} MB)")

    base = config.SUPABASE_URL.rstrip("/")
    upload_url = f"{base}/storage/v1/object/{NARRATION_BUCKET}/{filename}"
    auth_headers = {
        "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}",
        "x-upsert": "true",
    }

    _stream_upload(upload_url, audio_path, "audio/mpeg", auth_headers)

    public_url = f"{base}/storage/v1/object/public/{NARRATION_BUCKET}/{filename}"
    print(f"   ✅ Narration stored: {public_url}")
    return public_url