"""
Configuration module tests — validates that config loads correctly
and that validate() raises on missing required keys.
"""
import os
import sys
from unittest.mock import patch

import pytest


class TestConfigValidation:
    def test_validate_passes_with_all_required_keys(self):
        """validate() should not raise when all required keys are set."""
        import config
        # All required keys are already set by conftest.py env setup
        # This just confirms no exception is thrown
        with patch.dict(os.environ, {
            "GROQ_API_KEY": "test-key",
            "PEXELS_API_KEY": "test-key",
            "SUPABASE_URL": "https://test.supabase.co",
            "SUPABASE_ANON_KEY": "test-anon",
            "ELEVENLABS_API_KEY": "test-key",
        }):
            try:
                config.validate()
            except EnvironmentError:
                pytest.fail("validate() raised unexpectedly with all keys set")

    def test_validate_raises_on_missing_groq_key(self):
        import importlib

        import config as cfg
        env = {k: v for k, v in os.environ.items()}
        env.pop("GROQ_API_KEY", None)
        env["GROQ_API_KEY"] = ""
        with patch.dict(os.environ, env, clear=True):
            # Reload to pick up cleared env
            with pytest.raises(EnvironmentError, match="GROQ_API_KEY"):
                # Temporarily clear the cached value
                orig = cfg.GROQ_API_KEY
                cfg.GROQ_API_KEY = ""
                try:
                    cfg.validate()
                finally:
                    cfg.GROQ_API_KEY = orig

    def test_video_dirs_are_created(self):
        """config import must create output directories."""
        import config
        assert config.VIDEOS_OUTPUT_DIR.exists()
        assert config.AUDIO_OUTPUT_DIR.exists()
        assert config.TEMP_DIR.exists()

    def test_base_dir_is_backend_folder(self):
        from pathlib import Path

        import config
        assert config.BASE_DIR.name == "backend"

    def test_default_tts_engine(self):
        import config
        assert config.TTS_ENGINE in ("elevenlabs", "coqui", "test")

    def test_video_resolution_defaults(self):
        import config
        assert config.VIDEO_RESOLUTION_W == 1920
        assert config.VIDEO_RESOLUTION_H == 1080
        assert config.VIDEO_FPS == 30


class TestConfigSecrets:
    def test_secret_key_is_set(self):
        import config
        assert config.SECRET_KEY and config.SECRET_KEY != ""

    def test_superuser_email_is_set(self):
        import config
        assert "@" in config.SUPERUSER_EMAIL

    def test_redis_url_has_correct_scheme(self):
        import config
        assert config.REDIS_URL.startswith("redis://")
