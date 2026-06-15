"""
AutoVid — Auto Reply Service

Rules:
- Runs ONCE per day (not every 2 hours)
- Only replies to comments that have NO existing reply from our channel
- Checks YouTube directly for existing replies (not just in-memory)
- Persists replied IDs to disk so container restarts don't cause duplicates
- Stops for 24h on any quota error
- Respects frontend on/off toggle
"""
import json
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import config
import database as db

GROQ_MODEL            = "llama-3.3-70b-versatile"
RUN_HOUR_UTC          = 10          # run once daily at 10:00 AM UTC
QUOTA_BACKOFF_SECONDS = 86400       # 24h backoff on quota error
REPLIED_IDS_FILE      = Path("./auto_reply_state.json")

_quota_exceeded_until: float = 0.0
_lock                        = threading.Lock()
_scheduler_started           = False   # prevent double-start


# ── Persistence ───────────────────────────────────────────────────────────────

def _load_state() -> dict:
    """Load persisted state: {replied_ids: [], last_run_date: 'YYYY-MM-DD'}"""
    if REPLIED_IDS_FILE.exists():
        try:
            return json.loads(REPLIED_IDS_FILE.read_text())
        except Exception:
            pass
    return {"replied_ids": [], "last_run_date": None}


def _save_state(state: dict):
    try:
        REPLIED_IDS_FILE.write_text(json.dumps(state, indent=2))
    except Exception as e:
        print(f"⚠️  Could not save auto-reply state: {e}")


def _already_replied(thread_id: str, state: dict) -> bool:
    return thread_id in state.get("replied_ids", [])


def _mark_replied(thread_id: str, state: dict):
    if thread_id not in state["replied_ids"]:
        state["replied_ids"].append(thread_id)


def _already_ran_today(state: dict) -> bool:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return state.get("last_run_date") == today


# ── Quota ─────────────────────────────────────────────────────────────────────

def _set_quota_backoff():
    global _quota_exceeded_until
    with _lock:
        _quota_exceeded_until = time.time() + QUOTA_BACKOFF_SECONDS
    resume = datetime.fromtimestamp(
        _quota_exceeded_until, tz=timezone.utc
    ).strftime("%Y-%m-%d %H:%M UTC")
    print(f"⏸️  Auto-reply paused 24h — quota exceeded. Resumes: {resume}")


def _quota_backed_off() -> bool:
    with _lock:
        return time.time() < _quota_exceeded_until


def _is_quota_error(e: Exception) -> bool:
    err = str(e).lower()
    return any(k in err for k in [
        "quotaexceeded", "quota_exceeded", "uploadlimitexceeded",
        "ratelimitexceeded", "dailylimitexceeded",
        "exceeded your", "httperror 403", " 403 ",
    ])


# ── Reply generation ──────────────────────────────────────────────────────────

def _generate_reply(video_title: str, comment_text: str, author_name: str) -> str:
    import groq as groq_sdk
    client = groq_sdk.Groq(api_key=config.GROQ_API_KEY)

    system_prompt = """You are the creator of a YouTube channel about grief, loss, love and the meaning of life.
Your tone is warm, genuine, deeply human — never corporate or robotic.

Rules:
- Address the commenter by their first name if it looks like a real name (skip if it's a handle like xXgamer99)
- Keep replies to 1-3 sentences max
- Never start with "Thank you for" or "Thanks for your comment"
- Meet emotional comments with gentleness
- Answer questions briefly if asked
- No hashtags, no emojis, no mention of AI"""

    prompt = f'Video: "{video_title}"\nCommenter: "{author_name}"\nComment: "{comment_text}"\n\nWrite the reply:'
    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": prompt},
        ],
        max_tokens=120,
        temperature=0.85,
    )
    return resp.choices[0].message.content.strip().strip('"')


# ── Main cycle ────────────────────────────────────────────────────────────────

def run_reply_cycle(force: bool = False):
    """
    Process unreplied comments across all posted videos.
    Runs at most once per day unless force=True.
    """
    # Check toggle — read directly from DB so restart state is always respected
    try:
        import database as _db
        val = _db.get_setting("auto_reply_enabled", default="true")
        if str(val).lower() in ("false", "0", "no"):
            print("💬 Auto-reply disabled (DB setting) — skipping cycle")
            return
    except Exception:
        pass  # if DB unavailable, proceed

    # Check quota backoff
    if _quota_backed_off():
        remaining_h = int((_quota_exceeded_until - time.time()) / 3600)
        print(f"⏸️  Auto-reply quota backoff active ({remaining_h}h remaining) — skipping")
        return

    # Load persistent state
    state = _load_state()

    # Only run once per day (unless forced via manual trigger)
    if not force and _already_ran_today(state):
        print("💬 Auto-reply already ran today — skipping")
        return

    print(f"\n{'='*50}")
    print(f"[AUTO-REPLY] Daily cycle starting — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"{'='*50}")

    try:
        from pipeline.youtube_uploader import get_video_comments, reply_to_comment
    except ImportError:
        print("⚠️  Auto-reply: YouTube uploader not available")
        return

    # Get our own channel ID to detect self-replies
    our_channel_id = getattr(config, "YOUTUBE_CHANNEL_ID", "").strip()

    videos = db.list_videos(status="posted")
    if not videos:
        print("💬 No posted videos — nothing to reply to")
        return

    replied_count = 0
    skipped_already_replied = 0

    for video in videos:
        if not video.get("youtube_id"):
            continue

        try:
            comments = get_video_comments(video["youtube_id"])
        except Exception as e:
            if _is_quota_error(e):
                _set_quota_backoff()
                _save_state(state)
                return
            print(f"⚠️  Could not fetch comments for '{video.get('title','?')[:30]}': {e}")
            continue

        for comment in comments:
            thread_id  = comment.get("id")
            text       = comment.get("text", "").strip()
            author     = comment.get("author", "")
            author_id  = comment.get("author_channel_id", "")
            existing   = comment.get("existing_reply_authors", set())

            if not thread_id or not text:
                continue

            # Skip if we already replied (persisted state)
            if _already_replied(thread_id, state):
                skipped_already_replied += 1
                continue

            # Skip own channel's top-level comments
            if our_channel_id and author_id == our_channel_id:
                _mark_replied(thread_id, state)
                continue

            # Skip if our channel already has a reply in this thread (YouTube check)
            if our_channel_id and our_channel_id in existing:
                _mark_replied(thread_id, state)
                skipped_already_replied += 1
                continue

            # Skip very short/spam comments
            if len(text) < 4:
                _mark_replied(thread_id, state)
                continue

            try:
                reply_text = _generate_reply(video.get("title", ""), text, author)
                reply_to_comment(thread_id, reply_text)
                _mark_replied(thread_id, state)
                replied_count += 1
                print(f"💬 Replied to {author}: {reply_text[:70]}...")
                time.sleep(2)   # gentle pacing
            except Exception as e:
                if _is_quota_error(e):
                    _set_quota_backoff()
                    _save_state(state)
                    return
                print(f"⚠️  Reply failed for {thread_id[:12]}: {e}")

    # Mark today as done and save state
    state["last_run_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    _save_state(state)

    print(f"✅ Auto-reply cycle complete — {replied_count} replied, {skipped_already_replied} already answered")
    print(f"{'='*50}\n")


# ── Scheduler ─────────────────────────────────────────────────────────────────

def start_reply_scheduler():
    """Start the background scheduler. Runs the cycle once at RUN_HOUR_UTC each day."""
    global _scheduler_started
    if _scheduler_started:
        print("⚠️  Auto-reply scheduler already running — not starting again")
        return
    _scheduler_started = True

    def _loop():
        print(f"💬 Auto-reply scheduler started — runs daily at {RUN_HOUR_UTC}:00 UTC")
        time.sleep(60)   # wait 1 min after startup before first check
        while True:
            try:
                now = datetime.now(timezone.utc)
                if now.hour == RUN_HOUR_UTC:
                    run_reply_cycle()
                    # Sleep 61 min to avoid re-triggering within the same hour
                    time.sleep(3660)
                else:
                    # Check every 10 minutes whether it's time
                    time.sleep(600)
            except Exception as e:
                print(f"⚠️  Auto-reply scheduler error: {e}")
                time.sleep(600)

    t = threading.Thread(target=_loop, daemon=True)
    t.start()
