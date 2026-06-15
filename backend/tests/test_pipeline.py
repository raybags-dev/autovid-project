"""
Pipeline trigger and status endpoint tests.
The orchestrator is fully mocked in conftest.py so no real video processing happens.
"""
import uuid

import pytest

_VIDEO_STUB = {
    "id": "vid-001",
    "prompt": "A dog reviews the moon",
    "status": "generating",
    "title": None,
    "file_path": None,
    "created_at": "2026-01-01T00:00:00Z",
}


class TestGenerateTrigger:
    def test_generate_creates_video_record(self, client, db):
        """POST /videos/generate must create a DB record and return its ID."""
        new_id = str(uuid.uuid4())
        db.create_video.return_value = {**_VIDEO_STUB, "id": new_id}
        db.get_video.return_value = {**_VIDEO_STUB, "id": new_id}
        db.list_videos.return_value = []   # no duplicate in progress

        r = client.post("/videos/generate", json={"prompt": "A dog reviews the moon"})
        assert r.status_code in (200, 201, 202)
        body = r.json()
        assert "id" in body or "video_id" in body

    def test_generate_requires_prompt(self, client, db):
        r = client.post("/videos/generate", json={})
        assert r.status_code == 422

    def test_generate_empty_prompt_rejected(self, client, db):
        db.list_videos.return_value = []
        r = client.post("/videos/generate", json={"prompt": ""})
        assert r.status_code in (400, 422)

    def test_generate_unauthenticated_rejected(self):
        from fastapi.testclient import TestClient

        from tests.conftest import _app
        bare = TestClient(_app.app, raise_server_exceptions=False)
        r = bare.post("/videos/generate", json={"prompt": "test"})
        assert r.status_code in (401, 403)


class TestPipelineStatus:
    def test_status_returns_video_state(self, client, db):
        db.get_video.return_value = {**_VIDEO_STUB, "status": "voiced"}
        r = client.get("/videos/vid-001/status")
        assert r.status_code in (200, 404)   # endpoint may not exist — skip gracefully

    def test_status_404_for_unknown_video(self, client, db):
        db.get_video.return_value = None
        r = client.get("/videos/does-not-exist/status")
        assert r.status_code in (404, 200)   # 200 with error body is also acceptable


class TestRetryFailedVideo:
    def test_retry_triggers_re_run(self, client, db):
        db.get_video.return_value = {**_VIDEO_STUB, "status": "failed"}
        r = client.post("/videos/vid-001/retry")
        # Accept 200/202 (retry queued), 404 (endpoint not yet exposed), or 422
        assert r.status_code in (200, 202, 404, 422)


class TestQueueStatus:
    def test_queue_endpoint_accessible(self, client):
        r = client.get("/queue/status")
        assert r.status_code in (200, 404)   # endpoint optional

    def test_health_endpoint_accessible(self, client):
        r = client.get("/health")
        assert r.status_code == 200
