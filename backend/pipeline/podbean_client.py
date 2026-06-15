"""
AutoVid — Podbean API Client
Uploads podcast episodes to Podbean for Spotify-monetization-safe distribution.

Podbean API docs: https://developers.podbean.com/podbean-api-docs/
Auth:  OAuth2 — Client Credentials flow (server-to-server, no user interaction)
Base:  https://api.podbean.com/v1

Episode upload flow:
  1. GET  /oauth/token                 — exchange client_id+secret for access_token
  2. POST /files/uploadAuthorize       — get pre-signed S3 URL for the MP3
  3. PUT  <presigned_url>              — upload the raw MP3 bytes directly
  4. POST /episodes                    — publish the episode with the uploaded file_key

Settings stored in app_settings table:
  podbean_client_id      — from Podbean developer app
  podbean_client_secret  — from Podbean developer app
  podbean_auto_upload    — "true"/"false"
"""

import json
import os
import sys
import tempfile
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent.parent))
import database as db

PODBEAN_API   = "https://api.podbean.com/v1"
TOKEN_CACHE   = {}   # in-memory cache: {"access_token": "...", "expires_at": <timestamp>}


# ── Settings ──────────────────────────────────────────────────────────────────

def get_podbean_settings() -> dict:
    # Env vars take priority over DB (useful for docker .env file)
    return {
        "client_id":     os.environ.get("PODBEAN_CLIENT_ID")     or db.get_setting("podbean_client_id",     default=""),
        "client_secret": os.environ.get("PODBEAN_CLIENT_SECRET") or db.get_setting("podbean_client_secret", default=""),
        "auto_upload":   db.get_setting("podbean_auto_upload",   default="false") == "true",
    }


def save_podbean_settings(settings: dict):
    db.set_setting("podbean_client_id",     settings.get("client_id",     ""))
    db.set_setting("podbean_client_secret", settings.get("client_secret", ""))
    db.set_setting("podbean_auto_upload",   str(settings.get("auto_upload", False)).lower())


def is_configured() -> bool:
    s = get_podbean_settings()
    return bool(s.get("client_id") and s.get("client_secret"))


# ── OAuth2 Client Credentials ─────────────────────────────────────────────────

def _get_access_token(client_id: str, client_secret: str) -> str:
    """
    Fetch (or return cached) OAuth2 access token using Client Credentials flow.
    Tokens are valid for 3600 seconds; we cache and refresh 60 s early.
    """
    import time
    cached = TOKEN_CACHE.get("token")
    if cached and cached.get("expires_at", 0) > time.time() + 60:
        return cached["access_token"]

    resp = requests.post(
        f"{PODBEAN_API}/oauth/token",
        data={
            "grant_type":    "client_credentials",
            "client_id":     client_id,
            "client_secret": client_secret,
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    TOKEN_CACHE["token"] = {
        "access_token": data["access_token"],
        "expires_at":   time.time() + int(data.get("expires_in", 3600)),
    }
    return data["access_token"]


def _auth_headers(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


# ── Podbean API calls ─────────────────────────────────────────────────────────

def get_podcast_info(client_id: str, client_secret: str) -> dict:
    """Return podcast profile (title, subscriber_count, logo, etc.)."""
    token = _get_access_token(client_id, client_secret)
    resp  = requests.get(
        f"{PODBEAN_API}/podcast",
        headers=_auth_headers(token),
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json().get("podcast", {})


def list_episodes(client_id: str, client_secret: str, limit: int = 10) -> list:
    """Return recent published episodes."""
    token = _get_access_token(client_id, client_secret)
    resp  = requests.get(
        f"{PODBEAN_API}/episodes",
        headers=_auth_headers(token),
        params={"offset": 0, "limit": limit},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json().get("episodes", [])


def _authorize_file_upload(token: str, filename: str, filesize: int, content_type: str = "audio/mpeg") -> dict:
    """Step 1 — get a pre-signed S3 upload URL from Podbean."""
    resp = requests.post(
        f"{PODBEAN_API}/files/uploadAuthorize",
        headers=_auth_headers(token),
        data={
            "filename":     filename,
            "filesize":     str(filesize),
            "content_type": content_type,
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def _upload_file_to_s3(presigned_url: str, file_path: str, content_type: str = "audio/mpeg") -> None:
    """Step 2 — PUT the raw MP3 bytes to the pre-signed S3 URL."""
    filesize = os.path.getsize(file_path)
    with open(file_path, "rb") as f:
        resp = requests.put(
            presigned_url,
            data=f,
            headers={
                "Content-Type":   content_type,
                "Content-Length": str(filesize),
            },
            timeout=300,  # large files can take time
        )
    resp.raise_for_status()


def _create_episode(
    token: str,
    title: str,
    content: str,
    file_key: str,
    status: str = "publish",
    episode_type: str = "public",
) -> dict:
    """Step 3 — create the episode record on Podbean with the uploaded file_key."""
    resp = requests.post(
        f"{PODBEAN_API}/episodes",
        headers=_auth_headers(token),
        data={
            "title":        title,
            "content":      content or "",
            "status":       status,       # "publish" or "draft"
            "type":         episode_type, # "public", "premium", or "private"
            "media_key":    file_key,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get("episode", {})


# ── High-level upload ─────────────────────────────────────────────────────────

def upload_podcast_episode(video_id: str, log_fn=None) -> dict:
    """
    Upload an AutoVid podcast episode to Podbean.

    Steps:
      1. Download audio from Supabase narration_url to a temp file
      2. Request upload authorization from Podbean
      3. PUT audio to Podbean's S3
      4. Create episode record on Podbean
      5. Save podbean_episode_id + podbean_url back to videos table
    """
    def _log(msg: str):
        print(msg)
        if log_fn:
            log_fn(msg)

    settings = get_podbean_settings()
    if not settings.get("client_id") or not settings.get("client_secret"):
        raise RuntimeError("Podbean not configured — add Client ID and Secret in Settings")

    video = db.get_video(video_id)
    if not video:
        raise RuntimeError(f"Video {video_id} not found")

    audio_url = video.get("narration_url")
    if not audio_url:
        raise RuntimeError("No audio file available for this episode")

    # Clean title
    title = (video.get("title") or video.get("prompt") or "Podcast Episode").strip()
    if title.lower().startswith("[podcast] "):
        title = title[10:].strip()
    description = video.get("description") or ""

    token = _get_access_token(settings["client_id"], settings["client_secret"])

    # ── Step 1: Download from Supabase ────────────────────────────────────────
    _log("[PODBEAN 1/4] Downloading audio from Supabase...")
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        dl = requests.get(audio_url, timeout=120, stream=True)
        dl.raise_for_status()
        with open(tmp_path, "wb") as f:
            for chunk in dl.iter_content(chunk_size=65536):
                f.write(chunk)

        filesize = os.path.getsize(tmp_path)
        filename = f"{video_id}_podcast.mp3"
        _log(f"[PODBEAN 1/4] Downloaded {filesize // 1024} KB → {filename}")

        # ── Step 2: Authorize upload ──────────────────────────────────────────
        _log("[PODBEAN 2/4] Requesting upload authorization...")
        auth_data   = _authorize_file_upload(token, filename, filesize)
        presign_url = auth_data.get("presigned_url")
        file_key    = auth_data.get("file_key")
        if not presign_url or not file_key:
            raise RuntimeError(f"Unexpected Podbean upload-authorize response: {auth_data}")

        # ── Step 3: Upload to Podbean S3 ──────────────────────────────────────
        _log("[PODBEAN 3/4] Uploading to Podbean storage...")
        _upload_file_to_s3(presign_url, tmp_path)
        _log("[PODBEAN 3/4] Upload complete")

    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    # ── Step 4: Create episode record ─────────────────────────────────────────
    _log(f"[PODBEAN 4/4] Publishing episode: '{title}'...")
    episode = _create_episode(token, title, description, file_key)

    ep_id  = episode.get("id", "")
    ep_url = episode.get("episode_show_notes_url") or episode.get("player_url") or f"https://www.podbean.com/site/EpisodePlayer/{ep_id}"

    _log(f"[PODBEAN 4/4] ✅ Published — ID: {ep_id}  URL: {ep_url}")

    # ── Persist to DB ──────────────────────────────────────────────────────────
    try:
        db.update_video(video_id, podbean_episode_id=str(ep_id), podbean_url=ep_url)
    except Exception as e:
        _log(f"[PODBEAN] ⚠ Could not save episode ID to DB: {e}")
        _log("[PODBEAN] Run the SQL migration in Supabase — see Setup docs.")

    return episode
