"""
AutoVid Pipeline — TikTok Uploader

Uses TikTok Content Posting API v2 (Direct Post).
OAuth2 PKCE flow — tokens stored in Supabase app_settings.

Auth flow:
  1. GET /tiktok/auth  → redirect to TikTok consent page
  2. TikTok redirects to /tiktok/callback with ?code=...
  3. Exchange code for access_token + refresh_token → saved to DB
  4. upload_to_tiktok() uses stored token, auto-refreshes when expired
"""

import os
import json
import time
import hashlib
import secrets
import requests
from pathlib import Path

CLIENT_KEY    = os.getenv("TIKTOK_CLIENT_KEY", "")
CLIENT_SECRET = os.getenv("TIKTOK_CLIENT_SECRET", "")
REDIRECT_URI  = os.getenv("TIKTOK_REDIRECT_URI", "https://4lifemystery.com/api/tiktok/callback")

TOKEN_KEY      = "tiktok_token"
CODE_VERIFIER_KEY = "tiktok_code_verifier"

# ── Token helpers ──────────────────────────────────────────────────────────────

def _db():
    import database
    return database

def save_token(token_data: dict):
    token_data["saved_at"] = int(time.time())
    _db().set_setting(TOKEN_KEY, json.dumps(token_data))

def load_token() -> dict | None:
    raw = _db().get_setting(TOKEN_KEY)
    if not raw:
        return None
    try:
        return json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return None

def is_connected() -> bool:
    return load_token() is not None

def _refresh_token(token: dict) -> dict:
    """Refresh access token using refresh_token."""
    resp = requests.post(
        "https://open.tiktokapis.com/v2/oauth/token/",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "client_key":     CLIENT_KEY,
            "client_secret":  CLIENT_SECRET,
            "grant_type":     "refresh_token",
            "refresh_token":  token["refresh_token"],
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("error"):
        raise RuntimeError(f"TikTok token refresh failed: {data}")
    merged = {**token, **data}
    save_token(merged)
    return merged

def get_valid_token() -> dict:
    """Return a valid token, refreshing if expired."""
    token = load_token()
    if not token:
        raise RuntimeError("TikTok not connected. Visit /tiktok/auth to authorise.")
    saved_at   = token.get("saved_at", 0)
    expires_in = token.get("expires_in", 86400)
    if time.time() > saved_at + expires_in - 300:   # refresh 5 min early
        token = _refresh_token(token)
    return token

# ── OAuth helpers ──────────────────────────────────────────────────────────────

def build_auth_url() -> str:
    """Generate PKCE auth URL and persist code_verifier for callback."""
    verifier  = secrets.token_urlsafe(64)
    challenge = hashlib.sha256(verifier.encode()).digest()
    import base64
    challenge_b64 = base64.urlsafe_b64encode(challenge).rstrip(b"=").decode()
    _db().set_setting(CODE_VERIFIER_KEY, verifier)

    params = {
        "client_key":             CLIENT_KEY,
        "response_type":          "code",
        "scope":                  "video.upload,video.publish,user.info.basic",
        "redirect_uri":           REDIRECT_URI,
        "code_challenge":         challenge_b64,
        "code_challenge_method":  "S256",
    }
    from urllib.parse import urlencode
    return "https://www.tiktok.com/v2/auth/authorize/?" + urlencode(params)

def exchange_code(code: str) -> dict:
    """Exchange auth code for tokens."""
    verifier = _db().get_setting(CODE_VERIFIER_KEY, "")
    resp = requests.post(
        "https://open.tiktokapis.com/v2/oauth/token/",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "client_key":     CLIENT_KEY,
            "client_secret":  CLIENT_SECRET,
            "code":           code,
            "grant_type":     "authorization_code",
            "redirect_uri":   REDIRECT_URI,
            "code_verifier":  verifier,
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("error"):
        raise RuntimeError(f"TikTok auth failed: {data}")
    save_token(data)
    return data

def disconnect():
    _db().set_setting(TOKEN_KEY, "")

# ── Upload ─────────────────────────────────────────────────────────────────────

def upload_to_tiktok(
    video_path: str,
    title: str,
    description: str = "",
    *,
    privacy: str = "SELF_ONLY",   # SELF_ONLY | PUBLIC_TO_EVERYONE | MUTUAL_FOLLOW_FRIENDS
) -> dict:
    """
    Upload a video to TikTok using the Content Posting API (Direct Post).
    Returns the TikTok publish_id on success.

    privacy options:
      SELF_ONLY          — only you can see (safe default for testing)
      PUBLIC_TO_EVERYONE — fully public
      MUTUAL_FOLLOW_FRIENDS — friends only
    """
    token     = get_valid_token()
    access_tk = token["access_token"]
    headers   = {"Authorization": f"Bearer {access_tk}"}

    video_size = os.path.getsize(video_path)

    # Step 1: Init upload
    init_resp = requests.post(
        "https://open.tiktokapis.com/v2/post/publish/video/init/",
        headers={**headers, "Content-Type": "application/json; charset=UTF-8"},
        json={
            "post_info": {
                "title":           title[:150],
                "privacy_level":   privacy,
                "disable_duet":    False,
                "disable_comment": False,
                "disable_stitch":  False,
            },
            "source_info": {
                "source":     "FILE_UPLOAD",
                "video_size": video_size,
                "chunk_size": video_size,
                "total_chunk_count": 1,
            },
        },
        timeout=30,
    )
    init_resp.raise_for_status()
    init_data = init_resp.json()
    if init_data.get("error", {}).get("code", "ok") != "ok":
        raise RuntimeError(f"TikTok init failed: {init_data}")

    upload_url = init_data["data"]["upload_url"]
    publish_id = init_data["data"]["publish_id"]

    # Step 2: Upload video bytes
    with open(video_path, "rb") as f:
        video_bytes = f.read()

    upload_resp = requests.put(
        upload_url,
        headers={
            "Content-Type":  "video/mp4",
            "Content-Range": f"bytes 0-{video_size - 1}/{video_size}",
        },
        data=video_bytes,
        timeout=300,
    )
    upload_resp.raise_for_status()

    # Step 3: Poll status until published (up to 3 minutes)
    for _ in range(36):
        time.sleep(5)
        status_resp = requests.post(
            "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
            headers={**headers, "Content-Type": "application/json; charset=UTF-8"},
            json={"publish_id": publish_id},
            timeout=30,
        )
        status_resp.raise_for_status()
        status_data = status_resp.json()
        status = status_data.get("data", {}).get("status", "")
        print(f"TikTok publish status: {status}")
        if status == "PUBLISH_COMPLETE":
            return {"publish_id": publish_id, "status": "published"}
        if status in ("FAILED", "SPAM_RISK_TOO_MANY_POSTS", "SPAM_RISK_USER_BANNED"):
            raise RuntimeError(f"TikTok publish failed: {status_data}")

    return {"publish_id": publish_id, "status": "processing"}
