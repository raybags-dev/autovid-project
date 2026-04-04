import threading
import time
import datetime
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import database as db
import config

# Days of week: 0=Monday ... 6=Sunday
DEFAULT_DAYS = [1, 3, 5, 6]   # Tue, Thu, Sat, Sun = 4x per week
DEFAULT_HOUR = 3               # 3 AM UTC — off-peak, avoids quota collision with replies
DEFAULT_PROFILE = "educational"

# Curated default prompts — philosophical, emotional, educational topics
DEFAULT_PROMPTS = [
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


def _jaccard_similarity(a: str, b: str) -> float:
    """Simple word-overlap similarity in [0, 1]."""
    sa = set(a.lower().split())
    sb = set(b.lower().split())
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def _is_semantically_duplicate(candidate: str, existing: list, threshold: float = 0.45) -> bool:
    """Return True if candidate is too similar to any prompt in existing."""
    return any(_jaccard_similarity(candidate, e) >= threshold for e in existing)


def _auto_generate_prompts(pipeline: str = "long", count: int = 20) -> list:
    """
    Mode A: Use Groq LLM to generate a fresh batch of prompts.
    Themes: dark, philosophical, existential — meaning, death, love, absurdism, isolation, purpose.
    """
    try:
        from groq import Groq
        client = Groq(api_key=config.GROQ_API_KEY)
        recent = db.list_recent_prompts(pipeline, limit=50)
        recent_sample = "\n".join(f"- {p}" for p in recent[:20]) if recent else "(none yet)"
        system = (
            "You generate video titles for a philosophical YouTube channel. "
            "Themes: dark, existential, absurdist — death, meaning, love, isolation, "
            "purpose, human condition, aging, impermanence, absurdism. "
            "Never repeat themes already covered. Keep each title under 12 words. "
            "Output ONLY a JSON array of strings, no other text."
        )
        user = (
            f"Generate exactly {count} unique video titles. "
            f"Avoid any topic similar to these already-used titles:\n{recent_sample}\n\n"
            "Return ONLY a JSON array."
        )
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=0.9,
            max_tokens=800,
        )
        raw = resp.choices[0].message.content.strip()
        # Extract JSON array from response
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start == -1 or end == 0:
            return []
        prompts = json.loads(raw[start:end])
        # Semantic deduplication against recent
        unique = [p for p in prompts if isinstance(p, str) and p.strip() and not _is_semantically_duplicate(p, recent)]
        return unique[:count]
    except Exception as e:
        print(f"⚠️  Mode A prompt generation failed: {e}")
        return []


def _ensure_pool_seeded(pipeline: str, defaults: list):
    """Seed the prompt_pool from the defaults list if the pool is empty."""
    counts = db.count_prompt_pool(pipeline)
    if counts["total"] == 0:
        print(f"🌱 Seeding prompt pool ({pipeline}) from {len(defaults)} defaults")
        db.add_prompts_to_pool(defaults, pipeline=pipeline, source="default")


def _pick_next_prompt(prompts: list) -> str:
    """
    Pick the next unused prompt from the DB pool (pipeline='long').
    Falls back to old index-based cycling if DB is unavailable.
    On exhaustion: Mode A auto-generates new prompts, Mode B falls back to reset.
    """
    pipeline = "long"
    try:
        _ensure_pool_seeded(pipeline, prompts)
        row = db.get_next_unused_prompt(pipeline)
        if row is None:
            # Pool exhausted — check exhaustion mode
            mode = db.get_setting("auto_generate_exhaustion_mode", default="A")
            if mode in ("A", "hybrid"):
                print("🔄 Prompt pool exhausted — running Mode A auto-generation")
                new_prompts = _auto_generate_prompts(pipeline=pipeline, count=20)
                if new_prompts:
                    db.add_prompts_to_pool(new_prompts, pipeline=pipeline, source="generated")
                    row = db.get_next_unused_prompt(pipeline)
                else:
                    print("⚠️  Mode A generation failed — resetting pool")
                    db.reset_prompt_pool(pipeline)
                    row = db.get_next_unused_prompt(pipeline)
            else:
                # Mode B: reset and cycle from existing
                print("🔄 Prompt pool exhausted — resetting (Mode B)")
                db.reset_prompt_pool(pipeline)
                row = db.get_next_unused_prompt(pipeline)

        if row:
            db.mark_prompt_used(row["id"])
            return row["prompt"]
    except Exception as e:
        print(f"⚠️  Prompt pool DB error, falling back to index: {e}")

    # Fallback: old index-based cycling
    try:
        last_idx = int(db.get_setting("auto_generate_last_idx", default="-1"))
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


# ── Auto-Short Generator ──────────────────────────────────────────────────────

DEFAULT_SHORT_TOPICS = [
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
    "One thing highly successful people do every morning",
    "The 60-second breathing trick that calms anxiety instantly",
    "Why your brain lies to you about being busy",
    "The hidden reason you feel drained after social events",
    "What happens to your body after just one bad night of sleep",
    "The simple mindset shift that makes hard things easier",
    "Why comparison is the thief of joy — and how to stop",
    "The 5-second rule that breaks procrastination",
    "What ancient wisdom says about modern stress",
    "The surprising science behind why music gives you chills",
    "Why walking outside changes your brain chemistry",
    "The real reason habits are so hard to break",
    "One question to ask yourself before making any big decision",
    "Why your worst days are often your most important",
    "The power of saying nothing — why silence is a superpower",
    "What neuroscience says about gratitude and happiness",
    "The small daily ritual that rewires your nervous system",
    "Why boredom might be the most important feeling you ignore",
    "The psychology behind why we self-sabotage",
    "What your posture says about your confidence",
    "The loneliness trap: why being alone and being lonely are different",
    "Why forgiveness is actually selfish — and why that's okay",
    "The science of flow state and how to trigger it",
    "What happens to your mind when you journal every day",
    "Why the most productive people protect their mornings",
    "The counterintuitive truth about willpower",
    "Why your environment shapes your choices more than your intentions",
    "The human need for meaning — why purpose changes everything",
    "What cold showers actually do to your mental resilience",
    "The real cost of never saying no",
    "Why self-compassion outperforms self-discipline",
    "The 90-second rule for processing difficult emotions",
    "What your inner critic is actually trying to protect",
    "Why deep work is disappearing — and how to reclaim it",
    "The unexpected power of admitting you don't know",
    "Why rest is not a reward — it is a requirement",
    "The mental shift that turns setbacks into momentum",
    "What makes some people emotionally unbreakable",
    "The truth about motivation — it follows action, not the other way around",
    "Why your future self needs you to make different choices today",
    "One reframe that makes criticism easier to hear",
    "The science of awe — and why you need more of it",
    "Why doing less can sometimes accomplish more",
    "The quiet practice that high performers never skip",
    "What it means to live with intention in a distracted world",
    "Why emotions are data, not weakness",
    "The surprising link between creativity and constraint",
    "What learning a hard thing teaches you about yourself",
    "Why discomfort is the gateway to growth",
    "The story you tell yourself — and how to change it",
]

DEFAULT_SHORT_AMBIENCE = "aurora"


def get_auto_short_settings() -> dict:
    """Load auto-short scheduler settings from DB."""
    try:
        enabled     = db.get_setting("auto_short_enabled",     default="false") == "true"
        days_raw    = db.get_setting("auto_short_days",        default=json.dumps([1, 3, 5, 6]))
        topics_raw  = db.get_setting("auto_short_topics",      default=json.dumps(DEFAULT_SHORT_TOPICS))
        hour        = int(db.get_setting("auto_short_hour",    default="5"))
        ambience    = db.get_setting("auto_short_ambience",    default=DEFAULT_SHORT_AMBIENCE)
        return {
            "enabled":  enabled,
            "days":     json.loads(days_raw),
            "topics":   json.loads(topics_raw),
            "hour":     hour,
            "ambience": ambience,
        }
    except Exception as e:
        print(f"⚠️  Auto-short: failed to load settings: {e}")
        return {
            "enabled": False, "days": [1, 3, 5, 6],
            "topics": DEFAULT_SHORT_TOPICS, "hour": 5,
            "ambience": DEFAULT_SHORT_AMBIENCE,
        }


def save_auto_short_settings(settings: dict):
    """Persist auto-short settings to DB."""
    db.set_setting("auto_short_enabled",  str(settings.get("enabled", False)).lower())
    db.set_setting("auto_short_days",     json.dumps(settings.get("days", [1, 3, 5, 6])))
    db.set_setting("auto_short_topics",   json.dumps(settings.get("topics", DEFAULT_SHORT_TOPICS)))
    db.set_setting("auto_short_hour",     str(settings.get("hour", 5)))
    db.set_setting("auto_short_ambience", settings.get("ambience", DEFAULT_SHORT_AMBIENCE))


def _pick_next_short_topic(topics: list) -> tuple:
    """
    Pick the next unused topic from the DB pool (pipeline='short'), then pick an
    angle deterministically. Falls back to in-memory combo cycling if DB fails.
    Returns (topic, angle).
    """
    from pipeline.script_gen import SHORT_ANGLES

    pipeline = "short"
    try:
        _ensure_pool_seeded(pipeline, topics)
        row = db.get_next_unused_prompt(pipeline)
        if row is None:
            mode = db.get_setting("auto_short_exhaustion_mode", default="A")
            if mode in ("A", "hybrid"):
                print("🔄 Short topic pool exhausted — running Mode A auto-generation")
                new_topics = _auto_generate_prompts(pipeline=pipeline, count=20)
                if new_topics:
                    db.add_prompts_to_pool(new_topics, pipeline=pipeline, source="generated")
                    row = db.get_next_unused_prompt(pipeline)
                else:
                    db.reset_prompt_pool(pipeline)
                    row = db.get_next_unused_prompt(pipeline)
            else:
                db.reset_prompt_pool(pipeline)
                row = db.get_next_unused_prompt(pipeline)

        if row:
            db.mark_prompt_used(row["id"])
            topic_str = row["prompt"]
            # Pick angle deterministically from used-count so we cycle through them
            counts = db.count_prompt_pool(pipeline)
            angle_idx = (counts["total"] - counts["unused"]) % len(SHORT_ANGLES)
            return topic_str, SHORT_ANGLES[angle_idx]
    except Exception as e:
        print(f"⚠️  Short topic pool DB error, falling back: {e}")

    # Fallback: old combo-set cycling
    try:
        used_raw = db.get_setting("auto_short_used_topics", default="[]")
        used = set(json.loads(used_raw))
    except Exception:
        used = set()

    all_combos = [f"{t}::{i}" for t in topics for i in range(len(SHORT_ANGLES))]
    available  = [c for c in all_combos if c not in used]
    if not available:
        used = set()
        available = list(all_combos)
        print("🔄 Auto-short: all topic+angle combos used, resetting")

    combo = available[0]
    used.add(combo)
    db.set_setting("auto_short_used_topics", json.dumps(list(used)))

    topic_str, angle_idx = combo.rsplit("::", 1)
    return topic_str, SHORT_ANGLES[int(angle_idx)]


def run_auto_short(push_log_fn=None, unregister_fn=None):
    """Trigger one auto-generated short. Supports log streaming."""
    from pipeline.orchestrator import run_short_pipeline
    settings = get_auto_short_settings()
    topics   = settings.get("topics", DEFAULT_SHORT_TOPICS)
    ambience = settings.get("ambience", DEFAULT_SHORT_AMBIENCE)

    if not topics:
        print("⚠️  Auto-short: no topics configured")
        return None

    topic, angle = _pick_next_short_topic(topics)
    print(f"📱 Auto-short: '{topic}' | angle: {angle[:50]}...")

    video_id = None
    try:
        import database as db2
        record   = db2.create_video(f"[Short] {topic}")
        video_id = record["id"]

        def _cb(info: dict):
            step = info.get("step", "?") if isinstance(info, dict) else str(info)
            msg  = info.get("message", "") if isinstance(info, dict) else ""
            if push_log_fn:
                push_log_fn(video_id, f"[{step}] {msg}")

        run_short_pipeline(prompt=topic, ambience=ambience, video_id=video_id, cb=_cb, angle=angle)
        print(f"✅ Auto-short: pipeline complete for {video_id}")
        return video_id
    except Exception as e:
        print(f"❌ Auto-short pipeline failed: {e}")
        return None
    finally:
        if unregister_fn and video_id:
            try:
                unregister_fn(video_id)
            except Exception:
                pass


def start_auto_short_scheduler():
    """Start background scheduler for auto-short generation."""
    def _loop():
        print("🕐 Auto-short scheduler started")
        while True:
            try:
                settings = get_auto_short_settings()
                if settings["enabled"]:
                    now = datetime.datetime.utcnow()
                    if (now.weekday() in settings["days"] and
                            now.hour == settings["hour"] and
                            now.minute < 5):
                        last = db.get_setting("auto_short_last_run", default="")
                        today = now.strftime("%Y-%m-%d")
                        if last != today:
                            db.set_setting("auto_short_last_run", today)
                            t = threading.Thread(target=run_auto_short, daemon=True)
                            t.start()
            except Exception as e:
                print(f"⚠️  Auto-short scheduler error: {e}")
            time.sleep(240)

    threading.Thread(target=_loop, daemon=True).start()