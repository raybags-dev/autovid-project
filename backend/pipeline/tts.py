"""
AutoVid Pipeline — Step 2: Text-to-Speech
Primary: ElevenLabs (high quality)
Fallback: gTTS (Google TTS — free, no quota, no API key needed)

When ElevenLabs quota is exceeded, automatically falls back to gTTS
so the pipeline never fully fails due to credit limits.
"""
import sys
import os
import re
import subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import config

# Fallback ElevenLabs voice ID — used if primary voice is not found
# Voice chain: DEFAULT (rUwfJCzlNVSupX1xyzzX) → FALLBACK (NFG5qt843uXKj4pFvR7C) → gTTS → pyttsx3
ELEVENLABS_FALLBACK_VOICE_ID = "NFG5qt843uXKj4pFvR7C"


# ── Script Cleaning ───────────────────────────────────────────────────────────

def _clean_script(text: str) -> str:
    text = text.replace("[PAUSE]", "...")
    text = re.sub(r"\[.*?\]", "", text)
    text = re.sub(r"\.{4,}", "...", text)
    text = re.sub(r"  +", " ", text)
    return text.strip()


# ── ElevenLabs ────────────────────────────────────────────────────────────────

def _synthesize_elevenlabs(text: str, mp3_path: Path, voice_id: str = None) -> bool:
    """
    Try ElevenLabs synthesis. Returns True on success, False on quota/auth/voice error.
    voice_id: override the default voice — used for fallback voice attempt.
    """
    if not config.ELEVENLABS_API_KEY:
        print("⚠️  No ELEVENLABS_API_KEY — skipping ElevenLabs")
        return False

    _voice_id = voice_id or config.ELEVENLABS_VOICE_ID

    try:
        from elevenlabs.client import ElevenLabs
        from elevenlabs import VoiceSettings
        from elevenlabs.core.api_error import ApiError

        client = ElevenLabs(api_key=config.ELEVENLABS_API_KEY)

        print(f"🎙️  [ElevenLabs] Synthesizing {len(text)} chars...")
        print(f"   Voice ID : {_voice_id}")

        audio = client.text_to_speech.convert(
            text=text,
            voice_id=_voice_id,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
            voice_settings=VoiceSettings(
                stability=0.80,
                similarity_boost=0.90,
                style=0.0,
                use_speaker_boost=True,
            ),
        )

        # Consume generator inside try — ApiError raises here, not above
        audio_bytes = b""
        for chunk in audio:
            if isinstance(chunk, bytes):
                audio_bytes += chunk

        with open(mp3_path, "wb") as f:
            f.write(audio_bytes)

        if mp3_path.exists() and mp3_path.stat().st_size > 0:
            print("✅ ElevenLabs synthesis successful")
            return True
        return False

    except Exception as e:
        err_str = str(e).lower()
        # Catch quota, auth, and billing errors — fall back gracefully
        if any(k in err_str for k in ["quota_exceeded", "quota", "401", "402", "insufficient"]):
            print(f"⚠️  ElevenLabs unavailable ({len(text)} chars needed) — switching to free TTS")
            print(f"   Reason: {str(e)[:120]}")
            # Clean up empty file if created
            if mp3_path.exists() and mp3_path.stat().st_size == 0:
                mp3_path.unlink(missing_ok=True)
            return False
        # Unexpected error — still fall back rather than crash pipeline
        print(f"⚠️  ElevenLabs unexpected error: {e} — switching to free TTS")
        return False


# ── gTTS Fallback ─────────────────────────────────────────────────────────────

def _synthesize_gtts(text: str, mp3_path: Path) -> bool:
    """
    Free fallback using Google Text-to-Speech (gTTS).
    No API key, no quota. Requires: pip install gtts
    Quality is lower than ElevenLabs but perfectly usable.
    """
    try:
        from gtts import gTTS
        print(f"🎙️  [gTTS fallback] Synthesizing {len(text)} chars (free, no quota)...")
        tts = gTTS(text=text, lang="en", slow=False)
        tts.save(str(mp3_path))
        if mp3_path.exists() and mp3_path.stat().st_size > 0:
            print("✅ gTTS synthesis successful")
            return True
        return False
    except ImportError:
        print("❌ gTTS not installed — run: pip install gtts")
        return False
    except Exception as e:
        print(f"❌ gTTS failed: {e}")
        return False


# ── pyttsx3 Final Fallback ────────────────────────────────────────────────────

def _synthesize_pyttsx3(text: str, mp3_path: Path) -> bool:
    """Last resort: system TTS via pyttsx3 → wav → mp3 conversion."""
    try:
        import pyttsx3
        wav_path = mp3_path.with_suffix(".wav")
        engine = pyttsx3.init()
        engine.setProperty("rate", 165)   # words per minute
        engine.setProperty("volume", 0.9)
        engine.save_to_file(text, str(wav_path))
        engine.runAndWait()
        if wav_path.exists() and wav_path.stat().st_size > 0:
            # Convert wav → mp3
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(wav_path), "-q:a", "2", str(mp3_path)],
                capture_output=True
            )
            wav_path.unlink(missing_ok=True)
            if mp3_path.exists() and mp3_path.stat().st_size > 0:
                print("✅ pyttsx3 synthesis successful")
                return True
    except Exception as e:
        print(f"❌ pyttsx3 failed: {e}")
    return False


# ── Main Synthesis ────────────────────────────────────────────────────────────

def synthesize(text: str, video_id: str) -> dict:
    """
    Synthesize speech with automatic fallback chain:
      1. ElevenLabs (best quality)
      2. gTTS (free, good quality)
      3. pyttsx3 (system TTS, last resort)

    Returns {"path": str, "duration": float}
    """
    mp3_path   = config.AUDIO_OUTPUT_DIR / f"{video_id}.mp3"
    clean_text = _clean_script(text)

    # Voice chain: DEFAULT → FALLBACK → gTTS → pyttsx3
    default_voice = getattr(config, "DEFAULT_ELEVENLABS_VOICE_ID", None) or config.ELEVENLABS_VOICE_ID
    success = _synthesize_elevenlabs(clean_text, mp3_path, voice_id=default_voice)

    # Try fallback ElevenLabs voice before dropping to free TTS
    if not success:
        print(f"🔄 Trying fallback ElevenLabs voice: {ELEVENLABS_FALLBACK_VOICE_ID}")
        success = _synthesize_elevenlabs(clean_text, mp3_path, voice_id=ELEVENLABS_FALLBACK_VOICE_ID)

    # Fallback to gTTS
    if not success:
        success = _synthesize_gtts(clean_text, mp3_path)

    # Final fallback to system TTS
    if not success:
        success = _synthesize_pyttsx3(clean_text, mp3_path)

    if not success or not mp3_path.exists() or mp3_path.stat().st_size == 0:
        raise RuntimeError(
            "All TTS engines failed.\n"
            "ElevenLabs: check quota at elevenlabs.io\n"
            "gTTS: run 'pip install gtts' in your venv\n"
        )

    duration = _get_audio_duration(mp3_path)
    size_kb  = mp3_path.stat().st_size / 1024
    print(f"🎵 Audio ready: {mp3_path.name} ({duration:.1f}s, {size_kb:.0f}KB)")
    return {"path": str(mp3_path), "duration": duration}


# ── Segment Timing ────────────────────────────────────────────────────────────

def align_segments_to_audio(script_data: dict, audio_path: str) -> list:
    total_duration = _get_audio_duration(Path(audio_path))
    if total_duration <= 0:
        raise RuntimeError(f"Could not read audio duration: {audio_path}")

    first_query = script_data["segments"][0]["visual_query"] if script_data["segments"] else ""
    all_segments = (
        [{"text": script_data["hook"], "visual_query": first_query}]
        + [{"text": s["text"], "visual_query": s.get("visual_query", "")} for s in script_data["segments"]]
        + [{"text": script_data["outro"], "visual_query": ""}]
    )

    total_words      = sum(len(s["text"].split()) for s in all_segments)
    words_per_second = total_words / total_duration if total_duration > 0 else 2.5

    timed, current = [], 0.0
    for seg in all_segments:
        wc       = len(seg["text"].split())
        duration = round(wc / words_per_second, 2)
        timed.append({
            "text":         seg["text"],
            "visual_query": seg.get("visual_query", ""),
            "start":        round(current, 2),
            "end":          round(current + duration, 2),
            "duration":     duration,
        })
        current += duration

    print(f"⏱️  Aligned {len(timed)} segments over {total_duration:.1f}s")
    return timed


# ── Quota & Voices ────────────────────────────────────────────────────────────

def check_quota() -> dict:
    if not config.ELEVENLABS_API_KEY:
        return {"error": "No API key set"}
    try:
        from elevenlabs.client import ElevenLabs
        client = ElevenLabs(api_key=config.ELEVENLABS_API_KEY)
        user = client.user.get()
        sub  = user.subscription
        used  = sub.character_count
        limit = sub.character_limit
        remaining = limit - used
        status = "ok" if remaining > 500 else "low" if remaining > 0 else "exhausted"
        return {
            "chars_used":      used,
            "chars_limit":     limit,
            "chars_remaining": remaining,
            "percent_used":    round((used / limit) * 100, 1) if limit else 0,
            "tier":            sub.tier,
            "status":          status,
            "fallback_active": status == "exhausted",
        }
    except Exception as e:
        return {"error": str(e)}


def list_voices() -> list:
    if not config.ELEVENLABS_API_KEY:
        return []
    try:
        from elevenlabs.client import ElevenLabs
        client = ElevenLabs(api_key=config.ELEVENLABS_API_KEY)
        response = client.voices.get_all()
        return [{"id": v.voice_id, "name": v.name, "category": v.category or ""} for v in response.voices]
    except Exception as e:
        return []


# ── Helper ────────────────────────────────────────────────────────────────────

def _get_audio_duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True,
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0
