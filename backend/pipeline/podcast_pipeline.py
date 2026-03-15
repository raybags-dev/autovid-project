"""
AutoVid — Podcast Episode Pipeline
Generates a dedicated audio-only podcast episode:
  1. LLM generates a ~10-minute essay (~1600-1900 words)
  2. TTS narrates it (ElevenLabs → gTTS fallback)
  3. Background music mixed in at louder-than-video level (0.20)
  4. MP3 uploaded to Supabase narrations bucket
  5. DB record created with resolution="podcast"

Manual: POST /podcast-episode/generate  (title + essay_prompt + music_style)
Auto:   scheduler calls run_auto_podcast() on configured days/hour
"""
import threading
import time
import datetime
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import config
import database as db

# ── Defaults ──────────────────────────────────────────────────────────────────

DEFAULT_PODCAST_DAYS   = [2, 5]       # Wed, Sat
DEFAULT_PODCAST_HOUR   = 4            # 4 AM UTC
DEFAULT_MUSIC_STYLE    = "Birds_Atmosphere_Piano"    # calm & atmospheric, consistent with brand
PODCAST_MUSIC_VOLUME   = 0.10         # louder than video (0.10) but not distorting

DEFAULT_PODCAST_TOPICS = [
    "Why the universe remains silent when we ask it for meaning",
    "The strange freedom that comes from realizing nothing ultimately matters",
    "Why the search for meaning can quietly exhaust a lifetime",
    "Living fully in a world that never explains itself",
    "Why accepting absurdity might be the beginning of peace",
    "The quiet rebellion of continuing to live without answers",
    "Why the human mind struggles to accept a meaningless universe",
    "Growing old in a universe that was never designed for us",
    "Why time becomes more precious the closer we move toward its end",
    "The slow realization that life does not promise fairness",
    "Why the universe does not care — and why that might be liberating",
    "The courage to wake up each day in an indifferent world",
    "Why the absence of meaning can create unexpected freedom",
    "The strange comfort of knowing the universe has no expectations of you",
    "What it means to live without believing life has a purpose",
    "Why growing older reveals the quiet absurdity of existence",
    "The invisible moment when youth ends and time begins to feel finite",
    "Why the awareness of aging changes the way we see everything",
    "The strange calm that comes when you stop demanding meaning from life",
    "Why humans insist on building purpose in a purposeless universe",
    "The quiet tragedy of realizing time was always running out",
    "Why the universe continues long after every human story ends",
    "What it means to exist briefly in cosmic indifference",
    "Why accepting the absurd may be the most honest philosophy",
    "The paradox of searching for meaning in a silent universe",
    "Why we keep going even when nothing ultimately matters",
    "The philosophical weight of knowing your life is temporary",
    "Why the older we get the more fragile everything feels",
    "The strange beauty of a life that was never meant to last",
    "Why the awareness of death slowly reshapes our priorities",
    "The quiet moment when you realize life has no clear destination",
    "Why the universe offers existence but not explanation",
    "Growing older and realizing most questions remain unanswered",
    "Why meaning may be something humans invent rather than discover",
    "The existential calm that comes from letting go of ultimate answers",
    "Why the most honest response to absurdity might be laughter",
    "The quiet absurdity of planning decades ahead in a fragile life",
    "Why every human ambition eventually dissolves into time",
    "What it means to continue living despite cosmic indifference",
    "Why awareness of mortality can make ordinary moments feel profound",
    "The strange humility of realizing the universe does not notice us",
    "Why growing older slowly reveals the limits of control",
    "The silent passage of time and the illusion of permanence",
    "Why the universe keeps expanding while human lives quietly end",
    "The absurd act of caring deeply in a temporary world",
    "Why the human need for certainty can never be satisfied",
    "The strange peace found in accepting life’s unanswered questions",
    "Why aging forces us to confront the fragile nature of existence",
    "The quiet realization that life never promised meaning",
    "Why continuing to live may be the greatest act of defiance",
    "The ancient fear of the unknown — why darkness still unsettles the human mind",
    "Disappearances that science cannot explain — the cold cases that defy logic",
    "What the last moments of lost civilisations might tell us about our own",
    "Unexplained phenomena that serious researchers refuse to dismiss",
    "The psychology of conspiracy — why humans find patterns in chaos",
    "Deep ocean mysteries — the creatures and places we have yet to understand",
    "Time anomalies and glitches in reality — documented cases of impossible memories",
    "The silence of the cosmos — why the Fermi paradox haunts astronomers",
    "Sacred geometry and ancient structures that should not exist",
    "Near-death experiences across cultures — what do they actually reveal",
    "The vanishing of entire communities — historical cases that remain unsolved",
    "Dreams, premonitions, and the science that refuses to rule them out",
    "Underground civilisations — folklore, mythology, and the caves that hide secrets",
    "The nature of consciousness — the hardest problem in all of science",
    "Cryptic manuscripts and undeciphered languages that still baffle scholars",
    "The black budget — classified programmes that governments won't confirm or deny",
    "Hauntings and location-based phenomena — what physics actually says",
    "Mass hysteria or genuine experience — revisiting the strangest group events in history",
    "Portals, vortexes, and places on Earth where the rules seem different",
    "The mystery of human origins — the gaps in our evolutionary story",
    "Lost libraries and destroyed knowledge — what was burned and why",
    "Animals with impossible intelligence — documented cases that challenge our assumptions",
    "The Mandela Effect at scale — collective false memories and what they might mean",
    "Synchronicities — Carl Jung, meaningful coincidences, and the limits of probability",
    "Ancient maps that show continents before they were discovered",
]

_podcast_scheduler_started = False
_podcast_scheduler_lock    = threading.Lock()


# ── Settings ──────────────────────────────────────────────────────────────────

def get_podcast_settings() -> dict:
    """Load auto-podcast scheduler settings from DB."""
    try:
        enabled     = db.get_setting("auto_podcast_enabled",  default="false") == "true"
        days_raw    = db.get_setting("auto_podcast_days",     default=json.dumps(DEFAULT_PODCAST_DAYS))
        topics_raw  = db.get_setting("auto_podcast_topics",   default=json.dumps(DEFAULT_PODCAST_TOPICS))
        hour        = int(db.get_setting("auto_podcast_hour", default=str(DEFAULT_PODCAST_HOUR)))
        music_style = db.get_setting("auto_podcast_music",    default=DEFAULT_MUSIC_STYLE)
        return {
            "enabled":      enabled,
            "days":         json.loads(days_raw),
            "topics":       json.loads(topics_raw),
            "hour":         hour,
            "music_style":  music_style,
        }
    except Exception as e:
        print(f"⚠️  Auto-podcast: failed to load settings: {e}")
        return {
            "enabled": False, "days": DEFAULT_PODCAST_DAYS,
            "topics": DEFAULT_PODCAST_TOPICS, "hour": DEFAULT_PODCAST_HOUR,
            "music_style": DEFAULT_MUSIC_STYLE,
        }


def save_podcast_settings(settings: dict):
    """Persist auto-podcast settings to DB."""
    db.set_setting("auto_podcast_enabled",  str(settings.get("enabled", False)).lower())
    db.set_setting("auto_podcast_days",     json.dumps(settings.get("days", DEFAULT_PODCAST_DAYS)))
    db.set_setting("auto_podcast_topics",   json.dumps(settings.get("topics", DEFAULT_PODCAST_TOPICS)))
    db.set_setting("auto_podcast_hour",     str(settings.get("hour", DEFAULT_PODCAST_HOUR)))
    db.set_setting("auto_podcast_music",    settings.get("music_style", DEFAULT_MUSIC_STYLE))


# ── Topic picker ──────────────────────────────────────────────────────────────

def _pick_next_podcast_topic(topics: list) -> str:
    """Cycle through topics without repeating until exhausted."""
    try:
        used_raw = db.get_setting("auto_podcast_used_topics", default="[]")
        used = set(json.loads(used_raw))
    except Exception:
        used = set()

    available = [t for t in topics if t not in used]
    if not available:
        used = set()
        available = list(topics)
        print("🔄 Auto-podcast: all topics used, resetting")

    topic = available[0]
    used.add(topic)
    db.set_setting("auto_podcast_used_topics", json.dumps(list(used)))
    return topic


# ── Core pipeline ─────────────────────────────────────────────────────────────

def _generate_essay(topic: str) -> dict:
    """
    Use Groq to generate a ~10-minute podcast essay (~1700 words).
    Returns dict with 'title', 'description', 'essay'.
    """
    from groq import Groq
    client = Groq(api_key=config.GROQ_API_KEY)

    system = (
        "You are a master storyteller and essayist for a mystery and unknown-phenomena podcast. "
        "Your writing is atmospheric, intelligent, and deeply engaging. "
        "You write like a narrated documentary — no bullet points, no lists, "
        "pure flowing prose that listeners can absorb with their eyes closed.\n\n"
        "STRICT RULES:\n"
        "- Write exactly 1650-1900 words of narration (approximately 10-12 minutes at 160 words/minute)\n"
        "- Flowing prose paragraphs only — no headers, no lists, no markdown\n"
        "- Build tension gradually, end with reflection or open question\n"
        "- Occasional short sentences for dramatic pause\n"
        "- Use commas and ellipsis for natural pacing\n"
        "- Never use brackets, asterisks, hashtags\n\n"
        "Respond with ONLY valid JSON in this exact schema:\n"
        '{"title": "...", "description": "...", "essay": "..."}\n\n'
        "title: compelling podcast episode title (max 80 chars)\n"
        "description: 2-3 sentence episode summary for podcast directories (max 300 chars)\n"
        "essay: the full narration text (1650-1900 words)"
    )

    resp = client.chat.completions.create(
        model=config.GROQ_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": f"Write a full podcast essay about: {topic}"},
        ],
        temperature=0.82,
        max_tokens=3500,
        response_format={"type": "json_object"},
    )

    raw = resp.choices[0].message.content.strip()
    return json.loads(raw)


# ── Chunked TTS for long essays ───────────────────────────────────────────────

_EL_CHUNK_SIZE = 4500   # ElevenLabs hard limit is 5000 chars; stay safely below

def _chunk_text(text: str, max_chars: int = _EL_CHUNK_SIZE) -> list[str]:
    """
    Split text into chunks ≤ max_chars at paragraph → sentence boundaries.
    Never cuts mid-sentence.
    """
    import re
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks, current = [], ""
    for para in paragraphs:
        # If a single paragraph itself exceeds the limit, split at sentence boundaries
        if len(para) > max_chars:
            sentences = re.split(r'(?<=[.!?])\s+', para)
            for sent in sentences:
                if len(current) + len(sent) + 1 > max_chars and current:
                    chunks.append(current.strip())
                    current = sent
                else:
                    current = (current + " " + sent).strip() if current else sent
        else:
            if len(current) + len(para) + 2 > max_chars and current:
                chunks.append(current.strip())
                current = para
            else:
                current = (current + "\n\n" + para).strip() if current else para
    if current:
        chunks.append(current.strip())
    return chunks


def _synthesize_essay(essay: str, video_id: str, log_fn=None) -> str:
    """
    Synthesize a long essay using ElevenLabs by chunking into ≤4500-char pieces,
    narrating each with the configured voice, then concatenating with ffmpeg.
    Returns path to the final stitched MP3.
    """
    import subprocess
    from pipeline.tts import _synthesize_elevenlabs, _clean_script, ELEVENLABS_FALLBACK_VOICE_ID

    clean  = _clean_script(essay)
    chunks = _chunk_text(clean)

    if log_fn:
        log_fn(f"[2/5] Essay split into {len(chunks)} chunks for TTS...")

    voice_id = (
        getattr(config, "DEFAULT_ELEVENLABS_VOICE_ID", None) or config.ELEVENLABS_VOICE_ID
    )

    chunk_paths = []
    for i, chunk in enumerate(chunks, start=1):
        chunk_path = config.AUDIO_OUTPUT_DIR / f"{video_id}_chunk{i:02d}.mp3"
        if log_fn:
            log_fn(f"[2/5] Chunk {i}/{len(chunks)} — {len(chunk)} chars...")

        ok = _synthesize_elevenlabs(chunk, chunk_path, voice_id=voice_id)
        if not ok:
            # Try fallback ElevenLabs voice before giving up
            ok = _synthesize_elevenlabs(chunk, chunk_path, voice_id=ELEVENLABS_FALLBACK_VOICE_ID)
        if not ok:
            raise RuntimeError(
                f"ElevenLabs failed on chunk {i} — check quota at elevenlabs.io. "
                f"Voice ID attempted: {voice_id}"
            )
        chunk_paths.append(str(chunk_path))

    # Concatenate all chunks into one MP3 via ffmpeg concat demuxer
    out_path = config.AUDIO_OUTPUT_DIR / f"{video_id}_narration.mp3"
    if len(chunk_paths) == 1:
        import shutil
        shutil.move(chunk_paths[0], str(out_path))
    else:
        list_file = config.TEMP_DIR / f"{video_id}_chunks.txt"
        with open(list_file, "w") as f:
            for p in chunk_paths:
                f.write(f"file '{p}'\n")
        subprocess.run([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", str(list_file),
            "-c", "copy", str(out_path),
        ], capture_output=True, check=True)
        list_file.unlink(missing_ok=True)
        for p in chunk_paths:
            Path(p).unlink(missing_ok=True)

    if log_fn:
        log_fn(f"[2/5] Narration stitched: {out_path.name}")
    return str(out_path)


def run_podcast_episode(
    topic: str = None,
    title: str = None,
    essay: str = None,
    music_style: str = None,
    music_volume: float = None,
    video_id: str = None,
    push_log_fn=None,
    unregister_fn=None,
) -> str | None:
    """
    Full podcast pipeline. Returns video_id on success, None on failure.

    If essay is provided, skip LLM generation and use it directly.
    If topic is provided without essay, generate essay via LLM.
    """
    from pipeline.music_mixer import generate_music, mix_audio
    from pipeline.storage import upload_narration_to_storage

    def _log(msg: str):
        print(msg)
        if push_log_fn and video_id:
            push_log_fn(video_id, msg)

    # Create DB record if not provided
    if not video_id:
        record   = db.create_video(topic or title or "Podcast Episode")
        video_id = record["id"]

    try:
        # ── Step 1: Generate essay ─────────────────────────────────────────────
        if essay:
            _log("[1/5] Using provided essay...")
            ep_title = title or "Podcast Episode"
            ep_desc  = ""
            ep_essay = essay
        else:
            _log(f"[1/5] Generating essay for: {topic or title}...")
            data     = _generate_essay(topic or title)
            ep_title = title or data.get("title", "Podcast Episode")
            ep_essay = data.get("essay", "")
            # Append promotion footer
            from pipeline.script_gen import _append_promo_footer
            ep_desc  = _append_promo_footer(data.get("description", ""), title=ep_title)

        if not ep_essay.strip():
            raise RuntimeError("Essay generation returned empty content")

        word_count = len(ep_essay.split())
        _log(f"[1/5] Essay ready: {word_count} words (~{word_count//160} min)")

        # Update DB with title/description early
        db.update_video(video_id,
                        title=ep_title,
                        description=ep_desc,
                        prompt=topic or title or ep_title,
                        status="scripted")

        # ── Step 2: TTS narration (chunked — avoids ElevenLabs 5000-char limit) ─
        raw_mp3_path = _synthesize_essay(ep_essay, video_id, log_fn=_log)
        _log(f"[2/5] Narration done: {Path(raw_mp3_path).name}")
        db.update_video(video_id, status="voiced")

        # ── Step 3: Background music ───────────────────────────────────────────
        chosen_style = music_style or DEFAULT_MUSIC_STYLE
        _log(f"[3/5] Generating {chosen_style} background music...")
        music_path = generate_music(chosen_style, _get_duration(raw_mp3_path) + 10, video_id)

        vol = music_volume if music_volume is not None else PODCAST_MUSIC_VOLUME
        mixed_mp3 = config.AUDIO_OUTPUT_DIR / f"{video_id}_podcast.mp3"
        mix_audio(raw_mp3_path, music_path, str(mixed_mp3), music_volume=vol)
        _log(f"[3/5] Music mixed at {int(vol*100)}% — {mixed_mp3.name}")
        db.update_video(video_id, status="assembled")

        # ── Step 4: Upload to Supabase ─────────────────────────────────────────
        _log("[4/5] Uploading to Supabase Storage...")
        narration_url = upload_narration_to_storage(
            str(mixed_mp3), video_id,
            filename=f"{video_id}_podcast.mp3",
        )
        _log(f"[4/5] Uploaded: {narration_url}")

        # ── Step 5: Finalize DB record ─────────────────────────────────────────
        _log("[5/5] Saving podcast episode record...")
        dur = _get_duration(str(mixed_mp3))
        db.update_video(video_id,
                        narration_url=narration_url,
                        duration_seconds=int(dur),
                        resolution="podcast",   # marker: not a short, not a video
                        status="ready")

        _log(f"[5/5] Podcast episode ready: {ep_title} ({dur:.0f}s)")

        # ── Optional: auto-upload to Podbean ──────────────────────────────────
        try:
            from pipeline.podbean_client import get_podbean_settings, upload_podcast_episode as pb_upload, is_configured as pb_configured
            if pb_configured() and get_podbean_settings().get("auto_upload"):
                _log("[PODBEAN] Auto-uploading to Podbean...")
                pb_upload(video_id, log_fn=_log)
        except Exception as pb_err:
            _log(f"[PODBEAN] ⚠ Auto-upload failed (episode still saved locally): {pb_err}")

        # ── Optional: auto-upload to Buzzsprout ───────────────────────────────
        try:
            from pipeline.buzzsprout_client import get_buzzsprout_settings, upload_podcast_episode as bz_upload, is_configured as bz_configured
            if bz_configured() and get_buzzsprout_settings().get("auto_upload"):
                _log("[BUZZSPROUT] Auto-uploading to Buzzsprout...")
                bz_upload(video_id, log_fn=_log)
        except Exception as bz_err:
            _log(f"[BUZZSPROUT] ⚠ Auto-upload failed (episode still saved locally): {bz_err}")

        _log(f"[DONE] Podcast pipeline complete.")
        return video_id

    except Exception as e:
        print(f"❌ Podcast pipeline failed: {e}")
        db.update_video(video_id, status="failed", error_message=str(e))
        return None
    finally:
        if unregister_fn and video_id:
            try:
                unregister_fn(video_id)
            except Exception:
                pass


def _get_duration(mp3_path: str) -> float:
    """Return duration in seconds via ffprobe."""
    import subprocess
    try:
        out = subprocess.check_output([
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_streams", mp3_path,
        ], stderr=subprocess.DEVNULL)
        info = json.loads(out)
        for s in info.get("streams", []):
            if s.get("duration"):
                return float(s["duration"])
    except Exception:
        pass
    return 0.0


# ── Auto-podcast scheduler ────────────────────────────────────────────────────

def run_auto_podcast(push_log_fn=None, unregister_fn=None) -> str | None:
    """Trigger one auto-generated podcast episode."""
    settings = get_podcast_settings()
    topics   = settings.get("topics", DEFAULT_PODCAST_TOPICS)
    music    = settings.get("music_style", DEFAULT_MUSIC_STYLE)

    if not topics:
        print("⚠️  Auto-podcast: no topics configured")
        return None

    topic = _pick_next_podcast_topic(topics)
    print(f"🎙  Auto-podcast: '{topic}'")

    record   = db.create_video(f"[Podcast] {topic}")
    video_id = record["id"]

    return run_podcast_episode(
        topic=topic,
        music_style=music,
        video_id=video_id,
        push_log_fn=push_log_fn,
        unregister_fn=unregister_fn,
    )


def start_podcast_scheduler():
    """Start background scheduler for auto-podcast generation. Call once on startup."""
    global _podcast_scheduler_started
    with _podcast_scheduler_lock:
        if _podcast_scheduler_started:
            return
        _podcast_scheduler_started = True

    def _loop():
        print("🕐 Auto-podcast scheduler started")
        while True:
            try:
                settings = get_podcast_settings()
                if settings["enabled"]:
                    now = datetime.datetime.utcnow()
                    if (now.weekday() in settings["days"] and
                            now.hour == settings["hour"] and
                            now.minute < 5):
                        last  = db.get_setting("auto_podcast_last_run", default="")
                        today = now.strftime("%Y-%m-%d")
                        if last != today:
                            db.set_setting("auto_podcast_last_run", today)
                            t = threading.Thread(target=run_auto_podcast, daemon=True)
                            t.start()
            except Exception as e:
                print(f"⚠️  Auto-podcast scheduler error: {e}")
            time.sleep(240)

    threading.Thread(target=_loop, daemon=True).start()
