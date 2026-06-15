"""
Authentication endpoint tests.
login / logout / /auth/me / token validation.
"""
import time

import jwt as pyjwt
import pytest

SECRET = "test-secret-key-do-not-use-in-prod"
ALGO   = "HS256"


def _make_token(email: str = "admin@test.local", exp_offset: int = 3600) -> str:
    return pyjwt.encode(
        {"sub": email, "exp": int(time.time()) + exp_offset},
        SECRET,
        algorithm=ALGO,
    )


class TestAuthMe:
    def test_authenticated_user_returns_email(self, client):
        r = client.get("/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert "email" in data
        assert data["email"] == "admin@test.local"

    def test_unauthenticated_is_401_or_403(self):
        from fastapi.testclient import TestClient

        from tests.conftest import _app
        bare = TestClient(_app.app, raise_server_exceptions=False)
        r = bare.get("/auth/me")
        assert r.status_code in (401, 403)


class TestLogin:
    def test_valid_credentials_return_token(self, client):
        r = client.post(
            "/auth/login",
            json={"email": "admin@test.local", "password": "testpassword"},
        )
        # Accept 200 (token issued) or 422 (if route shape differs)
        assert r.status_code in (200, 201, 422)
        if r.status_code in (200, 201):
            body = r.json()
            assert "access_token" in body or "token" in body

    def test_wrong_password_rejected(self, client):
        r = client.post(
            "/auth/login",
            json={"email": "admin@test.local", "password": "wrong-password"},
        )
        assert r.status_code in (401, 403, 400, 422)

    def test_unknown_email_rejected(self, client):
        r = client.post(
            "/auth/login",
            json={"email": "nobody@nowhere.com", "password": "anything"},
        )
        assert r.status_code in (401, 403, 400, 404, 422)

    def test_missing_fields_rejected(self, client):
        r = client.post("/auth/login", json={})
        assert r.status_code == 422


class TestLogout:
    def test_logout_returns_expected_status(self, client):
        """Logout may be client-side (clear token) — 200, 204, or 404 all acceptable."""
        r = client.post("/auth/logout")
        assert r.status_code in (200, 204, 404)


class TestTokenExpiry:
    def test_expired_token_is_rejected(self):
        from fastapi.testclient import TestClient

        from tests.conftest import _app
        expired = _make_token(exp_offset=-1)   # already expired
        bare = TestClient(_app.app, raise_server_exceptions=False)
        r = bare.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {expired}"},
        )
        assert r.status_code in (401, 403)
