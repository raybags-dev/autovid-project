"""
AutoVid Pipeline — Step 3: Stock Video Fetcher

Fetches relevant video clips from Pexels (primary) and Pixabay (fallback).
Both APIs are free — no credit card required.

Strategy:
  - For each script segment, search using the segment's visual_query
  - Download the best matching clip
  - Trim/resize to match segment duration
  - Cache downloads to avoid re-fetching the same clips
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import os
import hashlib
import requests
from pathlib import Path
from typing import Optional
import config

# ── Pexels ────────────────────────────────────────────────────────────────────

PEXELS_SEARCH_URL = "https://api.pexels.com/videos/search"
PEXELS_HEADERS = {"Authorization": config.PEXELS_API_KEY}

PIXABAY_SEARCH_URL = "https://pixabay.com/api/videos/"


def _search_pexels(
    query: str,
    duration_hint: float = 10,
    result_offset: int = 0,
    exclude_ids: set = None,
) -> tuple:
    """
    Search Pexels for a video matching the query.
    exclude_ids: set of Pexels video IDs already used — skipped to ensure diversity.
    Returns (download_url, pexels_video_id) or (None, None).
    """
    params = {
        "query": query,
        "per_page": 15,
        "orientation": "landscape",
        "size": "medium",
    }
    try:
        resp = requests.get(PEXELS_SEARCH_URL, headers=PEXELS_HEADERS, params=params, timeout=10)
        resp.raise_for_status()
        videos = resp.json().get("videos", [])
        if not videos:
            return None, None

        # Filter out already-used clips
        if exclude_ids:
            fresh = [v for v in videos if v["id"] not in exclude_ids]
            candidates = fresh if fresh else videos  # relax dedup if nothing fresh
        else:
            candidates = videos

        # Prefer clips long enough for this segment
        long_enough = [v for v in candidates if v["duration"] >= max(duration_hint - 1, 3)]
        candidates = long_enough if long_enough else candidates

        video = candidates[result_offset % len(candidates)]
        files = sorted(video["video_files"], key=lambda f: f.get("width", 0), reverse=True)
        for f in files:
            if f.get("width", 0) >= 1280:
                return f["link"], video["id"]
        return (files[0]["link"], video["id"]) if files else (None, None)

    except Exception as e:
        print(f"⚠️  Pexels search failed for '{query}': {e}")
        return None, None


def _search_pixabay(query: str, result_offset: int = 0) -> Optional[str]:
    """
    Fallback to Pixabay if Pexels fails or returns nothing.
    result_offset: selects a different hit so different scripts get different clips.
    """
    params = {
        "key": config.PIXABAY_API_KEY,
        "q": query,
        "video_type": "film",
        "per_page": 10,
    }
    try:
        resp = requests.get(PIXABAY_SEARCH_URL, params=params, timeout=10)
        resp.raise_for_status()
        hits = resp.json().get("hits", [])
        if not hits:
            return None

        # Use offset so different scripts pick different hits
        hit = hits[result_offset % len(hits)]
        videos = hit.get("videos", {})
        for quality in ["large", "medium", "small", "tiny"]:
            url = videos.get(quality, {}).get("url")
            if url:
                return url
    except Exception as e:
        print(f"⚠️  Pixabay fallback failed for '{query}': {e}")
    return None


def _download_clip(url: str, dest_path: Path) -> bool:
    """Download a video file to dest_path. Returns True on success."""
    try:
        with requests.get(url, stream=True, timeout=60) as resp:
            resp.raise_for_status()
            with open(dest_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=1024 * 256):
                    f.write(chunk)
        return True
    except Exception as e:
        print(f"⚠️  Download failed: {e}")
        return False


def _cache_key(query: str) -> str:
    """Create a filesystem-safe cache key from a search query."""
    return hashlib.md5(query.lower().strip().encode()).hexdigest()[:12]


# ── Public API ────────────────────────────────────────────────────────────────

# ── Query Expansion ──────────────────────────────────────────────────────────
# Fallback queries when the LLM's visual_query returns no results.
# Maps conceptual/abstract terms to concrete visual alternatives.

CONCEPT_EXPANSIONS = {
    # Philosophy / meaning
    "meaning of life":   ["elderly person looking at sunset", "hospice patient peaceful", "hands holding newborn baby"],
    "death":             ["empty hospital bed", "autumn leaves falling", "gravestone sunset"],
    "existence":         ["universe stars milky way", "human silhouette sunrise", "alone figure vast landscape"],
    "purpose":           ["compass navigation closeup", "mountain climber summit", "person running dawn"],
    "soul":              ["candle flame darkness", "person meditating light", "ethereal fog forest"],
    # Emotions
    "love":              ["couple holding hands", "mother hugging child", "wedding kiss"],
    "fear":              ["person in darkness", "storm lightning", "eyes wide shocked"],
    "anger":             ["fist table slam", "storm clouds dark", "fire burning"],
    "joy":               ["children laughing playground", "celebration confetti", "person jumping sunset"],
    "sadness":           ["person crying rain", "empty bench park", "rain window closeup"],
    # Science
    "evolution":         ["nature transformation timelapse", "DNA helix animation", "fossil bones museum"],
    "universe":          ["galaxy telescope stars", "space nebula colorful", "earth from orbit"],
    "brain":             ["neuron firing animation", "brain scan mri", "thinking person closeup"],
    # Society
    "money":             ["cash counting hands", "stock market charts", "gold coins pile"],
    "war":               ["soldier silhouette sunset", "ruins bombed building", "military march"],
    "politics":          ["parliament building", "voting ballot", "crowd protest"],
    # Health
    "disease":           ["hospital iv drip", "doctor patient bedside", "microscope virus"],
    "fitness":           ["gym workout weight", "running marathon crowd", "yoga meditation sunrise"],
}



# ── Visual Mood Overrides ─────────────────────────────────────────────────────
# When user picks a mood, each segment's visual_query is enriched with these
# cinematic Pexels search terms to guarantee beautiful, on-brand footage.

MOOD_QUERIES = {
    "ocean": [
        "ocean waves slow motion cinematic",
        "sea waves crashing rocks sunset",
        "calm ocean surface aerial",
        "underwater light rays ocean",
        "waves shore peaceful",
    ],
    "candle": [
        "candle flame darkness closeup",
        "candlelight warm bokeh",
        "single candle burning night",
        "candle wax melting slow",
        "warm candlelight hands",
    ],
    "forest": [
        "forest light rays morning fog",
        "sunlight through trees slow motion",
        "misty forest path cinematic",
        "forest floor autumn leaves",
        "trees wind gentle nature",
    ],
    "stars": [
        "night sky stars timelapse",
        "milky way galaxy cinematic",
        "stars twinkling dark sky",
        "moon night clouds slow",
        "starfield space deep",
    ],
    "hands": [
        "hands holding closeup warm",
        "elderly hands wrinkled gentle",
        "hands prayer soft light",
        "person hands table contemplative",
        "mother child hands tender",
    ],
    "mountains": [
        "mountain fog mist cinematic",
        "mountains clouds aerial drone",
        "misty mountain valley sunrise",
        "mountain peak clouds rolling",
        "foggy mountain landscape peaceful",
    ],
    "aurora_blue": [
        "northern lights aurora borealis",
        "aurora borealis night sky green blue",
        "night sky lights glowing dark",
        "borealis colors sky abstract",
        "night lights nature dark sky",
    ],
    "aurora_dark": [
        "dark abstract background flowing",
        "black dark cinematic moody",
        "dark smoke black background",
        "shadow dark dramatic cinematic",
        "dark night minimal abstract",
    ],

}

# Topic keywords that map to a mood automatically
TOPIC_TO_MOOD = {
    "grief":      "candle",
    "loss":       "candle",
    "death":      "candle",
    "mourning":   "candle",
    "healing":    "ocean",
    "peace":      "ocean",
    "calm":       "ocean",
    "hope":       "forest",
    "growth":     "forest",
    "nature":     "forest",
    "meaning":    "mountains",
    "purpose":    "mountains",
    "journey":    "mountains",
    "love":       "hands",
    "connection": "hands",
    "family":     "hands",
    "night":      "stars",
    "universe":   "stars",
    "infinity":   "stars",
    "soul":       "stars",
}


def get_mood_for_topic(topic: str) -> str | None:
    """Auto-detect best mood from the video topic/title."""
    topic_lower = topic.lower()
    for keyword, mood in TOPIC_TO_MOOD.items():
        if keyword in topic_lower:
            return mood
    return None


# These moods are CSS-only visual effects — use topic-based footage, not mood footage
CSS_ONLY_MOODS = {"fluid_red", "fluid_blue", "fluid_black", "aurora_blue", "aurora_dark"}


def enrich_segments_with_mood(segments: list, mood: str) -> list:
    """
    Override each segment's visual_query with mood-appropriate Pexels terms.
    Cycles through the mood's query list so each segment gets variety.
    Falls back gracefully if mood is unknown or CSS-only.
    """
    # CSS-only moods have no associated footage — use topic queries as-is
    if mood in CSS_ONLY_MOODS:
        return segments

    queries = MOOD_QUERIES.get(mood)
    if not queries:
        return segments

    enriched = []
    for i, seg in enumerate(segments):
        new_seg = dict(seg)
        # Blend original query with mood query for best results
        original = seg.get("visual_query", "")
        mood_q   = queries[i % len(queries)]
        # Use mood query as primary, original as context hint
        new_seg["visual_query"] = mood_q
        new_seg["mood_hint"]    = original   # keep original for fallback
        enriched.append(new_seg)

    return enriched

def _expand_query(query: str) -> list[str]:
    """Return a list of fallback search queries for abstract/conceptual topics."""
    q = query.lower().strip()
    # Direct match
    if q in CONCEPT_EXPANSIONS:
        return CONCEPT_EXPANSIONS[q]
    # Partial match
    for key, expansions in CONCEPT_EXPANSIONS.items():
        if key in q or q in key:
            return expansions
    # Generic expansion: strip adjectives and try noun only
    words = q.split()
    if len(words) > 2:
        return [" ".join(words[-2:]), " ".join(words[:2])]
    return []


_STOP_WORDS = {
    'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
    'is','are','was','were','be','been','being','have','has','had','do','does',
    'did','will','would','could','should','may','might','this','that','these',
    'those','it','its','we','you','they','he','she','i','me','him','her','us',
    'them','my','your','our','their','not','no','so','as','if','when','where',
    'what','who','how','why','which','there','here','very','just','also','about',
    'up','out','all','any','more','most','into','than','then','from','after',
    'before','over','under','each','every','can','let','get','now','still',
}

def _sentence_to_queries(text: str) -> list:
    """
    Extract 2-3 distinct search queries from a sentence.
    Returns a list of short query strings.
    """
    import re
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    content = [w for w in words if w not in _STOP_WORDS]
    if not content:
        return [text[:60].strip()]
    # Deduplicate while preserving order
    seen, unique = set(), []
    for w in content:
        if w not in seen:
            seen.add(w); unique.append(w)
    queries = []
    if unique:
        queries.append(' '.join(unique[:min(4, len(unique))]))
    if len(unique) >= 6:
        queries.append(' '.join(unique[3:min(7, len(unique))]))
    elif len(unique) >= 4:
        queries.append(' '.join(unique[3:]))
    if len(unique) >= 9:
        queries.append(' '.join(unique[6:min(10, len(unique))]))
    return queries or [text[:60].strip()]


def _search_pexels_multi(
    query: str,
    duration_hint: float = 8,
    exclude_ids: set = None,
    max_clips: int = 4,
) -> list:
    """
    Search Pexels and return multiple (url, pexels_id) tuples for one query.
    Returns up to max_clips results, filtered by exclude_ids.
    """
    params = {
        "query":       query,
        "per_page":    15,
        "orientation": "landscape",
        "size":        "medium",
    }
    try:
        resp = requests.get(PEXELS_SEARCH_URL, headers=PEXELS_HEADERS, params=params, timeout=10)
        resp.raise_for_status()
        videos = resp.json().get("videos", [])
        if not videos:
            return []
        if exclude_ids:
            fresh = [v for v in videos if v["id"] not in exclude_ids]
            candidates = fresh if fresh else videos
        else:
            candidates = videos
        long_enough = [v for v in candidates if v["duration"] >= max(duration_hint - 1, 3)]
        pool = long_enough if long_enough else candidates
        results = []
        for video in pool[:max_clips]:
            files = sorted(video["video_files"], key=lambda f: f.get("width", 0), reverse=True)
            for f in files:
                if f.get("width", 0) >= 1280:
                    results.append((f["link"], video["id"]))
                    break
            else:
                if files:
                    results.append((files[0]["link"], video["id"]))
        return results
    except Exception as e:
        print(f"⚠️  Pexels multi-search '{query}': {e}")
        return []


def fetch_clip(
    query: str,
    duration_hint: float,
    video_id: str,
    segment_index: int,
    used_ids: set = None,
) -> Optional[str]:
    """
    Fetch a stock video clip for a script segment.

    used_ids: mutable set of Pexels video IDs already downloaded in this run.
              Updated in-place when a new clip is fetched.
    Returns local file path to downloaded clip, or None if fetch failed.
    """
    if used_ids is None:
        used_ids = set()

    clip_dir = config.TEMP_DIR / video_id / "clips"
    clip_dir.mkdir(parents=True, exist_ok=True)

    vid_hash      = int(hashlib.md5(video_id.encode()).hexdigest()[:4], 16)
    result_offset = (vid_hash + segment_index) % 15

    cache_key = _cache_key(query)
    clip_path = clip_dir / f"seg_{segment_index:02d}_{cache_key}.mp4"

    # Within a single run, reuse already-downloaded clips for the same query
    cached = list(clip_dir.glob(f"seg_*_{cache_key}.mp4"))
    if cached:
        print(f"📦 Cache hit for '{query}'")
        return str(cached[0])

    print(f"🎬 Fetching clip for: '{query}' (~{duration_hint:.0f}s needed, offset={result_offset})")

    url, pexels_id = _search_pexels(query, duration_hint, result_offset=result_offset, exclude_ids=used_ids)

    if not url:
        for alt_query in _expand_query(query):
            print(f"   Trying expanded query: '{alt_query}'")
            url, pexels_id = _search_pexels(alt_query, duration_hint, result_offset=result_offset, exclude_ids=used_ids)
            if url:
                print(f"   ✅ Expansion matched: '{alt_query}'")
                break

    if not url:
        print(f"   Pexels empty, trying Pixabay...")
        url = _search_pixabay(query, result_offset=result_offset)
        pexels_id = None

    if not url:
        for alt_query in _expand_query(query)[:2]:
            url = _search_pixabay(alt_query, result_offset=result_offset)
            if url:
                break

    if not url:
        print(f"❌ No clip found for '{query}' — will use fallback color")
        return None

    success = _download_clip(url, clip_path)
    if not success:
        return None

    if pexels_id:
        used_ids.add(pexels_id)

    print(f"✅ Clip saved: {clip_path.name}")
    return str(clip_path)


def fetch_clips_for_sentence(
    text: str,
    visual_query: str,
    duration: float,
    video_id: str,
    seg_index: int,
    used_ids: set = None,
) -> list:
    """
    Fetch multiple short clips for a single sentence/segment.
    Generates multiple search queries from the sentence text, searches Pexels
    with each, and downloads clips to fill the segment's time window.

    Returns list of (clip_path, clip_duration) tuples whose durations sum to <= duration.
    """
    if used_ids is None:
        used_ids = set()

    clip_dir = config.TEMP_DIR / video_id / "clips"
    clip_dir.mkdir(parents=True, exist_ok=True)

    # Build queries: visual_query first, then keyword extractions
    queries = []
    if visual_query and visual_query.strip():
        queries.append(visual_query.strip())
    for q in _sentence_to_queries(text):
        if q not in queries:
            queries.append(q)

    clip_dur_target = min(max(3.0, duration / max(len(queries), 1)), 8.0)
    result_clips    = []
    total_time      = 0.0

    for q_idx, query in enumerate(queries):
        if total_time >= duration:
            break
        remaining = duration - total_time
        multi = _search_pexels_multi(query, duration_hint=clip_dur_target, exclude_ids=used_ids, max_clips=3)
        for url, pexels_id in multi:
            if total_time >= duration:
                break
            ck    = _cache_key(f"{query}_{pexels_id}")
            cpath = clip_dir / f"seg_{seg_index:03d}_{q_idx:02d}_{ck}.mp4"
            # Reuse already-downloaded file if present
            existing = list(clip_dir.glob(f"*_{ck}.mp4"))
            if existing:
                slot = min(clip_dur_target, duration - total_time)
                result_clips.append((str(existing[0]), slot))
                total_time += slot
                continue
            if _download_clip(url, cpath):
                used_ids.add(pexels_id)
                slot = min(clip_dur_target, duration - total_time)
                result_clips.append((str(cpath), slot))
                total_time += slot

    print(f"  Seg {seg_index}: {len(result_clips)} clip(s), {total_time:.1f}/{duration:.1f}s covered")
    return result_clips


def fetch_all_clips(segments: list[dict], video_id: str) -> list[dict]:
    """
    Fetch clips for all script segments with cross-segment deduplication.
    Retries failed segments with broader queries to enforce coverage.

    Returns segments list with 'clip_path' added to each item.
    """
    print(f"\n🎬 Fetching {len(segments)} clips...")
    used_ids: set = set()  # Pexels video IDs used in this run

    enriched = []
    for i, seg in enumerate(segments):
        query    = seg.get("visual_query", "").strip()
        duration = seg.get("duration", 8)
        clip_path = None
        if query:
            clip_path = fetch_clip(query, duration, video_id, i, used_ids=used_ids)
        enriched.append({**seg, "clip_path": clip_path})

    # ── Coverage enforcement: retry failed segments with broader queries ────────
    failed = [i for i, s in enumerate(enriched) if s.get("visual_query") and not s["clip_path"]]
    if failed:
        print(f"⚠️  {len(failed)} segment(s) have no clip — retrying with broader queries...")
        for i in failed:
            seg   = enriched[i]
            query = seg.get("mood_hint") or seg.get("visual_query", "")
            # Try a shorter, simpler version of the query
            words = query.split()
            broad = " ".join(words[:3]) if len(words) > 3 else query
            clip_path = fetch_clip(broad, seg.get("duration", 8), video_id, i + 1000, used_ids=used_ids)
            if not clip_path:
                # Last resort: generic cinematic query
                clip_path = fetch_clip("cinematic nature landscape", seg.get("duration", 8), video_id, i + 2000, used_ids=used_ids)
            if clip_path:
                enriched[i] = {**seg, "clip_path": clip_path}

    found = sum(1 for s in enriched if s["clip_path"])
    print(f"✅ Clips ready: {found}/{len(segments)}")
    return enriched


def fetch_all_clips_multi(segments: list, video_id: str) -> list:
    """
    Fetch multiple clips per segment (per sentence).
    Returns an expanded list of sub-segments with precise timestamps,
    each carrying one clip_path. Segments with no clips pass through unchanged.
    """
    print(f"\n🎬 Multi-clip fetch for {len(segments)} segment(s)...")
    used_ids: set = set()
    expanded = []

    for i, seg in enumerate(segments):
        text     = seg.get("text", "")
        vq       = seg.get("visual_query", text[:60])
        s_start  = seg.get("start", 0.0)
        s_end    = seg.get("end",   seg.get("duration", 8.0))
        s_dur    = s_end - s_start

        clips = fetch_clips_for_sentence(text, vq, s_dur, video_id, i, used_ids)

        if not clips:
            expanded.append({**seg, "clip_path": None})
            continue

        t = s_start
        for clip_path, clip_dur in clips:
            actual_end = min(round(t + clip_dur, 3), s_end)
            if actual_end <= t:
                break
            expanded.append({
                "text":         text,
                "visual_query": vq,
                "start":        round(t, 3),
                "end":          actual_end,
                "duration":     round(actual_end - t, 3),
                "clip_path":    clip_path,
            })
            t = actual_end

    found = sum(1 for s in expanded if s.get("clip_path"))
    print(f"✅ Multi-clips: {found} clips across {len(expanded)} sub-segments (from {len(segments)} segments)")
    return expanded


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    segments = [
        {"text": "Today we explore the cosmos", "visual_query": "galaxy stars space", "duration": 8},
        {"text": "With a cat as our guide", "visual_query": "funny cat sitting", "duration": 5},
    ]
    result = fetch_all_clips(segments, "test-001")
    for r in result:
        print(f"  [{r['visual_query']}] → {r['clip_path']}")

