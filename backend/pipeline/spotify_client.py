"""
Spotify OAuth2 client.
Flow:
  1. /spotify/connect  → redirect user to Spotify authorization page
  2. Spotify redirects → /spotify/callback?code=...
  3. Exchange code for access_token + refresh_token, store in DB
  4. get_access_token() auto-refreshes using the stored refresh_token
"""
import json
import os
import time
import urllib.parse

import requests

TOKEN_KEY = "spotify_token"
REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "https://your-domain.com/api/spotify/callback")
SCOPES = " ".join([
    "user-read-private",
    "user-read-email",
    "user-top-read",
    "user-read-recently-played",
    "user-library-read",
])



def _creds():
    client_id = os.getenv("SPOTIFY_CLIENT_ID", "")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise ValueError("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env")
    return client_id, client_secret


# ── Token storage ──────────────────────────────────────────────────────────────

def save_token(data: dict):
    import database
    data["saved_at"] = time.time()
    database.set_setting(TOKEN_KEY, json.dumps(data))


def load_token() -> dict | None:
    import database
    raw = database.get_setting(TOKEN_KEY, "")
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def is_connected() -> bool:
    return bool(load_token())


def disconnect():
    import database
    database.set_setting(TOKEN_KEY, "")


# ── OAuth helpers ──────────────────────────────────────────────────────────────

def get_auth_url() -> str:
    client_id, _ = _creds()
    params = {
        "client_id":     client_id,
        "response_type": "code",
        "redirect_uri":  REDIRECT_URI,
        "scope":         SCOPES,
        "show_dialog":   "false",
    }
    return "https://accounts.spotify.com/authorize?" + urllib.parse.urlencode(params)


def exchange_code(code: str):
    """Exchange auth code for access + refresh tokens and persist them."""
    client_id, client_secret = _creds()
    resp = requests.post(
        "https://accounts.spotify.com/api/token",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "grant_type":    "authorization_code",
            "code":          code,
            "redirect_uri":  REDIRECT_URI,
            "client_id":     client_id,
            "client_secret": client_secret,
        },
        timeout=15,
    )
    if not resp.ok:
        raise RuntimeError(f"Spotify token exchange failed ({resp.status_code}): {resp.text}")
    save_token(resp.json())


def _refresh() -> str:
    """Use refresh_token to obtain a new access_token. Returns new access_token."""
    client_id, client_secret = _creds()
    token = load_token()
    if not token or not token.get("refresh_token"):
        raise RuntimeError("No Spotify refresh token stored — re-connect via /spotify/connect")
    resp = requests.post(
        "https://accounts.spotify.com/api/token",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "grant_type":    "refresh_token",
            "refresh_token": token["refresh_token"],
            "client_id":     client_id,
            "client_secret": client_secret,
        },
        timeout=15,
    )
    resp.raise_for_status()
    new = resp.json()
    # Spotify may or may not return a new refresh_token — keep old if absent
    if "refresh_token" not in new:
        new["refresh_token"] = token["refresh_token"]
    save_token(new)
    return new["access_token"]


def get_access_token() -> str:
    """Return a valid access_token, auto-refreshing if expired."""
    token = load_token()
    if not token:
        raise RuntimeError("Spotify not connected")
    saved_at    = token.get("saved_at", 0)
    expires_in  = token.get("expires_in", 3600)
    # Refresh 60 s before expiry
    if time.time() > saved_at + expires_in - 60:
        return _refresh()
    return token["access_token"]


# ── API helpers ────────────────────────────────────────────────────────────────

def api_get(path: str, params: dict = None) -> dict:
    headers = {"Authorization": f"Bearer {get_access_token()}"}
    resp = requests.get(
        f"https://api.spotify.com/{path.lstrip('/')}",
        headers=headers,
        params=params or {},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def get_top_tracks(limit: int = 10, time_range: str = "long_term") -> list:
    data = api_get("v1/me/top/tracks", {"limit": limit, "time_range": time_range})
    return data.get("items", [])


def get_top_artists(limit: int = 10, time_range: str = "long_term") -> list:
    data = api_get("v1/me/top/artists", {"limit": limit, "time_range": time_range})
    return data.get("items", [])


def get_recently_played(limit: int = 20) -> list:
    data = api_get("v1/me/player/recently-played", {"limit": limit})
    return data.get("items", [])


def get_profile() -> dict:
    return api_get("v1/me")
