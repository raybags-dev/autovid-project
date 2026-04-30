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
            # Normalize gTTS speed — gTTS runs ~12% faster than natural narration
            _tmp = mp3_path.with_suffix(".speed_tmp.mp3")
            subprocess.run([
                "ffmpeg", "-y", "-i", str(mp3_path),
                "-af", "atempo=0.88",
                "-q:a", "3", str(_tmp),
            ], capture_output=True)
            if _tmp.exists() and _tmp.stat().st_size > 0:
                _tmp.replace(mp3_path)
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


# ── Audio Normalisation ───────────────────────────────────────────────────────

def _normalize_audio(mp3_path: Path) -> None:
    """
    Flatten dynamic range of a synthesized narration file in-place using FFmpeg.

    ElevenLabs applies its own gain envelope: voice starts quiet, builds to a
    louder steady state, then fades at the end.  dynaudnorm corrects this by
    measuring the peak of each short frame and amplifying/attenuating so every
    frame reaches the same target peak — essentially locking the whole track at
    whatever level the loudest (mid-sentence) section was sitting at.

    Parameters chosen for speech:
      f=200   — 200 ms analysis frame  (short enough to catch buildup, long
                  enough not to react to individual plosives)
      g=11    — Gaussian smoothing window of 11 frames (~2 s) so transitions
                  between gain adjustments are gradual rather than jumpy
      p=0.95  — target peak 95 % of full scale (leaves 0.5 dB headroom)
      m=5.0   — maximum allowed amplification factor (5× = +14 dB) — prevents
                  near-silence sections from being boosted into noise
      r=0.0   — peak-based (not RMS) so the measurement tracks instantaneous
                  loudness rather than average power
    """
    tmp = mp3_path.with_suffix(".norm_tmp.mp3")
    result = subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(mp3_path),
            "-af", "dynaudnorm=f=200:g=11:p=0.95:m=5.0:r=0.0,volume=0.95",
            "-acodec", "libmp3lame", "-b:a", "128k",
            str(tmp),
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"⚠️  Audio normalisation failed — keeping original audio\n   {result.stderr[-200:]}")
        tmp.unlink(missing_ok=True)
        return
    tmp.replace(mp3_path)
    print("🎚️  Audio normalised (dynaudnorm — uniform volume throughout)")


# ── Chunked Synthesis Helpers ─────────────────────────────────────────────────

def _split_into_chunks(text: str, max_words: int = 500) -> list:
    """
    Split text into chunks of at most max_words, preferring sentence boundaries.
    Returns a list of text strings.
    """
    words = text.split()
    if len(words) <= max_words:
        return [text]

    chunks = []
    current = []
    for word in words:
        current.append(word)
        # Split at sentence boundary once we've hit the word limit
        if len(current) >= max_words and current[-1] and current[-1][-1] in ".!?…":
            chunks.append(" ".join(current))
            current = []

    if current:
        # Merge a tiny trailing fragment into the previous chunk to avoid a very short final chunk
        if chunks and len(current) < 50:
            chunks[-1] = chunks[-1] + " " + " ".join(current)
        else:
            chunks.append(" ".join(current))

    return chunks or [text]


def _is_dev_tts_mode() -> bool:
    """Check if dev TTS mode is enabled (skips ElevenLabs, uses gTTS instead)."""
    try:
        import database as _db
        return str(_db.get_setting("dev_tts_mode", "false")).lower() == "true"
    except Exception:
        return False


def _get_active_voice_id() -> str:
    """Return the currently selected ElevenLabs voice ID from DB settings, falling back to config."""
    try:
        import database as _db
        voice_id = _db.get_setting("elevenlabs_active_voice_id", None)
        if voice_id:
            return voice_id
    except Exception:
        pass
    return getattr(config, "DEFAULT_ELEVENLABS_VOICE_ID", None) or config.ELEVENLABS_VOICE_ID


def _synthesize_chunk(text: str, mp3_path: Path) -> bool:
    """
    Try the full TTS fallback chain for a single text chunk.
    Returns True on success.
    """
    if _is_dev_tts_mode():
        print("🛠️  [DEV MODE] Skipping ElevenLabs — using gTTS (dev_tts_mode=true)")
        if _synthesize_gtts(text, mp3_path):
            return True
        return _synthesize_pyttsx3(text, mp3_path)

    default_voice = _get_active_voice_id()
    if _synthesize_elevenlabs(text, mp3_path, voice_id=default_voice):
        return True
    print(f"🔄 Trying fallback ElevenLabs voice: {ELEVENLABS_FALLBACK_VOICE_ID}")
    if _synthesize_elevenlabs(text, mp3_path, voice_id=ELEVENLABS_FALLBACK_VOICE_ID):
        return True
    if _synthesize_gtts(text, mp3_path):
        return True
    if _synthesize_pyttsx3(text, mp3_path):
        return True
    return False


def _concat_audio_chunks(chunk_paths: list, output_path: Path) -> None:
    """Concatenate MP3 chunk files into a single output file via FFmpeg concat demuxer."""
    if len(chunk_paths) == 1:
        import shutil
        shutil.copy2(chunk_paths[0], output_path)
        return

    list_file = output_path.with_suffix(".concat_list.txt")
    try:
        with open(list_file, "w") as f:
            for p in chunk_paths:
                f.write(f"file '{Path(p).absolute()}'\n")

        result = subprocess.run([
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(list_file),
            "-acodec", "libmp3lame", "-b:a", "128k",
            str(output_path),
        ], capture_output=True)

        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg concat failed: {result.stderr.decode()[-300:]}")
    finally:
        list_file.unlink(missing_ok=True)


# ── Main Synthesis ────────────────────────────────────────────────────────────

def synthesize(text: str, video_id: str) -> dict:
    """
    Synthesize speech from text, splitting into ≤500-word chunks when the input
    is large.  Each chunk is synthesized with the full fallback chain
    (ElevenLabs → gTTS → pyttsx3); failed chunks are skipped and a warning is
    printed.  Successful chunks are concatenated into a single MP3.

    Returns {"path": str, "duration": float}
    """
    mp3_path   = config.AUDIO_OUTPUT_DIR / f"{video_id}.mp3"
    clean_text = _clean_script(text)

    chunks = _split_into_chunks(clean_text, max_words=500)
    print(f"🔤 Text split into {len(chunks)} chunk(s) ({len(clean_text.split())} words total)")

    if len(chunks) == 1:
        # Fast path — no chunking needed
        success = _synthesize_chunk(clean_text, mp3_path)
        if not success or not mp3_path.exists() or mp3_path.stat().st_size == 0:
            raise RuntimeError(
                "All TTS engines failed.\n"
                "ElevenLabs: check quota at elevenlabs.io\n"
                "gTTS: run 'pip install gtts' in your venv\n"
            )
    else:
        # Multi-chunk path — synthesize each chunk, skip failures
        chunk_paths = []
        for i, chunk in enumerate(chunks):
            chunk_path = config.AUDIO_OUTPUT_DIR / f"{video_id}_chunk{i:02d}.mp3"
            print(f"🔤 Synthesizing chunk {i + 1}/{len(chunks)} ({len(chunk.split())} words)...")
            try:
                if _synthesize_chunk(chunk, chunk_path):
                    chunk_paths.append(chunk_path)
                else:
                    print(f"⚠️  Chunk {i + 1} synthesis failed — skipping")
            except Exception as e:
                print(f"⚠️  Chunk {i + 1} error, skipping: {e}")

        if not chunk_paths:
            raise RuntimeError("All TTS chunks failed — no audio produced.")

        print(f"🔗 Concatenating {len(chunk_paths)}/{len(chunks)} chunks...")
        _concat_audio_chunks(chunk_paths, mp3_path)
        for p in chunk_paths:
            Path(p).unlink(missing_ok=True)

    # Flatten ElevenLabs gain envelope — locks every part of the track to the
    # same loudness so there is no quiet intro / loud middle / quiet outro.
    _normalize_audio(mp3_path)

    duration = _get_audio_duration(mp3_path)
    size_kb  = mp3_path.stat().st_size / 1024
    print(f"🎵 Audio ready: {mp3_path.name} ({duration:.1f}s, {size_kb:.0f}KB)")
    return {"path": str(mp3_path), "duration": duration}


# ── Audio Duration Fitting ────────────────────────────────────────────────────

def fit_audio_to_duration(audio_path: str, target_duration: float) -> float:
    """
    Speed up audio to fit within target_duration seconds using FFmpeg atempo filter.
    atempo range is 0.5–2.0; for speed > 2.0 we chain two filters.
    Returns the new actual duration.
    """
    p = Path(audio_path)
    actual = _get_audio_duration(p)
    if actual <= target_duration:
        return actual

    speed = actual / target_duration
    print(f"⚡ Audio is {actual:.1f}s — speeding up {speed:.2f}x to fit {target_duration:.0f}s")

    # Build atempo filter chain (each atempo must be 0.5–2.0)
    filters = []
    remaining = speed
    while remaining > 2.0:
        filters.append("atempo=2.0")
        remaining /= 2.0
    filters.append(f"atempo={remaining:.4f}")
    af = ",".join(filters)

    tmp = p.with_suffix(".speed_tmp.mp3")
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", str(p), "-af", af,
         "-acodec", "libmp3lame", "-b:a", "192k", str(tmp)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"⚠️  atempo failed: {result.stderr[-200:]} — using original")
        return actual

    tmp.replace(p)
    new_dur = _get_audio_duration(p)
    print(f"✅ Audio fitted: {actual:.1f}s → {new_dur:.1f}s")
    return new_dur


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
