"""
AutoVid — Stick Figure Auto-Matcher

Analyses a video's script / title and automatically selects which stick-figure
clip to insert at each point in the video.

Rules:
  • Keyword matching: each clip carries a list of trigger words / phrases.
  • Sentence → time mapping: script sentences are mapped linearly to the video
    duration so each sentence gets a proportional time window.
  • Deduplication window (MIN_GAP): at most one overlay is active at a time;
    overlapping or too-close matches collapse into the highest-scoring single event.
  • Prefer more-specific clips (more keyword matches) over generic ones.
"""

import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

STICK_FIGURE_DIR = Path(__file__).parent.parent / "stickFigureAssets"

# ── Minimum seconds between consecutive overlay start times ──────────────────
MIN_GAP: float = 8.0

# ── Seed keyword map ─────────────────────────────────────────────────────────
# Used ONLY when seeding a fresh DB.  The live matching always reads from the
# database so keywords can be edited without touching this file.
_SEED_KEYWORDS: Dict[str, List[str]] = {
    "Its_clear.mp4": ["clear", "clarity", "understand", "obvious", "plain", "see now"],
    "a friend_hug_not_alone_loved.mp4": [
        "friend", "hug", "not alone", "loved", "embrace",
        "together", "comfort", "support", "care", "companionship",
    ],
    "abandoned_left_behind_friends_leaving.mp4": [
        "abandoned", "left behind", "leaving", "rejection", "deserted",
        "friends leaving", "walked away", "walked out",
    ],
    "adandoned.mp4": ["abandoned", "forsaken", "alone", "deserted", "left"],
    "anxiety_doubt_loosing_self.mp4": [
        "anxiety", "anxious", "doubt", "losing self", "worried",
        "fear", "uncertain", "stress", "panic", "unease", "doubt",
    ],
    "bright_idea_raising_hands.mp4": [
        "idea", "discovery", "eureka", "inspiration", "insight",
        "realized", "bright", "lightbulb", "epiphany",
    ],
    "cheose_no_sound.mp4": [
        "choose", "choice", "decision", "decide", "path", "option", "crossroads",
    ],
    "climbing.mp4": [
        "climb", "climbing", "rising", "ascent", "progress", "upward", "striving", "higher",
    ],
    "climbing_continous.mp4": [
        "climb", "perseverance", "continuous", "keep going", "persistence",
        "never quit", "relentless",
    ],
    "climbing_contious_no_sound.mp4": [
        "climb", "persistence", "keep going", "never stop", "upward",
    ],
    "communing_family.mp4": [
        "family", "community", "together", "belonging", "commune",
        "togetherness", "bond", "kinship", "loved ones",
    ],
    "connect.mp4": ["connect", "bond", "relationship", "link", "reach", "bridge"],
    "connect_to_a saul.mp4": [
        "connect", "soul", "spiritual", "bond", "deep connection", "kindred spirit",
    ],
    "crawling_inwards_self.mp4": [
        "introspection", "self", "withdraw", "retreat", "inward",
        "crawling", "hiding", "shell",
    ],
    "crying_standing_still_facing_down.mp4": [
        "crying", "sad", "grief", "tears", "weep", "sorrow", "heartbroken",
    ],
    "crying_standing_still_facing_down_no_sound.mp4": [
        "crying", "silent", "grief", "sadness", "silent tears", "quiet pain",
    ],
    "death_forces_fate_dark_scary.mp4": [
        "death", "fate", "dark", "scary", "mortality", "end", "fear of death",
        "dying", "terror", "dread",
    ],
    "death_forces_fate_dark_scary_2.mp4": [
        "death", "dark forces", "fate", "doom", "inevitable", "foreboding",
    ],
    "death_forces_fate_dark_scary_no_sound.mp4": [
        "death", "fate", "darkness", "silent", "doom", "end",
    ],
    "death_loss_grave_crying_no_sound.mp4": [
        "death", "loss", "grief", "grave", "mourning", "passing", "funeral", "buried",
    ],
    "disolving_into_oneself.mp4": [
        "dissolve", "introspection", "disappear", "self", "fading", "losing identity",
    ],
    "disolving_into_oneself_head.mp4": [
        "disappear", "fade", "self", "dissolve", "thought", "mind", "consumed",
    ],
    "effect_1.mp4": ["effect", "transform", "change", "shift"],
    "effects_2.mp4": ["effect", "visual", "transition", "alter"],
    "effects_3.mp4": ["effect", "shift", "change", "flux"],
    "facing_reality.mp4": [
        "reality", "truth", "facing", "acceptance", "confront",
        "face the truth", "wake up", "hard truth",
    ],
    "fading_memory.mp4": [
        "memory", "fade", "past", "nostalgia", "forget", "fading",
        "distant", "remember", "remember when",
    ],
    "fail.mp4": ["fail", "failure", "defeat", "fall", "collapse", "stumble"],
    "fail_but_peace_lift_hands_feel_peaceful.mp4": [
        "peace", "accept failure", "peaceful", "surrender", "let go",
        "acceptance", "release", "at peace",
    ],
    "falling_backwards.mp4": [
        "falling", "backwards", "collapse", "stumble", "down", "topple",
    ],
    "feeling_defeated_exhausted_sitting.mp4": [
        "defeated", "exhausted", "tired", "sitting", "worn out",
        "burnout", "depleted", "drained", "giving up",
    ],
    "finding_oneself_discovery.mp4": [
        "find", "discovery", "self-discovery", "identity", "who am i",
        "purpose", "searching", "meaning", "found myself",
    ],
    "flying_away_disapearing_into_space.mp4": [
        "flying", "disappear", "space", "freedom", "escape",
        "soar", "infinite", "free", "float away",
    ],
    "forsaken.mp4": [
        "forsaken", "abandoned", "betrayed", "forgotten", "cast away",
        "left alone", "nobody",
    ],
    "galaxy_1.mp4": [
        "galaxy", "universe", "cosmos", "cosmic", "stars", "infinity",
        "space", "vast", "eternal",
    ],
    "ghosts_of_the_past_slowmo_no_sound.mp4": [
        "ghost", "past", "haunted", "memory", "regret", "haunting",
        "old wounds", "cant forget",
    ],
    "good_feeling.mp4": [
        "happy", "joy", "good", "positive", "feel good",
        "elated", "wonderful", "amazing", "blessed", "grateful",
    ],
    "hands_from_above.mp4": [
        "divine", "help", "guidance", "above", "god",
        "blessing", "higher power", "faith", "prayer answered",
    ],
    "its_okay.mp4": [
        "okay", "fine", "alright", "acceptance", "it is okay",
        "it will be okay", "will be fine", "not the end",
    ],
    "kiss_closeup_love.mp4": [
        "love", "kiss", "romance", "affection", "partner", "intimate",
        "beloved", "cherish",
    ],
    "kiss_closeup_love2.mp4": [
        "love", "kiss", "romance", "relationship", "connection", "tender",
    ],
    "laying_down.mp4": [
        "rest", "relax", "laying", "tired", "exhausted", "sleep",
        "give up", "lay down", "flat",
    ],
    "left_you.mp4": [
        "leaving", "left", "goodbye", "separation", "leaving someone",
        "walked away", "gone", "parting",
    ],
    "looking_at_the_sky.mp4": [
        "sky", "wonder", "hope", "looking up", "dream",
        "stars", "heaven", "gaze up", "endless",
    ],
    "looking_at_the_sky2.mp4": [
        "sky", "contemplate", "hope", "gaze", "looking up", "wonder",
    ],
    "looking_forward_with_optmizm.mp4": [
        "optimism", "hope", "future", "forward", "positive outlook",
        "tomorrow", "brighter", "better days",
    ],
    "looking_forward_with_optmizm_with_sound.mp4": [
        "optimism", "hope", "looking forward", "future", "tomorrow",
    ],
    "loosing_oneself_a friend.mp4": [
        "losing", "self", "friend", "friendship", "identity",
        "lost myself", "who am i",
    ],
    "move_forward_loose_ghosts.mp4": [
        "moving forward", "letting go", "ghosts", "past",
        "release", "move on", "leave behind",
    ],
    "move_forward_loose_slomo.mp4": [
        "moving forward", "slow", "release", "letting go", "gradual",
    ],
    "moving_forward.mp4": [
        "moving", "forward", "progress", "advance", "keep going", "onward",
    ],
    "nuclear_explosion_initial_no_sound.mp4": [
        "explosion", "nuclear", "chaos", "destruction", "catastrophe",
        "war", "collapse", "apocalypse",
    ],
    "nuclear_explosion_initial_no_sound_continue.mp4": [
        "explosion", "aftermath", "destruction", "chaos", "ruin",
    ],
    "nuclear_explosion_initial_sound.mp4": [
        "explosion", "nuclear", "boom", "destruction", "blast",
    ],
    "outrun_fate.mp4": [
        "fate", "escape", "running", "destiny", "outrun",
        "defy", "against all odds", "beat the odds",
    ],
    "parents_love.mp4": [
        "parents", "love", "family", "parent", "mother",
        "father", "childhood", "raised", "upbringing",
    ],
    "raising_hands_on_knees.mp4": [
        "surrender", "raising", "knees", "pray", "beg",
        "plea", "desperation", "implore", "mercy",
    ],
    "raising_voice_shouting_angry.mp4": [
        "angry", "shout", "voice", "rage", "anger",
        "scream", "yell", "furious", "explosive",
    ],
    "realization.mp4": [
        "realize", "realization", "understanding", "insight",
        "aha", "moment of clarity", "click", "dawned on me",
    ],
    "realize_the_truth.mp4": [
        "truth", "realize", "awareness", "wake up",
        "open eyes", "see clearly", "truth revealed",
    ],
    "relax_take_a_break.mp4": [
        "relax", "break", "rest", "breathe", "pause",
        "take a break", "slow down", "decompress",
    ],
    "riseup_stand_tall_victory.mp4": [
        "rise", "stand", "victory", "triumph", "overcome",
        "conquer", "prevail", "champion", "won",
    ],
    "riseup_stand_tall_victory2.mp4": [
        "rise up", "victory", "stand tall", "win", "success", "achievement",
    ],
    "running.mp4": [
        "running", "moving", "action", "speed", "rush", "sprint",
    ],
    "running_away_danger_no_sound.mp4": [
        "danger", "run", "escape", "fear", "threat", "flee", "chase",
    ],
    "running_toward_light.mp4": [
        "hope", "light", "running", "positive", "toward",
        "brightness", "chasing light", "toward hope",
    ],
    "running_toward_light_longer.mp4": [
        "hope", "light", "running", "positive", "toward",
        "brightness", "chasing light", "toward hope", "extended",
    ],
    "sad_and_happy_relaxed.mp4": [
        "emotion", "complex", "bittersweet", "melancholy",
        "mixed feelings", "complicated", "nuanced",
    ],
    "sad_crying_in_the_wind.mp4": [
        "sad", "crying", "wind", "sorrow", "grief", "pain", "anguish",
    ],
    "shaking_hands.mp4": [
        "handshake", "agreement", "partnership", "deal",
        "alliance", "trust", "collaborate", "cooperate",
    ],
    "sinking_slow.mp4": [
        "sinking", "slow", "depression", "falling", "drowning",
        "going under", "pulled down", "dragged",
    ],
    "sit_on_desk_sad.mp4": [
        "sad", "desk", "work", "exhausted", "tired",
        "burnout", "overwhelmed", "stressed at work",
    ],
    "sit_on_desk_sad_no_sound.mp4": [
        "sad", "quiet", "desk", "alone", "silent sadness", "numb",
    ],
    "sitting_inlight_beam.mp4": [
        "light", "peace", "spiritual", "meditation", "enlightenment",
        "calm", "serene", "divine light", "inner peace",
    ],
    "stand_up.mp4": [
        "stand", "rise", "courage", "strength", "get up",
        "stand up", "face it", "refuse to fall",
    ],
    "standing_still_inlight_beam.mp4": [
        "still", "light", "peace", "contemplation",
        "silence", "centered", "grounded", "quiet moment",
    ],
    "standing_still_no_sound.mp4": [
        "still", "pause", "silent", "motionless", "frozen", "stoic",
    ],
    "time_outoftime.mp4": [
        "time", "deadline", "running out", "pressure",
        "urgency", "tick tock", "no time left",
    ],
    "timeisup_its_too_late.mp4": [
        "too late", "time", "regret", "missed", "over",
        "ended", "missed opportunity", "should have",
    ],
    "trying_and_failing.mp4": [
        "try", "fail", "attempt", "struggle", "effort",
        "keep trying", "give it all", "not enough",
    ],
    "very sad_depressed_frastrated.mp4": [
        "sad", "depressed", "frustrated", "despair",
        "hopeless", "broken", "rock bottom", "at my lowest",
    ],
    "walking_free.mp4": [
        "free", "walking", "freedom", "independence",
        "liberated", "finally free", "unchained", "breathe free",
    ],
    "walking_peacefully.mp4": [
        "peace", "walk", "calm", "serene", "tranquil",
        "peaceful", "at ease", "mindful",
    ],
    "walking_sad.mp4": [
        "sad", "walking", "lonely", "melancholy",
        "heavy", "burden", "dragging", "weary",
    ],
}


# Keep a public alias so the seed endpoint can import it
CLIP_KEYWORDS = _SEED_KEYWORDS


# ── DB helpers ────────────────────────────────────────────────────────────────

def load_keyword_map_from_db() -> Dict[str, Dict]:
    """
    Return {filename: {"keywords": [...], "primary_tag": str, "file_path": str, "duration": float}}
    from the stickfigure_clips DB table.  Falls back to _SEED_KEYWORDS
    (filesystem paths) if the table is empty or unreachable.
    """
    try:
        import database as db
        rows = db.list_stickfigure_clips(enabled_only=True)
        if rows:
            result = {}
            try:
                import config as _cfg
                supabase_base = (_cfg.SUPABASE_URL or "").rstrip("/")
            except Exception:
                supabase_base = ""
            for r in rows:
                # Prefer stored public_url, then compute from Supabase base, then local path
                file_p = (
                    r.get("public_url")
                    or (f"{supabase_base}/storage/v1/object/public/stickfigures/{r['filename']}" if supabase_base else "")
                    or r.get("file_path")
                    or ""
                )
                result[r["filename"]] = {
                    "keywords":    [k.lower() for k in (r.get("keywords") or [])],
                    "primary_tag": (r.get("primary_tag") or "").strip().lower(),
                    "file_path":   file_p,
                    "duration":    r.get("duration") or 0,
                }
            return result
    except Exception as e:
        print(f"⚠️  load_keyword_map_from_db failed, using seed map: {e}")

    # Fallback: build from _SEED_KEYWORDS + filesystem (no primary_tag in seed)
    return {
        filename: {
            "keywords":    [k.lower() for k in kws],
            "primary_tag": "",
            "file_path":   str(STICK_FIGURE_DIR / filename),
            "duration":    0,
        }
        for filename, kws in _SEED_KEYWORDS.items()
        if (STICK_FIGURE_DIR / filename).exists()
    }


# ── Text utilities ─────────────────────────────────────────────────────────────

def _split_sentences(text: str) -> List[str]:
    """Split script text into individual sentences."""
    # Split on sentence-ending punctuation followed by whitespace or end of string
    parts = re.split(r'(?<=[.!?])\s+', text.strip())
    # Also split on newlines (paragraph breaks)
    sentences = []
    for p in parts:
        sentences.extend(p.split("\n"))
    return [s.strip() for s in sentences if len(s.strip()) > 4]


def _score_clip(keywords: List[str], sentence_lower: str) -> int:
    """Return the number of keyword hits in sentence_lower."""
    score = 0
    for kw in keywords:
        if kw in sentence_lower:
            score += 2 if " " in kw else 1  # phrase match scores higher
    return score


# ── Main matching function ─────────────────────────────────────────────────────

def match_clips_to_script(
    script_text: str,
    video_duration: float,
    min_gap: float = MIN_GAP,
    max_overlays: int = 8,
) -> List[Dict]:
    """
    Analyse script_text and return a sorted list of overlay events.

    For each sentence:
      1. If a clip's primary_tag exactly appears in the sentence, that clip is
         added first (highest priority).
      2. Other clips with keyword score > 0 are appended in score-descending
         order to fill the remaining window time.
      3. If only one clip matches for a sentence, it is looped (loop_mode="full")
         to fill the entire sentence window.
      4. If the window time runs out before all clips are scheduled, remaining
         clips are discarded.

    At most `max_overlays` events are returned.
    """
    if not script_text or video_duration <= 0:
        return []

    sentences = _split_sentences(script_text)
    if not sentences:
        return []

    n = len(sentences)
    kw_map = load_keyword_map_from_db()

    # (start_t, end_t, filename, score, clip_path, clip_dur, loop_mode)
    all_candidates: List[Tuple[float, float, str, int, str, float, str]] = []

    for idx, sentence in enumerate(sentences):
        sent_lower = sentence.lower()

        # This sentence's start time in the video timeline
        t_frac  = idx / n
        start_t = 5.0 + t_frac * (video_duration - 10.0)
        start_t = max(0.0, min(start_t, video_duration - 3.0))

        # End of this sentence's window = start of next sentence (or near video end)
        if idx + 1 < n:
            next_frac  = (idx + 1) / n
            window_end = 5.0 + next_frac * (video_duration - 10.0)
        else:
            window_end = video_duration - 1.0
        window_end = min(window_end, video_duration - 1.0)

        window_dur = window_end - start_t
        if window_dur < 0.5:
            continue

        # --- Step 1: collect primary-tag matches (exact phrase in sentence) ---
        primary_matches = []
        secondary_matches = []
        for filename, meta in kw_map.items():
            pt = meta.get("primary_tag") or ""
            is_primary = bool(pt and pt in sent_lower)
            score = _score_clip(meta["keywords"], sent_lower)
            clip_dur = meta.get("duration") or 5.0
            if is_primary:
                primary_matches.append((score, filename, meta["file_path"], clip_dur))
            elif score > 0:
                secondary_matches.append((score, filename, meta["file_path"], clip_dur))

        primary_matches.sort(key=lambda m: -m[0])
        secondary_matches.sort(key=lambda m: -m[0])

        # Ordered sequence: primaries first, then secondaries
        ordered = primary_matches + secondary_matches
        if not ordered:
            continue

        # --- Step 3: single-match → loop to fill window ---
        if len(ordered) == 1:
            score, filename, path, clip_dur = ordered[0]
            all_candidates.append(
                (start_t, window_end, filename, score, path, clip_dur, "full")
            )
            continue

        # --- Step 2 / 4: schedule sequentially, discard if window exhausted ---
        current_t = start_t
        for score, filename, path, clip_dur in ordered:
            remaining = window_end - current_t
            if remaining < 0.5:
                break
            actual_dur = min(clip_dur, remaining)
            all_candidates.append(
                (current_t, current_t + actual_dur, filename, score, path, clip_dur, "none")
            )
            current_t += actual_dur

    if not all_candidates:
        return []

    # Sort by start_time and drop any that overlap the previous clip
    all_candidates.sort(key=lambda c: c[0])
    accepted: List[Tuple[float, str, int, str, float, str]] = []
    last_end = -999.0
    for start_t, end_t, filename, score, path, clip_dur, loop_mode in all_candidates:
        if start_t >= last_end - 0.05:   # allow tiny float rounding
            accepted.append((start_t, filename, score, path, clip_dur, loop_mode))
            last_end = end_t

    accepted = accepted[:max_overlays]

    # Build output dicts
    results = []
    for start_t, filename, score, path, clip_dur, loop_mode in accepted:
        dur = kw_map.get(filename, {}).get("duration") or clip_dur
        if dur <= 0:
            try:
                from .stickfigure_compositor import get_video_info
                dur = get_video_info(path)["duration"]
            except Exception:
                dur = 5.0
        results.append({
            "clip_path":  path,
            "filename":   filename,
            "start_time": round(start_t, 2),
            "duration":   round(dur, 2),
            "x":          0,
            "y":          0,
            "scale":      0.5,
            "loop_mode":  loop_mode,
            "has_sound":  True,
            "score":      score,
        })

    return results
