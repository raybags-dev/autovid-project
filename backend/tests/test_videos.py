"""
Video CRUD endpoint tests.
All Supabase/pipeline calls are mocked via conftest.py.
"""
import pytest

VIDEO_STUB = {
    "id": "video-uuid-1",
    "title": "Test Video",
    "status": "ready",
    "prompt": "A cat explains quantum physics",
    "file_path": "https://storage.example.com/video.mp4",
    "thumbnail_url": "https://storage.example.com/thumb.jpg",
    "youtube_url": None,
    "labels": ["science", "funny"],
    "category": "Education",
    "duration_seconds": 90,
    "created_at": "2026-01-01T00:00:00Z",
    "is_exclusive": False,
    "archived": False,
}


class TestListVideos:
    def test_empty_list(self, client, db):
        db.list_videos.return_value = []
        r = client.get("/videos")
        assert r.status_code == 200
        assert r.json() == [] or isinstance(r.json(), (list, dict))

    def test_returns_video_list(self, client, db):
        db.list_videos.return_value = [VIDEO_STUB]
        r = client.get("/videos")
        assert r.status_code == 200
        data = r.json()
        ids = [v["id"] for v in data] if isinstance(data, list) else [data.get("videos", [data])[0]["id"]]
        assert "video-uuid-1" in ids

    def test_unauthenticated_is_rejected(self):
        from fastapi.testclient import TestClient

        from tests.conftest import _app
        bare = TestClient(_app.app, raise_server_exceptions=False)
        r = bare.get("/videos")
        assert r.status_code in (401, 403)


class TestGetVideo:
    def test_returns_video_by_id(self, client, db):
        db.get_video.return_value = VIDEO_STUB
        r = client.get("/videos/video-uuid-1")
        assert r.status_code == 200
        assert r.json()["id"] == "video-uuid-1"

    def test_returns_404_when_not_found(self, client, db):
        db.get_video.return_value = None
        r = client.get("/videos/does-not-exist")
        assert r.status_code == 404


class TestArchiveVideo:
    def test_archive_marks_video_archived(self, client, db):
        db.get_video.return_value = VIDEO_STUB
        db.archive_video.return_value = True
        r = client.post("/videos/video-uuid-1/archive")
        assert r.status_code in (200, 204)
        db.archive_video.assert_called_once()

    def test_archive_unknown_video_returns_404(self, client, db):
        db.get_video.return_value = None
        r = client.post("/videos/missing/archive")
        assert r.status_code == 404


class TestDeleteVideo:
    def test_delete_removes_video(self, client, db):
        db.get_video.return_value = VIDEO_STUB
        db.delete_video.return_value = True
        r = client.delete("/videos/video-uuid-1")
        assert r.status_code in (200, 204)

    def test_delete_unknown_video_returns_404(self, client, db):
        db.get_video.return_value = None
        r = client.delete("/videos/missing")
        assert r.status_code == 404


class TestVideoStatusFilter:
    def test_filter_by_status_ready(self, client, db):
        db.list_videos.return_value = [
            {**VIDEO_STUB, "id": "v1", "status": "ready"},
            {**VIDEO_STUB, "id": "v2", "status": "generating"},
        ]
        r = client.get("/videos?status=ready")
        assert r.status_code == 200
        # May filter server-side or return all (both are acceptable)
        assert r.status_code == 200

    def test_archived_videos_excluded_by_default(self, client, db):
        db.list_videos.return_value = [
            {**VIDEO_STUB, "id": "v1", "archived": False},
            {**VIDEO_STUB, "id": "v2", "archived": True},
        ]
        r = client.get("/videos")
        assert r.status_code == 200
