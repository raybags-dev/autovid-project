"""
License guard unit tests — uses an in-test Ed25519 key pair to sign tokens,
then patches the public key embedded in license_guard.py.
No real private key needed.

Note: conftest.py stubs `pipeline` as a MagicMock so main.py imports work without
heavy deps. This file loads license_guard.py directly via importlib to bypass that
stub and exercise the real module.
"""
import base64
import importlib.util
import json
import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)

# Load the real license_guard module directly (bypasses the pipeline MagicMock stub)
_GUARD_PATH = Path(__file__).parent.parent / "pipeline" / "license_guard.py"


def _load_guard():
    """Fresh import of the real license_guard module each test."""
    spec = importlib.util.spec_from_file_location("license_guard_real", _GUARD_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod._verified = False   # always start unverified
    return mod


def _generate_keypair():
    priv = Ed25519PrivateKey.generate()
    pub_pem = priv.public_key().public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo)
    return priv, pub_pem


def _sign_token(private_key, payload: dict) -> str:
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode()
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).rstrip(b"=").decode()
    sig = private_key.sign(payload_b64.encode())
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()
    return f"{payload_b64}.{sig_b64}"


def _future_exp():
    from datetime import datetime, timezone
    far = datetime(2036, 1, 1, tzinfo=timezone.utc)
    return far.strftime("%Y-%m-%dT%H:%M:%S")


class TestLicenseGuard:
    """All tests load the real module via importlib and patch its public key."""

    def setup_method(self):
        self.priv, self.pub_pem = _generate_keypair()
        self.lg = _load_guard()

    def test_valid_token_passes(self):
        token = _sign_token(
            self.priv,
            {"iss": "autovid", "sub": "test", "exp": _future_exp(), "tier": "test"},
        )
        with patch.object(self.lg, "_PUBLIC_KEY_PEM", self.pub_pem):
            with patch.dict(os.environ, {"AUTOVID_LICENSE_KEY": token}):
                payload = self.lg.verify_license()
        assert isinstance(payload, dict)

    def test_missing_token_raises(self):
        with patch.object(self.lg, "_PUBLIC_KEY_PEM", self.pub_pem):
            with patch.dict(os.environ, {"AUTOVID_LICENSE_KEY": ""}):
                with pytest.raises(RuntimeError, match="No license key found"):
                    self.lg.verify_license()

    def test_tampered_signature_raises(self):
        token = _sign_token(
            self.priv,
            {"iss": "autovid", "sub": "test", "exp": _future_exp(), "tier": "test"},
        )
        parts = token.split(".")
        tampered = parts[0] + "." + "A" * 86
        with patch.object(self.lg, "_PUBLIC_KEY_PEM", self.pub_pem):
            with patch.dict(os.environ, {"AUTOVID_LICENSE_KEY": tampered}):
                with pytest.raises(RuntimeError, match="(Invalid license|verification failed)"):
                    self.lg.verify_license()

    def test_expired_token_raises(self):
        token = _sign_token(
            self.priv,
            {"iss": "autovid", "sub": "test", "exp": "2020-01-01T00:00:00", "tier": "test"},
        )
        with patch.object(self.lg, "_PUBLIC_KEY_PEM", self.pub_pem):
            with patch.dict(os.environ, {"AUTOVID_LICENSE_KEY": token}):
                with pytest.raises(RuntimeError, match="(expired|Invalid)"):
                    self.lg.verify_license()

    def test_malformed_token_raises(self):
        with patch.object(self.lg, "_PUBLIC_KEY_PEM", self.pub_pem):
            with patch.dict(os.environ, {"AUTOVID_LICENSE_KEY": "not.a.valid.token.format"}):
                with pytest.raises(RuntimeError):
                    self.lg.verify_license()

    def test_verified_flag_skips_recheck(self):
        """Once verified, repeated calls skip signature verification without re-checking."""
        self.lg._verified = True
        result = self.lg.verify_license()
        assert result == {}
