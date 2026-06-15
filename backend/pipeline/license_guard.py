"""
AutoVid License Guard — startup verification using Ed25519 signature.

The license token is a signed JWT-like structure:
  <base64url(payload_json)>.<base64url(ed25519_signature)>

The private signing key is kept offline by the author. The public key
embedded here verifies that any token in circulation was legitimately issued.
Without a valid AUTOVID_LICENSE_KEY in the environment, the pipeline refuses
to run.
"""
import base64
import json
import os
from datetime import datetime

from cryptography.hazmat.primitives.serialization import load_pem_public_key

_PUBLIC_KEY_PEM = b"""-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAP3BesHskXniJoFYxpWlx4H0/VxIGOf034jJ1KjaJglA=
-----END PUBLIC KEY-----"""

_verified: bool = False


def verify_license() -> dict:
    """
    Verify the AUTOVID_LICENSE_KEY environment variable.
    Raises RuntimeError on failure; returns the payload dict on success.
    Caches the result so repeated calls are free.
    """
    global _verified
    if _verified:
        return {}

    token = os.getenv("AUTOVID_LICENSE_KEY", "").strip()
    if not token:
        raise RuntimeError(
            "\n\n  ╔══════════════════════════════════════════════════╗\n"
            "  ║  AutoVid: No license key found.                  ║\n"
            "  ║  Set AUTOVID_LICENSE_KEY in your .env file.      ║\n"
            "  ╚══════════════════════════════════════════════════╝\n"
        )

    try:
        parts = token.split(".")
        if len(parts) != 2:
            raise ValueError("Malformed token — expected 2 segments")

        payload_b64, sig_b64 = parts

        def _pad(s: str) -> str:
            return s + "=" * (-len(s) % 4)

        payload_bytes = base64.urlsafe_b64decode(_pad(payload_b64))
        signature = base64.urlsafe_b64decode(_pad(sig_b64))
        payload = json.loads(payload_bytes)

        pub_key = load_pem_public_key(_PUBLIC_KEY_PEM)
        pub_key.verify(signature, payload_b64.encode())

        exp = datetime.fromisoformat(payload.get("exp", "2000-01-01T00:00:00"))
        if exp < datetime.utcnow():
            raise ValueError(f"License expired on {exp.date()}")

        _verified = True
        return payload

    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(
            f"\n\n  ╔══════════════════════════════════════════════════╗\n"
            f"  ║  AutoVid: License verification failed.           ║\n"
            f"  ║  {str(exc)[:48]:<48}║\n"
            f"  ╚══════════════════════════════════════════════════╝\n"
        ) from exc
