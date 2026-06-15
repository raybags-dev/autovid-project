"""
API integration tests — run via: cd backend && python -m pytest tests/ -v
All tests use a mocked database; no real Supabase/Redis/FFmpeg needed.
"""
import time

import jwt
import pytest

# ── Helpers ───────────────────────────────────────────────────────────────────

def _sub_token(user_id: str = "test-subscriber") -> str:
    """Generate a valid subscriber JWT for testing."""
    return jwt.encode(
        {"sub": user_id, "role": "subscriber", "exp": int(time.time()) + 3600},
        "test-secret-key-do-not-use-in-prod",
        algorithm="HS256",
    )


# ── Health / auth ─────────────────────────────────────────────────────────────

class TestHealth:
    def test_auth_me_returns_email(self, client):
        r = client.get("/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == "admin@test.local"

    def test_unauthenticated_request_rejected(self):
        from fastapi.testclient import TestClient

        from tests.conftest import _app
        # Use a fresh client with no dependency overrides
        bare_client = TestClient(_app.app, raise_server_exceptions=False)
        r = bare_client.get("/auth/me")
        assert r.status_code in (401, 403)


# ── Exclusive subscriber library ──────────────────────────────────────────────

class TestSubscriberLibrary:
    def test_returns_empty_when_no_exclusive_content(self, client, db):
        db.list_videos.return_value = [
            {"id": "v1", "is_exclusive": False, "archived": False, "title": "Public video"},
        ]
        db.list_custom_content.return_value = []

        r = client.get("/subscribe/videos")
        assert r.status_code == 200
        assert r.json()["videos"] == []

    def test_returns_exclusive_pipeline_videos(self, client, db):
        db.list_videos.return_value = [
            {"id": "v1", "is_exclusive": True, "archived": False, "title": "Exclusive"},
            {"id": "v2", "is_exclusive": True, "archived": True,  "title": "Archived"},
        ]
        db.list_custom_content.return_value = []

        r = client.get("/subscribe/videos")
        assert r.status_code == 200
        videos = r.json()["videos"]
        # archived item must be excluded
        assert len(videos) == 1
        assert videos[0]["id"] == "v1"

    def test_returns_exclusive_custom_content(self, client, db):
        """Core bug fix: CC items marked exclusive must appear in the library."""
        db.list_videos.return_value = []
        db.list_custom_content.return_value = [
            {
                "id": "cc1", "is_exclusive": True, "archived": False,
                "file_path": "https://storage.example.com/video.mp4",
                "title": "Exclusive CC video",
            },
            {
                "id": "cc2", "is_exclusive": True, "archived": False,
                "file_path": None,   # no file → must be excluded
                "title": "Unfinished CC upload",
            },
            {
                "id": "cc3", "is_exclusive": False, "archived": False,
                "file_path": "https://storage.example.com/other.mp4",
                "title": "Non-exclusive CC",
            },
        ]

        r = client.get("/subscribe/videos")
        assert r.status_code == 200
        videos = r.json()["videos"]
        ids = [v["id"] for v in videos]

        assert "cc1" in ids, "Exclusive CC with file_path must appear"
        assert "cc2" not in ids, "CC without file_path must be excluded"
        assert "cc3" not in ids, "Non-exclusive CC must be excluded"

    def test_exclusive_cc_has_is_cc_flag(self, client, db):
        """CC items returned by the library must carry is_cc=True."""
        db.list_videos.return_value = []
        db.list_custom_content.return_value = [
            {
                "id": "cc1", "is_exclusive": True, "archived": False,
                "file_path": "https://storage.example.com/v.mp4",
                "title": "Exclusive CC",
            }
        ]

        r = client.get("/subscribe/videos")
        videos = r.json()["videos"]
        assert videos[0].get("is_cc") is True

    def test_combines_pipeline_and_cc_exclusive(self, client, db):
        db.list_videos.return_value = [
            {"id": "v1", "is_exclusive": True, "archived": False, "title": "Pipeline vid"}
        ]
        db.list_custom_content.return_value = [
            {
                "id": "cc1", "is_exclusive": True, "archived": False,
                "file_path": "https://storage.example.com/v.mp4",
                "title": "CC vid",
            }
        ]

        r = client.get("/subscribe/videos")
        ids = [v["id"] for v in r.json()["videos"]]
        assert "v1" in ids
        assert "cc1" in ids


# ── Set-exclusive endpoint ────────────────────────────────────────────────────

class TestSetExclusive:
    def test_set_exclusive_on_pipeline_video(self, client, db):
        db.set_video_exclusive.return_value = {"id": "v1", "is_exclusive": True}

        r = client.post("/videos/v1/set-exclusive", json={"is_exclusive": True})
        assert r.status_code == 200
        assert r.json()["ok"] is True

        db.set_video_exclusive.assert_called_once_with("v1", True)

    def test_set_exclusive_on_cc_video(self, client, db):
        """set-exclusive endpoint must work for custom content IDs too."""
        db.set_video_exclusive.return_value = {"id": "cc1", "is_exclusive": True}

        r = client.post("/videos/cc1/set-exclusive", json={"is_exclusive": True})
        assert r.status_code == 200
        assert r.json()["ok"] is True


# ── Custom content ────────────────────────────────────────────────────────────

class TestCustomContent:
    def test_list_custom_content_returns_items(self, client, db):
        db.list_custom_content.return_value = [
            {"id": "cc1", "title": "My Video", "status": "ready", "file_path": "https://x.com/v.mp4"},
        ]

        r = client.get("/custom-content")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert data[0]["id"] == "cc1"

    def test_finalize_sets_status_ready(self, client, db):
        """finalize must set status=ready synchronously (not rely on background task)."""
        item_id = "cc-upload-123"
        db.get_custom_content.return_value = {
            "id": item_id, "status": "uploading", "file_path": None,
        }
        db.update_custom_content.return_value = {"id": item_id, "status": "ready"}

        r = client.post(
            f"/custom-content/{item_id}/finalize",
            json={"public_url": "https://storage.example.com/file.mp4"},
        )
        # Should succeed and synchronously set the file_path + status
        assert r.status_code in (200, 202)
        # Verify update was called with status=ready (synchronous path)
        calls = db.update_custom_content.call_args_list
        sync_call = next(
            (c for c in calls if c.kwargs.get("status") == "ready" or
             (len(c.args) > 1 and c.args[1] == "ready")),
            None
        )
        assert sync_call is not None, "finalize must set status='ready' synchronously"


# ── Shorts — create-short supports CC items ───────────────────────────────────

class TestCreateShort:
    def test_create_short_from_cc_video(self, client, db):
        """create-short must find CC videos even if not in the videos table."""
        db.get_video.return_value = None  # not a pipeline video
        db.get_custom_content.return_value = {
            "id": "cc1",
            "title": "My CC Video",
            "file_path": "https://storage.example.com/v.mp4",
            "labels": [],
        }

        r = client.post("/videos/cc1/create-short", json={})
        # Should queue the job, not 404
        assert r.status_code == 200
        assert "video_id" in r.json()

    def test_create_short_404_when_video_missing(self, client, db):
        db.get_video.return_value = None
        db.get_custom_content.return_value = None

        r = client.post("/videos/nonexistent/create-short", json={})
        assert r.status_code == 404
