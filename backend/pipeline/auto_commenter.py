"""
AutoVid — Auto Comment Service
Posts 4-5 AI-generated comments per video per day, spread randomly across the day.
Comments simulate different viewer personas/styles (but post from your channel).
"""
import time
import random
import threading
from datetime import datetime, timezone
import database as db
import config

# ── Config ────────────────────────────────────────────────────────────────────

COMMENTS_PER_VIDEO_PER_DAY = (4, 5)   # random between these two
ACTIVE_HOURS = (8, 23)                 # only post between 8 AM – 11 PM UTC
MIN_GAP_MINUTES = 45                   # minimum gap between comments on same video
MAX_GAP_MINUTES = 180                  # maximum gap between comments on same video

GROQ_MODEL = "llama-3.3-70b-versatile"

# ── Viewer Personas ───────────────────────────────────────────────────────────
# Each persona has a name, style description, and example phrases.
# The comment will SOUND like this person even though it posts from your channel.

PERSONAS = [
    {
        "name": "Casual scroller",
        "style": "short, lowercase, slightly lazy typing, uses 'lol' or 'lmao' occasionally, no punctuation",
        "example": "ok this actually got me lmao",
    },
    {
        "name": "Enthusiastic fan",
        "style": "very excited, uses caps for emphasis, lots of exclamation marks, genuine hype",
        "example": "THIS IS EXACTLY what I needed today!! Keep it coming!",
    },
    {
        "name": "Curious first-timer",
        "style": "asks a genuine question about the topic, sounds like they discovered this for the first time",
        "example": "Wait how does that even work? I never thought about it that way",
    },
    {
        "name": "Relatable commenter",
        "style": "shares a brief personal reaction or experience related to the video, feels authentic",
        "example": "this is literally me every single morning 😂",
    },
    {
        "name": "Thoughtful viewer",
        "style": "leaves a slightly more considered comment, one interesting observation, no fluff",
        "example": "The editing on this is actually really clean. Subscribed.",
    },
    {
        "name": "Short reactor",
        "style": "1 sentence max, punchy, just a raw reaction with maybe one emoji",
        "example": "Not me watching this 3 times 💀",
    },
    {
        "name": "Friendly debate starter",
        "style": "respectfully disagrees with or questions something mildly, invites response",
        "example": "I feel like there's more to this story tbh, anyone else?",
    },
    {
        "name": "Fellow creator",
        "style": "notices something technical or creative about the video itself",
        "example": "The pacing on this is really well done, not easy to get right",
    },
]

# ── State ─────────────────────────────────────────────────────────────────────
# { video_id: { "2025-01-15": [timestamp, timestamp, ...] } }
_comment_log: dict = {}
_lock = threading.Lock()


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _comments_today(video_id: str) -> int:
    with _lock:
        return len(_comment_log.get(video_id, {}).get(_today(), []))


def _record_comment(video_id: str):
    with _lock:
        today = _today()
        if video_id not in _comment_log:
            _comment_log[video_id] = {}
        _comment_log[video_id].setdefault(today, []).append(time.time())


def _last_comment_ts(video_id: str) -> float:
    with _lock:
        timestamps = _comment_log.get(video_id, {}).get(_today(), [])
        return timestamps[-1] if timestamps else 0.0


def _generate_comment(video_title: str, video_description: str, persona: dict) -> str:
    """Generate a comment in the voice of the given persona using Groq."""
    from groq import Groq
    client = Groq(api_key=config.GROQ_API_KEY)

    desc_snippet = (video_description or "")[:300]

    prompt = f"""You are writing a YouTube comment in the voice of a specific type of viewer.

Viewer type: {persona["name"]}
Style: {persona["style"]}
Example of their voice: "{persona["example"]}"

Video title: "{video_title}"
Video description: "{desc_snippet}"

Write ONE comment this viewer would leave on this video.

Rules:
- Stay strictly in character with the style described
- 1-2 sentences maximum
- Sound completely natural and human — NOT like AI
- Comment should relate to the video content specifically
- No generic phrases like "great video" or "nice content"
- Do NOT include the viewer's name or any label
- Return ONLY the comment text, nothing else"""

    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=100,
        temperature=1.0,   # high temp = more varied outputs
    )
    return resp.choices[0].message.content.strip().strip('"').strip("'")


def _is_active_hour() -> bool:
    hour = datetime.now(timezone.utc).hour
    return ACTIVE_HOURS[0] <= hour <= ACTIVE_HOURS[1]


def post_comments_for_video(video: dict, count: int):
    """
    Post `count` comments on a video, spread randomly over the remaining day.
    Each comment uses a different randomly chosen persona.
    """
    video_id    = video["id"]
    youtube_id  = video.get("youtube_id")
    title       = video.get("title", "")
    description = video.get("description", "")

    if not youtube_id:
        return

    target = count
    posted = 0

    # Shuffle personas so we use different ones each time
    personas = random.sample(PERSONAS, min(target, len(PERSONAS)))
    if target > len(PERSONAS):
        # If we need more than unique personas, allow repeats
        extras = random.choices(PERSONAS, k=target - len(PERSONAS))
        personas = personas + extras

    for i in range(target):
        # Check if enough time has passed since last comment on this video
        since_last = time.time() - _last_comment_ts(video_id)
        min_gap    = MIN_GAP_MINUTES * 60

        if since_last < min_gap and i > 0:
            # Wait out the remaining gap + random extra
            wait = (min_gap - since_last) + random.randint(60, 600)
            print(f"💬 [{title[:30]}] Waiting {wait//60:.0f}m before next comment...")
            time.sleep(wait)

        # Check still in active hours
        if not _is_active_hour():
            print(f"💬 [{title[:30]}] Outside active hours, stopping for today")
            break

        persona = personas[i]
        try:
            comment_text = _generate_comment(title, description, persona)
            from pipeline.youtube_uploader import post_youtube_comment
            post_youtube_comment(youtube_id, comment_text)
            _record_comment(video_id)
            posted += 1
            print(f"💬 [{title[:30]}] ({persona['name']}): {comment_text[:70]}...")

            # Random gap before next comment (45–180 min) but skip wait after last one
            if i < target - 1:
                gap = random.randint(MIN_GAP_MINUTES * 60, MAX_GAP_MINUTES * 60)
                jitter = random.randint(-300, 300)
                wait = max(gap + jitter, MIN_GAP_MINUTES * 60)
                print(f"💬 Next comment in {wait//60:.0f}m")
                time.sleep(wait)

        except Exception as e:
            print(f"⚠️  Comment failed [{persona['name']}]: {e}")
            time.sleep(60)  # short backoff on error

    print(f"💬 Done — posted {posted}/{target} comments on '{title[:40]}'")


def run_daily_comment_schedule():
    """
    For each posted video that hasn't hit today's quota,
    decide how many comments to post and kick off threads for each.
    """
    if not _is_active_hour():
        return

    try:
        posted_videos = db.list_videos(status="posted", limit=100)
        eligible = [
            v for v in posted_videos
            if v.get("youtube_id") and _comments_today(v["id"]) < COMMENTS_PER_VIDEO_PER_DAY[1]
        ]

        if not eligible:
            print("💬 Auto-comment: all videos at quota for today")
            return

        print(f"💬 Auto-comment: {len(eligible)} eligible videos")

        for video in eligible:
            already = _comments_today(video["id"])
            target  = random.randint(*COMMENTS_PER_VIDEO_PER_DAY)
            remaining = target - already

            if remaining <= 0:
                continue

            # Run each video's comments in its own thread so they spread independently
            t = threading.Thread(
                target=post_comments_for_video,
                args=(video, remaining),
                daemon=True,
                name=f"commenter-{video['id'][:8]}"
            )
            t.start()

            # Stagger thread starts so videos don't all fire simultaneously
            time.sleep(random.randint(30, 120))

    except Exception as e:
        print(f"⚠️  Daily comment schedule error: {e}")


def _scheduler_loop():
    """
    Main scheduler loop.
    - Checks every 30 minutes if it's time to kick off daily comments
    - Runs once per day per video (at a random morning time)
    - Spreads the actual posting randomly across the active hours window
    """
    print("💬 Auto-comment scheduler started (active hours: "
          f"{ACTIVE_HOURS[0]}:00–{ACTIVE_HOURS[1]}:00 UTC)")

    _kicked_today: set = set()  # track which dates we've already kicked off

    while True:
        try:
            now   = datetime.now(timezone.utc)
            today = now.strftime("%Y-%m-%d")
            hour  = now.hour

            # Kick off the daily schedule once per day, randomly between 8–10 AM UTC
            if today not in _kicked_today and 8 <= hour <= 10:
                _kicked_today.add(today)
                # Keep set small — only last 7 days
                if len(_kicked_today) > 7:
                    _kicked_today.pop()

                print(f"💬 Starting daily comment schedule for {today}")
                # Run in background thread so scheduler loop keeps ticking
                threading.Thread(
                    target=run_daily_comment_schedule,
                    daemon=True,
                    name="comment-schedule"
                ).start()

            time.sleep(1800)  # check every 30 minutes

        except Exception as e:
            print(f"⚠️  Scheduler loop error: {e}")
            time.sleep(3600)


def start_scheduler():
    """Start the auto-comment scheduler daemon thread."""
    t = threading.Thread(target=_scheduler_loop, daemon=True, name="auto-commenter")
    t.start()
    print("💬 Auto-commenter running in background")
    return t