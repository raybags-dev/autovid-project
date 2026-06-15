"""
AutoVid — Buzzsprout API Client
Handles episode uploads to Buzzsprout for Spotify-monetization-safe distribution.

Buzzsprout API docs: https://www.buzzsprout.com/api
Auth:  Authorization: Token token=<api_token>
Base:  https://www.buzzsprout.com/api/{podcast_id}

Settings are stored in the app_settings table:
  buzzsprout_api_token   — API token from Buzzsprout Account → API
  buzzsprout_podcast_id  — numeric podcast ID from the dashboard URL
  buzzsprout_auto_upload — "true"/"false" — auto-push on podcast completion
"""

import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent.parent))
import database as db

BUZZSPROUT_BASE = "https://www.buzzsprout.com/api"


# ── Settings ──────────────────────────────────────────────────────────────────

def get_buzzsprout_settings() -> dict:
    # Env vars take priority over DB (useful for docker .env file)
    return {
        "api_token":   os.environ.get("BUZZSPROUT_API_TOKEN")   or db.get_setting("buzzsprout_api_token",   default=""),
        "podcast_id":  os.environ.get("BUZZSPROUT_PODCAST_ID")  or db.get_setting("buzzsprout_podcast_id",  default=""),
        "auto_upload": db.get_setting("buzzsprout_auto_upload", default="false") == "true",
    }


def save_buzzsprout_settings(settings: dict):
    db.set_setting("buzzsprout_api_token",   settings.get("api_token",   ""))
    db.set_setting("buzzsprout_podcast_id",  settings.get("podcast_id",  ""))
    db.set_setting("buzzsprout_auto_upload", str(settings.get("auto_upload", False)).lower())


def is_configured() -> bool:
    s = get_buzzsprout_settings()
    return bool(s.get("api_token") and s.get("podcast_id"))


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def _headers(api_token: str) -> dict:
    return {
        "Authorization": f"Token token={api_token}",
        "Content-Type":  "application/json; charset=utf-8",
    }


# ── API calls ─────────────────────────────────────────────────────────────────

def get_podcast_info(api_token: str, podcast_id: str) -> dict:
    """Return podcast-level details (title, subscribers, image, etc.)."""
    url  = f"{BUZZSPROUT_BASE}/{podcast_id}.json"
    resp = requests.get(url, headers=_headers(api_token), timeout=15)
    resp.raise_for_status()
    return resp.json()


def list_episodes(api_token: str, podcast_id: str, limit: int = 10) -> list:
    """Return most recent episodes."""
    url  = f"{BUZZSPROUT_BASE}/{podcast_id}/episodes.json"
    resp = requests.get(url, headers=_headers(api_token), timeout=15)
    resp.raise_for_status()
    data = resp.json()
    return data[:limit] if isinstance(data, list) else []


def create_episode(
    api_token: str,
    podcast_id: str,
    title: str,
    description: str,
    audio_url: str,
    tags: str = "autovid,ai,podcast",
) -> dict:
    """
    POST a new episode to Buzzsprout.
    Buzzsprout fetches the audio from audio_url asynchronously (usually < 2 min).
    Returns the created episode dict, including id and guid.
    """
    url  = f"{BUZZSPROUT_BASE}/{podcast_id}/episodes.json"
    body = {
        "title":                       title,
        "description":                 description or "",
        "audio_url":                   audio_url,
        "tags":                        tags,
        "email_after_audio_processed": False,
        "private":                     False,
    }
    resp = requests.post(url, headers=_headers(api_token), json=body, timeout=30)
    resp.raise_for_status()
    return resp.json()


def get_episode(api_token: str, podcast_id: str, episode_id) -> dict:
    """Return episode details including processing status."""
    url  = f"{BUZZSPROUT_BASE}/{podcast_id}/episodes/{episode_id}.json"
    resp = requests.get(url, headers=_headers(api_token), timeout=15)
    resp.raise_for_status()
    return resp.json()


# ── High-level upload ─────────────────────────────────────────────────────────

def upload_podcast_episode(video_id: str, log_fn=None) -> dict:
    """
    Upload an AutoVid podcast episode to Buzzsprout.

    Reads the narration_url from the DB record and posts it to Buzzsprout.
    Saves buzzsprout_episode_id and buzzsprout_url back to the video record.
    Returns the created Buzzsprout episode dict.
    """

    def _log(msg: str):
        print(msg)
        if log_fn:
            log_fn(msg)

    settings = get_buzzsprout_settings()
    if not settings.get("api_token") or not settings.get("podcast_id"):
        raise RuntimeError(
            "Buzzsprout not configured — add API Token and Podcast ID in Settings"
        )

    video = db.get_video(video_id)
    if not video:
        raise RuntimeError(f"Video {video_id} not found")

    audio_url = video.get("narration_url")
    if not audio_url:
        raise RuntimeError("No audio file available for this episode")

    # Clean up [Podcast] prefix from auto-generated titles
    title = (video.get("title") or video.get("prompt") or "Podcast Episode").strip()
    if title.lower().startswith("[podcast] "):
        title = title[10:].strip()

    description = video.get("description") or ""
    labels      = video.get("labels") or []
    tags        = ",".join(["autovid", "ai", "podcast"] + [l for l in labels if l not in ("podcast", "autovid")])

    _log(f"[BUZZSPROUT 1/2] Posting '{title}' to Buzzsprout (podcast {settings['podcast_id']})...")

    episode = create_episode(
        api_token   = settings["api_token"],
        podcast_id  = settings["podcast_id"],
        title       = title,
        description = description,
        audio_url   = audio_url,
        tags        = tags[:255],
    )

    ep_id  = episode.get("id")
    ep_url = f"https://www.buzzsprout.com/{settings['podcast_id']}/episodes/{ep_id}"

    _log(f"[BUZZSPROUT 2/2] Episode created — ID: {ep_id}  URL: {ep_url}")

    # Persist to DB (requires buzzsprout_episode_id + buzzsprout_url columns — see migration)
    try:
        db.update_video(
            video_id,
            buzzsprout_episode_id = str(ep_id),
            buzzsprout_url        = ep_url,
        )
    except Exception as e:
        _log(f"[BUZZSPROUT] ⚠ Could not save episode ID to DB: {e}")
        _log("[BUZZSPROUT] ℹ Run the SQL migration in Supabase — see docs.")

    return episode
