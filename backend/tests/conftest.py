"""
Test configuration — mocks heavy pipeline/celery deps so the FastAPI app
can be imported and tested without Supabase, Redis, or GPU hardware.
"""
import os
import sys
from unittest.mock import MagicMock

# Must happen before any import of config or main
os.environ.update({
    "SECRET_KEY": "test-secret-key-do-not-use-in-prod",
    "SUPERUSER_EMAIL": "admin@test.local",
    "SUPERUSER_PASSWORD": "testpassword",
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_SERVICE_KEY": "test-service-key",
    "SUPABASE_ANON_KEY": "test-anon-key",
    "REDIS_URL": "redis://localhost:6379",
    "ELEVENLABS_API_KEY": "test",
    "OPENAI_API_KEY": "test",
    "GROQ_API_KEY": "test",
    "XAI_API_KEY": "test",
    "PEXELS_API_KEY": "test",
    # License guard: tests that specifically test the guard manage AUTOVID_LICENSE_KEY
    # themselves via monkeypatching. For all other tests the orchestrator is fully mocked
    # so verify_license() is never called. Set a placeholder so config loads cleanly.
    "AUTOVID_LICENSE_KEY": os.getenv("AUTOVID_LICENSE_KEY", "ci-placeholder"),
})

# Stub every heavy module main.py imports at module-scope so tests don't need
# ffmpeg, PyTorch, Celery workers, or a real Supabase connection.
_stub = MagicMock()
_HEAVY = [
    "pipeline", "pipeline.orchestrator", "pipeline.youtube_uploader",
    "pipeline.caption", "pipeline.captioner", "pipeline.storage",
    "pipeline.shorts_generator", "pipeline.script_writer",
    "pipeline.tts", "pipeline.video_assembler", "pipeline.labeler",
    # license_guard is NOT stubbed here — test_license_guard.py imports and patches it directly
    "workers", "workers.celery_app",
    "celery", "celery.app", "celery.result",
    "redis", "redis.exceptions", "redis.client",
    "faster_whisper", "moviepy", "moviepy.editor",
    "gtts", "elevenlabs", "groq", "openai",
    "yt_dlp", "ffmpeg",
]
for mod in _HEAVY:
    sys.modules.setdefault(mod, MagicMock())

sys.modules["pipeline.orchestrator"].run_pipeline = MagicMock(return_value=None)
sys.modules["pipeline.orchestrator"].retry_failed = MagicMock(return_value=None)
sys.modules["pipeline.youtube_uploader"].check_quota_status = MagicMock(return_value={"ok": True})

# Replace the `database` module with a MagicMock BEFORE importing main.
# `main.py` does `import database as db` at module scope; since we put a mock
# in sys.modules first, main.db ends up pointing to our mock.
_db_sentinel = MagicMock()
sys.modules["database"] = _db_sentinel

# Import main exactly once — subsequent `import main` calls hit sys.modules
import pytest
from fastapi.testclient import TestClient

import main as _app  # noqa: E402  (must come after sys.modules patching)


@pytest.fixture(scope="function")
def db(monkeypatch):
    """Fresh database mock per test, injected directly into the loaded main module."""
    mock = MagicMock()
    mock.list_videos.return_value = []
    mock.list_custom_content.return_value = []
    mock.get_video.return_value = None
    mock.get_custom_content.return_value = None
    mock.get_client.return_value = MagicMock()
    monkeypatch.setattr(_app, "db", mock)
    return mock


@pytest.fixture(scope="function")
def client(db):
    """TestClient with admin auth bypass."""
    _app.app.dependency_overrides[_app.verify_token] = lambda: "admin@test.local"
    _app.app.dependency_overrides[_app.verify_subscriber_token] = lambda: "subscriber-uuid"
    yield TestClient(_app.app, raise_server_exceptions=True)
    _app.app.dependency_overrides.clear()
