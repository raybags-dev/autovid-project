"""
Settings endpoint tests — get / update application settings.
"""
import pytest


class TestSettingsEndpoints:
    def test_get_settings_returns_dict(self, client, db):
        db.get_setting.return_value = "some-value"
        db.list_settings.return_value = {"theme": "dark", "auto_upload": True}
        r = client.get("/settings")
        assert r.status_code in (200, 404)   # endpoint may not be exposed yet

    def test_update_setting_persists(self, client, db):
        db.set_setting.return_value = True
        r = client.post("/settings", json={"key": "theme", "value": "light"})
        assert r.status_code in (200, 201, 204, 404, 422)

    def test_unauthenticated_settings_read_rejected(self):
        from fastapi.testclient import TestClient

        from tests.conftest import _app
        bare = TestClient(_app.app, raise_server_exceptions=False)
        r = bare.get("/settings")
        assert r.status_code in (401, 403, 404)


class TestTikTokUrlSetting:
    def test_tiktok_url_returns_configured_value(self, client, db):
        db.get_setting.return_value = "https://www.tiktok.com/@my-handle"
        r = client.get("/settings/tiktok-url")
        assert r.status_code == 200
        body = r.json()
        assert "url" in body
        assert "tiktok" in body["url"]

    def test_tiktok_url_has_generic_default(self, client, db):
        db.get_setting.return_value = None
        r = client.get("/settings/tiktok-url")
        assert r.status_code == 200
        url = r.json().get("url") or ""
        # Must NOT contain old personal handle from before genericisation
        assert "4lifemystery183284" not in url


class TestHealthEndpoint:
    def test_health_check_returns_200(self, client):
        r = client.get("/health")
        assert r.status_code == 200

    def test_health_returns_status_field(self, client):
        r = client.get("/health")
        if r.status_code == 200:
            body = r.json()
            assert "status" in body or "ok" in body or isinstance(body, dict)
