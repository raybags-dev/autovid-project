import threading
import time
import datetime
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import database as db

# Days of week: 0=Monday ... 6=Sunday
DEFAULT_DAYS = [1, 3, 5, 6]   # Tue, Thu, Sat, Sun = 4x per week
DEFAULT_HOUR = 3               # 3 AM UTC — off-peak, avoids quota collision with replies
DEFAULT_PROFILE = "educational"

# Curated default prompts — philosophical, emotional, educational topics
DEFAULT_PROMPTS = [
    "The meaning of silence in a world that never stops talking",
    "Why we fear death more than we fear never having lived",
    "What happens to your brain when you fall in love",
    "The hidden cost of always being reachable",
    "Why the most important things in life cannot be measured",
    "The philosophy of letting go — why we hold on to what hurts us",
    "What science says about the nature of consciousness",
    "The loneliness epidemic — why we are more connected and more alone than ever",
    "What ancient Stoics knew about anxiety that we forgot",
    "The psychology of regret — and how to make peace with your past",
    "Why beauty exists — and what it tells us about being human",
    "The art of doing nothing — and why rest is not laziness",
    "What near-death experiences reveal about the nature of reality",
    "The strange truth about why we dream",
    "Why kindness is actually a form of strength",
    "The paradox of choice — why more options make us less happy",
    "What grief teaches us about love",
    "The hidden intelligence of the human body",
    "Why great art makes us cry — the neuroscience of beauty",
    "The meaning of home — why we long to belong somewhere",
    "Why everything ends — and why that gives life meaning",
    "The quiet truth about impermanence — why nothing we love can stay forever",
    "What it means to live knowing that one day you will die",
    "Why humans build meaning in a universe that promises none",
    "The philosophy of mortality — how death shapes the way we live",
    "Why love feels infinite even though it exists in time",
    "The psychology of attachment — why letting go hurts so much",
    "Why we struggle to imagine a world without us",
    "The emotional paradox of loving someone you will eventually lose",
    "Why the awareness of death can make life more vivid",
    "The strange comfort of knowing suffering does not last forever",
    "What philosophy teaches us about accepting the end of things",
    "Why every relationship is temporary — and why we love anyway",
    "The existential courage of caring in a fragile world",
    "Why humans create legacy — the need to outlive ourselves",
    "The silence after loss — what grief reveals about the human heart",
    "Why time feels faster as we grow older",
    "What it means to exist for a brief moment in cosmic time",
    "Why memories become more valuable after something is gone",
    "The philosophy of final moments — what people value at the end of life",
    "Why we search for permanence in a temporary world",
    "The fragile miracle of being alive at all",
    "What ancient philosophers believed about facing death",
    "Why endings give stories their meaning",
    "The strange beauty of things that do not last",
    "Why loss is the price of love",
    "The human instinct to deny mortality",
    "What we learn about life when someone close to us dies",
    "Why the awareness of death can lead to deeper compassion",
    "The existential weight of time — why every moment is disappearing",
]

_scheduler_started = False
_scheduler_lock    = threading.Lock()


def get_settings() -> dict:
    """Load scheduler settings from DB."""
    try:
        enabled  = db.get_setting("auto_generate_enabled", default="false") == "true"
        days_raw = db.get_setting("auto_generate_days",    default=json.dumps(DEFAULT_DAYS))
        profile  = db.get_setting("auto_generate_profile", default=DEFAULT_PROFILE)
        prompts_raw = db.get_setting("auto_generate_prompts", default=json.dumps(DEFAULT_PROMPTS))
        hour     = int(db.get_setting("auto_generate_hour", default=str(DEFAULT_HOUR)))
        return {
            "enabled":  enabled,
            "days":     json.loads(days_raw),    # list of ints 0-6
            "profile":  profile,
            "prompts":  json.loads(prompts_raw),
            "hour":     hour,
        }
    except Exception as e:
        print(f"⚠️  Auto-generator: failed to load settings: {e}")
        return {"enabled": False, "days": DEFAULT_DAYS, "profile": DEFAULT_PROFILE,
                "prompts": DEFAULT_PROMPTS, "hour": DEFAULT_HOUR}


def save_settings(settings: dict):
    """Persist scheduler settings to DB."""
    db.set_setting("auto_generate_enabled",  str(settings.get("enabled", False)).lower())
    db.set_setting("auto_generate_days",     json.dumps(settings.get("days", DEFAULT_DAYS)))
    db.set_setting("auto_generate_profile",  settings.get("profile", DEFAULT_PROFILE))
    db.set_setting("auto_generate_prompts",  json.dumps(settings.get("prompts", DEFAULT_PROMPTS)))
    db.set_setting("auto_generate_hour",     str(settings.get("hour", DEFAULT_HOUR)))


def _pick_next_prompt(prompts: list) -> str:
    """Pick the next unused prompt, cycling through the list."""
    try:
        last_idx_raw = db.get_setting("auto_generate_last_idx", default="-1")
        last_idx = int(last_idx_raw)
    except Exception:
        last_idx = -1
    next_idx = (last_idx + 1) % len(prompts)
    db.set_setting("auto_generate_last_idx", str(next_idx))
    return prompts[next_idx]


def _should_run_today(days: list, hour: int) -> bool:
    """Check if the scheduler should run right now."""
    now = datetime.datetime.utcnow()
    return now.weekday() in days and now.hour == hour and now.minute < 5


def _has_run_today() -> bool:
    """Prevent running twice on the same day."""
    try:
        last = db.get_setting("auto_generate_last_run", default="")
        today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        return last == today
    except Exception:
        return False


def _mark_ran_today():
    today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    db.set_setting("auto_generate_last_run", today)


def run_auto_generate(push_log_fn=None, unregister_fn=None):
    """Trigger one auto-generated video. Supports log streaming when called from API."""
    from pipeline.orchestrator import run_pipeline
    settings = get_settings()
    prompts  = settings["prompts"]
    profile  = settings["profile"]

    if not prompts:
        print("⚠️  Auto-generator: no prompts configured")
        return None

    prompt = _pick_next_prompt(prompts)
    print(f"🤖 Auto-generator: starting pipeline")
    print(f"   Prompt:  {prompt}")
    print(f"   Profile: {profile}")

    try:
        import database as db2
        record   = db2.create_video(prompt)
        video_id = record["id"]

        def _cb(stage: str, message: str):
            if push_log_fn:
                push_log_fn(video_id, f"[{stage}] {message}")

        run_pipeline(
            prompt=prompt,
            profile=profile,
            auto_upload=False,   # Never auto-upload — user reviews first
            video_id=video_id,
            progress_callback=_cb,
        )
        print(f"✅ Auto-generator: pipeline complete — video ready for review")
        return video_id
    except Exception as e:
        print(f"❌ Auto-generator pipeline failed: {e}")
        return None
    finally:
        if unregister_fn and video_id:
            try:
                unregister_fn(video_id)
            except Exception:
                pass


def start_auto_scheduler():
    """Start the background scheduler thread. Call once on startup."""
    global _scheduler_started
    with _scheduler_lock:
        if _scheduler_started:
            return
        _scheduler_started = True

    def _loop():
        print("🕐 Auto-generator scheduler started")
        while True:
            try:
                settings = get_settings()
                if settings["enabled"]:
                    if _should_run_today(settings["days"], settings["hour"]):
                        if not _has_run_today():
                            print(f"🤖 Auto-generator: scheduled run triggered")
                            _mark_ran_today()
                            # Run in a separate thread so scheduler loop keeps going
                            t = threading.Thread(target=run_auto_generate, daemon=True)
                            t.start()
            except Exception as e:
                print(f"⚠️  Auto-scheduler loop error: {e}")
            time.sleep(240)   # check every 4 minutes

    threading.Thread(target=_loop, daemon=True).start()