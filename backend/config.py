"""
AutoVid — Centralized Configuration
Loads all environment variables with validation
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# config.py lives at backend/config.py
# .env can live at backend/.env  OR  autovid/.env (project root)
_backend_dir = Path(__file__).parent
_project_root = _backend_dir.parent

_env_file = (
    _backend_dir / ".env" if (_backend_dir / ".env").exists()
    else _project_root / ".env" if (_project_root / ".env").exists()
    else None
)

if _env_file:
    load_dotenv(_env_file)
    print(f"🔧 Loaded .env from: {_env_file}")
else:
    load_dotenv()
    print("⚠️  No .env file found — checked backend/.env and project root")

# ── Directories ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
# Use absolute paths anchored to config.py's directory (the backend folder)
# This ensures files always land in backend/output/ regardless of where
# the process is launched from.
VIDEOS_OUTPUT_DIR = Path(os.getenv("VIDEOS_OUTPUT_DIR", str(BASE_DIR / "output" / "videos")))
AUDIO_OUTPUT_DIR  = Path(os.getenv("AUDIO_OUTPUT_DIR",  str(BASE_DIR / "output" / "audio")))
TEMP_DIR          = Path(os.getenv("TEMP_DIR",          str(BASE_DIR / "output" / "temp")))

# Create dirs on import
for d in [VIDEOS_OUTPUT_DIR, AUDIO_OUTPUT_DIR, TEMP_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ── LLM (Groq) ───────────────────────────────────────────────────────────────
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL     = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
# Secondary Groq key used exclusively for stickfigure image generation
GROQ_API_KEY_2     = os.getenv("GROQ_API_KEY_2", "")
GROQ_IMAGE_MODEL   = os.getenv("GROQ_IMAGE_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")

# ── Stock Media ──────────────────────────────────────────────────────────────
PEXELS_API_KEY  = os.getenv("PEXELS_API_KEY", "")
PIXABAY_API_KEY = os.getenv("PIXABAY_API_KEY", "")

# ── TTS ──────────────────────────────────────────────────────────────────────
TTS_ENGINE          = os.getenv("TTS_ENGINE", "elevenlabs")
ELEVENLABS_API_KEY  = os.getenv("ELEVENLABS_API_KEY", "")
# Best deep calm male narrator voices (free tier):
# Adam    pNInz6obpgDQGcFmaJgB  — deep, calm, perfect for narration ← recommended
# Josh    TxGEqnHWrfWFTfGW9XjX  — warm deep male
# Arnold  VR6AewLTigWG4xSOukaG  — authoritative, crisp
# Antoni  ErXwobaYiN019PkySvjV  — well-rounded, natural
# Sam     yoZ06aMxZJJ28mfd3POQ  — energetic, engaging
ELEVENLABS_VOICE_ID         = os.getenv("ELEVENLABS_VOICE_ID",         "NFG5qt843uXKj4pFvR7C")
DEFAULT_ELEVENLABS_VOICE_ID = os.getenv("DEFAULT_ELEVENLABS_VOICE_ID", "rUwfJCzlNVSupX1xyzzX")

# ── Database ─────────────────────────────────────────────────────────────────
SUPABASE_URL         = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY    = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# ── YouTube ──────────────────────────────────────────────────────────────────
YOUTUBE_CLIENT_SECRETS_PATH   = os.getenv("YOUTUBE_CLIENT_SECRETS_PATH", "./client_secrets.json")
YOUTUBE_TOKEN_PATH             = os.getenv("YOUTUBE_TOKEN_PATH", "./youtube_token.json")
YOUTUBE_CHANNEL_ID             = os.getenv("YOUTUBE_CHANNEL_ID", "")
# Subscriber YouTube OAuth — redirect URI must be whitelisted in Google Cloud Console
YOUTUBE_SUBSCRIBER_SECRETS_PATH = os.getenv("YOUTUBE_SUBSCRIBER_SECRETS_PATH", "./client_secrets_subscriber.json")
YOUTUBE_OAUTH_REDIRECT_URI      = os.getenv("YOUTUBE_OAUTH_REDIRECT_URI", "https://async-mode.com/api/subscribe/youtube/callback")
FRONTEND_ASYNC_URL              = os.getenv("FRONTEND_ASYNC_URL", "https://async-mode.com")

# ── Email ────────────────────────────────────────────────────────────────────
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")

# ── Auth ─────────────────────────────────────────────────────────────────────
SECRET_KEY         = os.getenv("SECRET_KEY", "change-me")
SUPERUSER_EMAIL    = os.getenv("SUPERUSER_EMAIL", "admin@autovid.ai")
SUPERUSER_PASSWORD = os.getenv("SUPERUSER_PASSWORD", "supersecret")
DANGER_ZONE_KEY    = os.getenv("DANGER_ZONE_KEY", "")  # Must be set to enable danger zone

# ── Video Export Settings ─────────────────────────────────────────────────────
VIDEO_RESOLUTION_W = int(os.getenv("VIDEO_RESOLUTION_W", 1920))
VIDEO_RESOLUTION_H = int(os.getenv("VIDEO_RESOLUTION_H", 1080))
VIDEO_FPS          = int(os.getenv("VIDEO_FPS", 30))
VIDEO_BITRATE      = os.getenv("VIDEO_BITRATE", "5000k")
AUDIO_BITRATE      = os.getenv("AUDIO_BITRATE", "192k")

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ── Podcast ───────────────────────────────────────────────────────────────────
BASE_URL             = os.getenv("BASE_URL", "")
PODCAST_TITLE        = os.getenv("PODCAST_TITLE", "My AutoVid Podcast")
PODCAST_DESCRIPTION  = os.getenv("PODCAST_DESCRIPTION", "AI-generated stories narrated for your ears")
PODCAST_IMAGE_URL    = os.getenv("PODCAST_IMAGE_URL", "")          # 1400x1400 – 3000x3000 jpg/png, required by Spotify
PODCAST_AUTHOR       = os.getenv("PODCAST_AUTHOR", "AutoVid")
PODCAST_EMAIL        = os.getenv("PODCAST_EMAIL", "")              # shown as contact in Spotify for Podcasters
PODCAST_CATEGORY     = os.getenv("PODCAST_CATEGORY", "Society &amp; Culture")   # iTunes category
PODCAST_SUBCATEGORY  = os.getenv("PODCAST_SUBCATEGORY", "")        # optional iTunes sub-category
PODCAST_LANGUAGE     = os.getenv("PODCAST_LANGUAGE", "en-us")
PODCAST_EXPLICIT     = os.getenv("PODCAST_EXPLICIT", "no")         # yes / no / clean


def validate():
    """Call at startup to check required keys are set."""
    required = {
        "GROQ_API_KEY":     GROQ_API_KEY,
        "PEXELS_API_KEY":   PEXELS_API_KEY,
        "SUPABASE_URL":     SUPABASE_URL,
        "SUPABASE_ANON_KEY": SUPABASE_ANON_KEY,
        "ELEVENLABS_API_KEY": ELEVENLABS_API_KEY,
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        raise EnvironmentError(f"Missing required env vars: {', '.join(missing)}")
    print("✅ Config validated — all required keys present")


def debug():
    """Print current config values (masks secrets). Useful for debugging."""
    def mask(val):
        if not val:
            return "❌ NOT SET"
        return val[:6] + "..." + val[-4:] if len(val) > 12 else "***"

    print("\n📋 Current Config:")
    print(f"  .env loaded from : {_env_file or 'NOT FOUND'}")
    print(f"  GROQ_API_KEY     : {mask(GROQ_API_KEY)}")
    print(f"  ELEVENLABS_KEY   : {mask(ELEVENLABS_API_KEY)}")
    print(f"  PEXELS_API_KEY   : {mask(PEXELS_API_KEY)}")
    print(f"  SUPABASE_URL     : {SUPABASE_URL or '❌ NOT SET'}")
    print(f"  SUPABASE_ANON_KEY: {mask(SUPABASE_ANON_KEY)}")
    print(f"  TTS_ENGINE       : {TTS_ENGINE}")
    print(f"  VOICE_ID         : {ELEVENLABS_VOICE_ID}")
    print()


if __name__ == "__main__":
    debug()

