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


def _search_pexels(query: str, duration_hint: float = 10) -> Optional[str]:
    """
    Search Pexels for a video matching the query.
    Returns the download URL of the best match, or None.
    """
    params = {
        "query": query,
        "per_page": 10,
        "orientation": "landscape",
        "size": "medium",
    }
    try:
        resp = requests.get(PEXELS_SEARCH_URL, headers=PEXELS_HEADERS, params=params, timeout=10)
        resp.raise_for_status()
        videos = resp.json().get("videos", [])
        if not videos:
            return None

        # Pick a video that's long enough for our segment
        for video in videos:
            if video["duration"] >= max(duration_hint - 1, 3):
                # Find HD or Full HD file
                files = sorted(video["video_files"], key=lambda f: f.get("width", 0), reverse=True)
                for f in files:
                    if f.get("width", 0) >= 1280:
                        return f["link"]

        # Fallback: return best quality from first result
        files = sorted(videos[0]["video_files"], key=lambda f: f.get("width", 0), reverse=True)
        return files[0]["link"] if files else None

    except Exception as e:
        print(f"⚠️  Pexels search failed for '{query}': {e}")
        return None


def _search_pixabay(query: str) -> Optional[str]:
    """
    Fallback to Pixabay if Pexels fails or returns nothing.
    """
    params = {
        "key": config.PIXABAY_API_KEY,
        "q": query,
        "video_type": "film",
        "per_page": 5,
    }
    try:
        resp = requests.get(PIXABAY_SEARCH_URL, params=params, timeout=10)
        resp.raise_for_status()
        hits = resp.json().get("hits", [])
        if not hits:
            return None

        # Get highest quality available
        videos = hits[0].get("videos", {})
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


def fetch_clip(query: str, duration_hint: float, video_id: str, segment_index: int) -> Optional[str]:
    """
    Fetch a stock video clip for a script segment.

    Args:
        query: Visual description to search for (from script segment)
        duration_hint: Approximate seconds this clip needs to fill
        video_id: Parent video ID (for file naming)
        segment_index: Position in the video (for file naming)

    Returns:
        Local file path to downloaded clip, or None if fetch failed
    """
    clip_dir = config.TEMP_DIR / video_id / "clips"
    clip_dir.mkdir(parents=True, exist_ok=True)

    # Check cache first (reuse clips with same query)
    cache_key = _cache_key(query)
    cached = list(clip_dir.glob(f"cache_{cache_key}.*"))
    if cached:
        print(f"📦 Cache hit for '{query}'")
        return str(cached[0])

    clip_path = clip_dir / f"seg_{segment_index:02d}_{cache_key}.mp4"

    print(f"🎬 Fetching clip for: '{query}' (~{duration_hint:.0f}s needed)")

    # Try Pexels with original query
    url = _search_pexels(query, duration_hint)

    # Try expanded/conceptual fallback queries
    if not url:
        expansions = _expand_query(query)
        for alt_query in expansions:
            print(f"   Trying expanded query: '{alt_query}'")
            url = _search_pexels(alt_query, duration_hint)
            if url:
                print(f"   ✅ Expansion matched: '{alt_query}'")
                break

    # Fallback to Pixabay with original query
    if not url:
        print(f"   Pexels empty, trying Pixabay...")
        url = _search_pixabay(query)

    # Pixabay with expanded queries
    if not url:
        for alt_query in _expand_query(query)[:2]:
            url = _search_pixabay(alt_query)
            if url:
                break

    if not url:
        print(f"❌ No clip found for '{query}' — will use fallback color")
        return None

    success = _download_clip(url, clip_path)
    if not success:
        return None

    print(f"✅ Clip saved: {clip_path.name}")
    return str(clip_path)


def fetch_all_clips(segments: list[dict], video_id: str) -> list[dict]:
    """
    Fetch clips for all script segments.
    Skips empty visual_query (outro/hook), uses a simple fallback.

    Args:
        segments: List of timed segments from align_segments_to_audio()
        video_id: Parent video ID

    Returns:
        segments list with 'clip_path' added to each item
    """
    print(f"\n🎬 Fetching {len(segments)} clips...")
    enriched = []
    for i, seg in enumerate(segments):
        query = seg.get("visual_query", "").strip()
        duration = seg.get("duration", 8)

        clip_path = None
        if query:
            clip_path = fetch_clip(query, duration, video_id, i)

        enriched.append({**seg, "clip_path": clip_path})

    found = sum(1 for s in enriched if s["clip_path"])
    print(f"✅ Clips ready: {found}/{len(segments)}")
    return enriched


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    segments = [
        {"text": "Today we explore the cosmos", "visual_query": "galaxy stars space", "duration": 8},
        {"text": "With a cat as our guide", "visual_query": "funny cat sitting", "duration": 5},
    ]
    result = fetch_all_clips(segments, "test-001")
    for r in result:
        print(f"  [{r['visual_query']}] → {r['clip_path']}")

