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


def upload_to_storage(local_path: str, video_id: str, cb=None) -> str:
    """
    Upload a local video file to Supabase Storage bucket.
    Automatically compresses if file exceeds Supabase free tier limit (50MB).
    Returns the permanent public URL for playback.
    Raises on failure so caller can log and continue.
    """
    import subprocess
    import tempfile
    from supabase import create_client

    # Use the service key — anon key doesn't have storage write access
    if not config.SUPABASE_SERVICE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_KEY not set in .env")

    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)

    local_path = Path(local_path)
    if not local_path.exists():
        raise FileNotFoundError(f"Video file not found: {local_path}")

    # Compress if needed
    size_mb = local_path.stat().st_size / (1024 * 1024)
    upload_path = local_path
    compressed_tmp = None

    if size_mb > SUPABASE_MAX_MB:
        compressed_tmp = local_path.parent / f"{video_id}_upload_compressed.mp4"
        upload_path = _compress_video(local_path, compressed_tmp, target_mb=40)

    filename   = f"{video_id}_final.mp4"
    file_bytes = upload_path.read_bytes()
    final_mb   = len(file_bytes) / (1024 * 1024)

    print(f"☁️  Uploading to Supabase Storage: {filename} ({final_mb:.1f} MB)")

    # Remove old version if it exists (idempotent re-runs)
    try:
        client.storage.from_(BUCKET).remove([filename])
    except Exception:
        pass

    # Upload the file
    client.storage.from_(BUCKET).upload(
        path=filename,
        file=file_bytes,
        file_options={"content-type": "video/mp4", "upsert": "true"},
    )

    # Clean up temp compressed file
    if compressed_tmp and compressed_tmp.exists():
        compressed_tmp.unlink(missing_ok=True)

    # Build public URL
    base = config.SUPABASE_URL.rstrip("/")
    public_url = f"{base}/storage/v1/object/public/{BUCKET}/{filename}"

    print(f"   ✅ Stored at: {public_url}")
    return public_url


def upload_narration_to_storage(audio_path: str, video_id: str, cb=None) -> str:
    """
    Upload the raw narration MP3 to Supabase Storage (narrations bucket).
    Returns the permanent public URL, or raises on failure.
    Create bucket 'narrations' in Supabase → Public: ON before using.
    """
    from supabase import create_client

    NARRATION_BUCKET = "narrations"

    if not config.SUPABASE_SERVICE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_KEY not set in .env")

    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    audio_path = Path(audio_path)

    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    filename   = f"{video_id}_narration.mp3"
    file_bytes = audio_path.read_bytes()
    size_mb    = len(file_bytes) / (1024 * 1024)
    print(f"🎙  Uploading narration to Supabase: {filename} ({size_mb:.1f} MB)")

    try:
        client.storage.from_(NARRATION_BUCKET).remove([filename])
    except Exception:
        pass

    client.storage.from_(NARRATION_BUCKET).upload(
        path=filename,
        file=file_bytes,
        file_options={"content-type": "audio/mpeg", "upsert": "true"},
    )

    base       = config.SUPABASE_URL.rstrip("/")
    public_url = f"{base}/storage/v1/object/public/{NARRATION_BUCKET}/{filename}"
    print(f"   ✅ Narration stored: {public_url}")
    return public_url