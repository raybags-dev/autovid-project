"""
AutoVid — Auto Reply Service
For every posted video that has unread comments, posts one AI-generated
reply per comment thread. Runs on a schedule every 2 hours.
"""
import time
import threading
from datetime import datetime, timezone
import database as db
import config

GROQ_MODEL = "llama-3.3-70b-versatile"
CHECK_INTERVAL_SECONDS = 7200   # every 2 hours
ACTIVE_HOURS = (8, 23)          # only reply between 8 AM – 11 PM UTC

# Track which comment IDs we've already replied to so we don't double-reply
_replied_ids: set = set()
_lock = threading.Lock()


def _already_replied(comment_id: str) -> bool:
    with _lock:
        return comment_id in _replied_ids


def _mark_replied(comment_id: str):
    with _lock:
        _replied_ids.add(comment_id)


def _within_active_hours() -> bool:
    hour = datetime.now(timezone.utc).hour
    return ACTIVE_HOURS[0] <= hour < ACTIVE_HOURS[1]


def _generate_reply(video_title: str, comment_text: str) -> str:
    """Use Groq to generate a warm, authentic reply to a comment."""
    import groq as groq_sdk
    client = groq_sdk.Groq(api_key=config.GROQ_API_KEY)

    system_prompt = """You are the creator of a YouTube channel focused on grief, loss, love, 
and the meaning of life. Your tone is warm, genuine, and deeply human — never corporate or 
robotic. You reply to comments as yourself: present, caring, and real.

Rules:
- Keep replies to 1-3 sentences max
- Never start with "Thank you for" or "Thanks for your comment"
- Sound like a real person, not a brand
- If the comment is emotional or vulnerable, meet them there gently
- If the comment asks a question, answer it briefly or acknowledge it
- Never use hashtags or emojis in replies
- Never mention AI or that you are automated"""

    prompt = f"""Video title: "{video_title}"

Comment from viewer: "{comment_text}"

Write a single genuine reply from the creator. No preamble, just the reply text."""

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


def run_reply_cycle():
    """Check all posted videos for unreplied comments and reply to them."""
    if not _within_active_hours():
        print("💬 Auto-reply: outside active hours, skipping")
        return

    try:
        from pipeline.youtube_uploader import get_video_comments, reply_to_comment
    except ImportError:
        print("⚠️  Auto-reply: YouTube uploader not available")
        return

    videos = db.list_videos(status="posted")
    if not videos:
        return

    replied_count = 0

    for video in videos:
        if not video.get("youtube_id"):
            continue

        try:
            comments = get_video_comments(video["youtube_id"])
        except Exception as e:
            print(f"⚠️  Could not fetch comments for {video['id'][:8]}: {e}")
            continue

        for comment in comments:
            thread_id  = comment.get("id")
            comment_id = comment.get("id")
            text       = comment.get("text", "").strip()
            author     = comment.get("author", "")

            if not thread_id or not text:
                continue

            # Skip if we've already replied
            if _already_replied(comment_id):
                continue

            # Skip if comment is from the channel owner (don't reply to yourself)
            channel_id = getattr(config, "YOUTUBE_CHANNEL_ID", "")
            author_id  = comment.get("author_channel_id", "")
            if channel_id and author_id and author_id == channel_id:
                _mark_replied(comment_id)
                continue

            # Skip very short spam-like comments
            if len(text) < 4:
                _mark_replied(comment_id)
                continue

            try:
                reply_text = _generate_reply(video.get("title", ""), text)
                reply_to_comment(thread_id, reply_text)
                _mark_replied(comment_id)
                replied_count += 1
                print(f"💬 Replied to comment on '{video.get('title','?')[:40]}': {reply_text[:60]}...")
                time.sleep(3)  # be gentle with the API
            except Exception as e:
                print(f"⚠️  Reply failed for comment {comment_id[:12]}: {e}")

    if replied_count:
        print(f"✅ Auto-reply cycle complete — {replied_count} replies posted")
    else:
        print("💬 Auto-reply cycle complete — no new comments to reply to")


def start_reply_scheduler():
    """Start the background reply scheduler thread."""
    def _loop():
        # Wait 5 min after startup before first run
        time.sleep(300)
        while True:
            try:
                run_reply_cycle()
            except Exception as e:
                print(f"⚠️  Auto-reply scheduler error: {e}")
            time.sleep(CHECK_INTERVAL_SECONDS)

    t = threading.Thread(target=_loop, daemon=True)
    t.start()
    print(f"💬 Auto-reply scheduler started (checks every 2h, active hours: {ACTIVE_HOURS[0]}:00–{ACTIVE_HOURS[1]}:00 UTC)")