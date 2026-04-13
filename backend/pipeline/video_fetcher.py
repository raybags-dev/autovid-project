"""
AutoVid Pipeline — Step 3: Stock Image Fetcher (Ken Burns)

Fetches relevant still images from Pexels and animates them with a slow,
gentle Ken Burns zoom-in effect using FFmpeg's zoompan filter.  Each image
is converted to an MP4 clip so the rest of the pipeline receives the same
MP4 file paths as before — no other changes required downstream.

Orientation:
  - landscape (16:9) — Video Studio and Script Studio pipelines
  - portrait  (9:16) — Shorts / TikTok pipeline
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import os
import hashlib
import requests
import subprocess
from pathlib import Path
from typing import Optional
import config

# ── Pexels Images API ─────────────────────────────────────────────────────────

PEXELS_IMAGE_URL = "https://api.pexels.com/v1/search"
PEXELS_HEADERS   = {"Authorization": config.PEXELS_API_KEY}

_DARK_SUFFIX = " dark emotional theme"


def _enrich_query(query: str) -> str:
    """Append the dark-theme suffix to every Pexels query."""
    q = query.strip()
    return q if q.endswith(_DARK_SUFFIX) else q + _DARK_SUFFIX


# ── Image search ──────────────────────────────────────────────────────────────

def _search_pexels_image(
    query: str,
    orientation: str = "landscape",
    result_offset: int = 0,
    exclude_ids: set = None,
) -> tuple:
    """
    Search Pexels Images API.
    Returns (image_url, photo_id) or (None, None).
    orientation: "landscape" | "portrait" | "square"
    """
    params = {
        "query":       _enrich_query(query),
        "per_page":    15,
        "orientation": orientation,
    }
    try:
        resp = requests.get(PEXELS_IMAGE_URL, headers=PEXELS_HEADERS, params=params, timeout=10)
        resp.raise_for_status()
        photos = resp.json().get("photos", [])
        if not photos:
            return None, None

        if exclude_ids:
            fresh = [p for p in photos if p["id"] not in exclude_ids]
            candidates = fresh if fresh else photos
        else:
            candidates = photos

        photo = candidates[result_offset % len(candidates)]
        src   = photo.get("src", {})
        url   = src.get("large2x") or src.get("large") or src.get("original")
        return url, photo["id"]

    except Exception as e:
        print(f"⚠️  Pexels image search failed for '{query}': {e}")
        return None, None


def _search_pexels_images_multi(
    query: str,
    orientation: str = "landscape",
    exclude_ids: set = None,
    max_images: int = 4,
) -> list:
    """
    Search Pexels for multiple images.
    Returns list of (image_url, photo_id) tuples.
    """
    params = {
        "query":       _enrich_query(query),
        "per_page":    15,
        "orientation": orientation,
    }
    try:
        resp = requests.get(PEXELS_IMAGE_URL, headers=PEXELS_HEADERS, params=params, timeout=10)
        resp.raise_for_status()
        photos = resp.json().get("photos", [])
        if not photos:
            return []

        if exclude_ids:
            fresh = [p for p in photos if p["id"] not in exclude_ids]
            candidates = fresh if fresh else photos
        else:
            candidates = photos

        results = []
        for photo in candidates[:max_images]:
            src = photo.get("src", {})
            url = src.get("large2x") or src.get("large") or src.get("original")
            if url:
                results.append((url, photo["id"]))
        return results

    except Exception as e:
        print(f"⚠️  Pexels multi-image search '{query}': {e}")
        return []


# ── Download & Ken Burns conversion ──────────────────────────────────────────

def _download_image(url: str, dest_path: Path) -> bool:
    """Download an image (JPEG/PNG) to dest_path.  Returns True on success."""
    try:
        with requests.get(url, stream=True, timeout=30) as resp:
            resp.raise_for_status()
            with open(dest_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=1024 * 256):
                    f.write(chunk)
        size = dest_path.stat().st_size if dest_path.exists() else 0
        if size < 1024:
            print(f"⚠️  Image download produced empty file ({size}B): {dest_path.name}")
            dest_path.unlink(missing_ok=True)
            return False
        return True
    except Exception as e:
        print(f"⚠️  Image download failed: {e}")
        dest_path.unlink(missing_ok=True)
        return False


def _image_to_ken_burns_clip(
    image_path: Path,
    output_path: Path,
    duration: float,
    width: int = 1920,
    height: int = 1080,
) -> bool:
    """
    Convert a static image to an animated MP4 clip with a slow, gentle
    Ken Burns zoom-in effect using FFmpeg scale eval=frame.

    Filter chain:
      1. Scale+crop the image to WxH (cover-fill, correct aspect ratio)
      2. Per-frame scale: starts at 1.02×, grows +0.3%/s — very subtle
      3. Center-crop back to WxH so edges are never visible
      4. setsar + fps=30

    Returns True on success, False if FFmpeg failed.
    """
    vf = (
        # Step 1: fill WxH with correct aspect ratio
        f"scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},"
        # Step 2: gentle per-frame zoom (2% overhead + 0.3%/s)
        f"scale='iw*(1.02+t*0.003)':'ih*(1.02+t*0.003)':eval=frame,"
        # Step 3: center-crop back to target
        f"crop={width}:{height}:(iw-ow)/2:(ih-oh)/2,"
        f"setsar=1,fps=30"
    )
    result = subprocess.run([
        "ffmpeg", "-y",
        "-loop", "1",
        "-i", str(image_path),
        "-t", str(duration),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-an",
        str(output_path),
    ], capture_output=True)

    if result.returncode != 0 or not output_path.exists() or output_path.stat().st_size < 1024:
        err = result.stderr.decode()[-300:] if result.returncode != 0 else "empty output"
        print(f"⚠️  Ken Burns conversion failed ({image_path.name}): {err}")
        output_path.unlink(missing_ok=True)
        return False

    size_kb = output_path.stat().st_size // 1024
    print(f"  ✅ Ken Burns clip: {output_path.name} ({size_kb}KB, {duration:.1f}s)")
    return True


def _cache_key(query: str) -> str:
    """Create a filesystem-safe cache key from a search query."""
    return hashlib.md5(query.lower().strip().encode()).hexdigest()[:12]


# ── Query Expansion ──────────────────────────────────────────────────────────
# Fallback queries when the LLM's visual_query returns no results.

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
    if mood in CSS_ONLY_MOODS:
        return segments

    queries = MOOD_QUERIES.get(mood)
    if not queries:
        return segments

    enriched = []
    for i, seg in enumerate(segments):
        new_seg = dict(seg)
        mood_q  = queries[i % len(queries)]
        new_seg["visual_query"] = mood_q
        new_seg["mood_hint"]    = seg.get("visual_query", "")
        enriched.append(new_seg)

    return enriched


def _expand_query(query: str) -> list[str]:
    """Return a list of fallback search queries for abstract/conceptual topics."""
    q = query.lower().strip()
    if q in CONCEPT_EXPANSIONS:
        return CONCEPT_EXPANSIONS[q]
    for key, expansions in CONCEPT_EXPANSIONS.items():
        if key in q or q in key:
            return expansions
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
    """Extract 2-3 distinct search queries from a sentence."""
    import re
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    content = [w for w in words if w not in _STOP_WORDS]
    if not content:
        return [text[:60].strip()]
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


# ── Public API ────────────────────────────────────────────────────────────────

def generate_visual_plan(script_text: str) -> list:
    """
    Ask Groq to produce a visual plan: break the script into 4–8 sections and
    generate 3–5 concrete, visually-specific Pexels search queries per section.
    Returns list of dicts: [{section, text_snippet, queries}, ...]
    Empty list on failure (caller falls back to keyword extraction).
    """
    import json
    try:
        from groq import Groq
        import config as _cfg
        client = Groq(api_key=_cfg.GROQ_API_KEY)
        system = (
            "You are a video production assistant. Given a narration script, break it "
            "into 4–8 sequential sections and generate 3–5 Pexels stock-image search "
            "queries per section.\n\n"
            "RULES:\n"
            "- Queries must describe VISIBLE, concrete scenes — never abstract concepts\n"
            "- Good: 'elderly man walking foggy street', 'stars night sky milky way', 'ocean waves crashing rocks'\n"
            "- Bad: 'existential dread', 'the meaning of time', 'consciousness'\n"
            "- Each section must have UNIQUE queries — never repeat across sections\n"
            "- Sections must cover the ENTIRE script in order\n\n"
            "Respond ONLY with a JSON array:\n"
            '[{"section":1,"text_snippet":"first 60 chars…","queries":["…","…","…"]},…]'
        )
        resp = client.chat.completions.create(
            model=_cfg.GROQ_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": f"Script:\n\n{script_text[:5000]}"},
            ],
            temperature=0.35,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )
        raw  = resp.choices[0].message.content.strip()
        data = json.loads(raw)
        sections = data if isinstance(data, list) else next(
            (v for v in data.values() if isinstance(v, list)), []
        )
        valid = [s for s in sections if isinstance(s, dict) and s.get("queries")]
        print(f"🎬 Visual plan: {len(valid)} section(s) with queries")
        return valid
    except Exception as e:
        print(f"⚠️  Visual plan generation failed: {e}")
        return []


def fetch_clip(
    query: str,
    duration_hint: float,
    video_id: str,
    segment_index: int,
    used_ids: set = None,
    orientation: str = "landscape",
) -> Optional[str]:
    """
    Fetch a Pexels stock image and animate it with a Ken Burns zoom-in effect.
    Returns path to the generated MP4 clip, or None on failure.

    used_ids: mutable set of Pexels photo IDs already used — updated in-place.
    """
    if used_ids is None:
        used_ids = set()

    clip_dir = config.TEMP_DIR / video_id / "clips"
    clip_dir.mkdir(parents=True, exist_ok=True)

    vid_hash      = int(hashlib.md5(video_id.encode()).hexdigest()[:4], 16)
    result_offset = (vid_hash + segment_index) % 15

    cache_key = _cache_key(query)
    clip_path = clip_dir / f"seg_{segment_index:02d}_{cache_key}.mp4"

    # Reuse already-generated Ken Burns clip for the same query
    cached = list(clip_dir.glob(f"seg_*_{cache_key}.mp4"))
    if cached:
        print(f"📦 Cache hit for '{query}'")
        return str(cached[0])

    print(f"🖼️  Fetching image: '{query}' ({orientation}, ~{duration_hint:.0f}s)")

    url, photo_id = _search_pexels_image(query, orientation, result_offset=result_offset, exclude_ids=used_ids)

    if not url:
        for alt_query in _expand_query(query):
            print(f"   Trying expanded query: '{alt_query}'")
            url, photo_id = _search_pexels_image(alt_query, orientation, result_offset=result_offset, exclude_ids=used_ids)
            if url:
                print(f"   ✅ Expansion matched: '{alt_query}'")
                break

    if not url:
        print(f"❌ No image found for '{query}' — will use fallback color")
        return None

    W = 1920 if orientation != "portrait" else 1080
    H = 1080 if orientation != "portrait" else 1920

    img_path = clip_dir / f"img_{segment_index:02d}_{cache_key}.jpg"
    if not _download_image(url, img_path):
        return None

    if not _image_to_ken_burns_clip(img_path, clip_path, duration_hint, W, H):
        img_path.unlink(missing_ok=True)
        return None

    img_path.unlink(missing_ok=True)

    if photo_id:
        used_ids.add(photo_id)

    print(f"✅ Clip saved: {clip_path.name}")
    return str(clip_path)


def fetch_clips_for_sentence(
    text: str,
    visual_query: str,
    duration: float,
    video_id: str,
    seg_index: int,
    used_ids: set = None,
    orientation: str = "landscape",
) -> list:
    """
    Fetch multiple short Ken Burns clips for a single sentence/segment.
    Returns list of (clip_path, clip_duration) tuples.
    """
    if used_ids is None:
        used_ids = set()

    clip_dir = config.TEMP_DIR / video_id / "clips"
    clip_dir.mkdir(parents=True, exist_ok=True)

    W = 1920 if orientation != "portrait" else 1080
    H = 1080 if orientation != "portrait" else 1920

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
        multi = _search_pexels_images_multi(query, orientation=orientation, exclude_ids=used_ids, max_images=3)
        for url, photo_id in multi:
            if total_time >= duration:
                break
            ck    = _cache_key(f"{query}_{photo_id}")
            cpath = clip_dir / f"seg_{seg_index:03d}_{q_idx:02d}_{ck}.mp4"

            if cpath.exists() and cpath.stat().st_size > 1024:
                slot = min(clip_dur_target, duration - total_time)
                result_clips.append((str(cpath), slot))
                total_time += slot
                continue

            img_path = clip_dir / f"img_{seg_index:03d}_{q_idx:02d}_{ck}.jpg"
            if _download_image(url, img_path):
                used_ids.add(photo_id)
                slot = min(clip_dur_target, duration - total_time)
                if _image_to_ken_burns_clip(img_path, cpath, slot, W, H):
                    result_clips.append((str(cpath), slot))
                    total_time += slot
                img_path.unlink(missing_ok=True)

    print(f"  Seg {seg_index}: {len(result_clips)} clip(s), {total_time:.1f}/{duration:.1f}s covered")
    return result_clips


def fetch_all_clips(segments: list[dict], video_id: str, orientation: str = "landscape") -> list[dict]:
    """
    Fetch Ken Burns clips for all script segments with cross-segment deduplication.
    Returns segments list with 'clip_path' added to each item.
    """
    print(f"\n🖼️  Fetching {len(segments)} image clips ({orientation})...")
    used_ids: set = set()

    enriched = []
    for i, seg in enumerate(segments):
        query     = seg.get("visual_query", "").strip()
        duration  = seg.get("duration", 8)
        clip_path = None
        if query:
            clip_path = fetch_clip(query, duration, video_id, i, used_ids=used_ids, orientation=orientation)
        enriched.append({**seg, "clip_path": clip_path})

    # Retry failed segments with broader queries
    failed = [i for i, s in enumerate(enriched) if s.get("visual_query") and not s["clip_path"]]
    if failed:
        print(f"⚠️  {len(failed)} segment(s) have no clip — retrying with broader queries...")
        for i in failed:
            seg   = enriched[i]
            query = seg.get("mood_hint") or seg.get("visual_query", "")
            words = query.split()
            broad = " ".join(words[:3]) if len(words) > 3 else query
            clip_path = fetch_clip(broad, seg.get("duration", 8), video_id, i + 1000, used_ids=used_ids, orientation=orientation)
            if not clip_path:
                clip_path = fetch_clip("cinematic nature landscape", seg.get("duration", 8), video_id, i + 2000, used_ids=used_ids, orientation=orientation)
            if clip_path:
                enriched[i] = {**seg, "clip_path": clip_path}

    found = sum(1 for s in enriched if s["clip_path"])
    print(f"✅ Clips ready: {found}/{len(segments)}")
    return enriched


def fetch_clips_for_plan(
    plan: list,
    segments: list,
    video_id: str,
    orientation: str = "landscape",
) -> list:
    """
    Fetch Ken Burns image clips according to an LLM-generated visual plan and
    map them to the correct time windows derived from the aligned segment timing.

    Returns an expanded list of sub-segments suitable for composite_stock_on_background().
    """
    if not plan or not segments:
        return []

    W = 1920 if orientation != "portrait" else 1080
    H = 1080 if orientation != "portrait" else 1920

    # Map plan sections to time windows via character-offset proportion
    full_text   = " ".join(s.get("text", "") for s in segments)
    total_dur   = max((s.get("end", 0) for s in segments), default=60.0)
    total_chars = max(len(full_text), 1)

    offsets = []
    search_from = 0
    for sect in plan:
        snippet = sect.get("text_snippet", "")[:50].strip()
        idx = full_text.find(snippet, search_from) if snippet else -1
        if idx >= 0:
            offsets.append(idx)
            search_from = idx + 1
        else:
            offsets.append(int(search_from + total_chars / max(len(plan), 1)))

    timed = []
    for i, (sect, off) in enumerate(zip(plan, offsets)):
        next_off = offsets[i + 1] if i + 1 < len(offsets) else total_chars
        t_start  = round(off / total_chars * total_dur, 3)
        t_end    = round(next_off / total_chars * total_dur, 3)
        if t_end <= t_start:
            t_end = min(t_start + (total_dur / len(plan)), total_dur)
        timed.append({**sect, "t_start": t_start, "t_end": t_end})

    clip_dir = config.TEMP_DIR / video_id / "clips"
    clip_dir.mkdir(parents=True, exist_ok=True)

    used_ids: set = set()
    result: list  = []

    for sect_idx, sect in enumerate(timed):
        t_start  = sect["t_start"]
        t_end    = sect["t_end"]
        s_dur    = t_end - t_start
        queries  = sect.get("queries", [])
        max_imgs = min(len(queries), 4)

        if s_dur <= 0 or not queries:
            result.append({"start": t_start, "end": t_end, "duration": s_dur,
                           "clip_path": None, "text": sect.get("text_snippet", "")})
            continue

        slot_dur = min(max(s_dur / max(max_imgs, 1), 3.0), 12.0)

        clips_fetched = []
        for q_idx, query in enumerate(queries):
            if sum(c[1] for c in clips_fetched) >= s_dur:
                break
            multi = _search_pexels_images_multi(query, orientation=orientation,
                                                exclude_ids=used_ids, max_images=2)
            for url, photo_id in multi:
                if sum(c[1] for c in clips_fetched) >= s_dur:
                    break
                ck    = _cache_key(f"{query}_{photo_id}")
                cpath = clip_dir / f"plan_{sect_idx:03d}_{q_idx:02d}_{ck}.mp4"

                if cpath.exists() and cpath.stat().st_size > 1024:
                    clips_fetched.append((str(cpath), slot_dur))
                    used_ids.add(photo_id)
                    continue

                img_path = clip_dir / f"img_plan_{sect_idx:03d}_{q_idx:02d}_{ck}.jpg"
                if _download_image(url, img_path):
                    used_ids.add(photo_id)
                    if _image_to_ken_burns_clip(img_path, cpath, slot_dur, W, H):
                        clips_fetched.append((str(cpath), slot_dur))
                    img_path.unlink(missing_ok=True)

        if not clips_fetched:
            result.append({"start": t_start, "end": t_end, "duration": s_dur,
                           "clip_path": None, "text": sect.get("text_snippet", "")})
            continue

        # Assign clips sequentially within this section's window
        t = t_start
        for clip_path, clip_dur in clips_fetched:
            actual_end = min(round(t + clip_dur, 3), t_end)
            if actual_end <= t:
                break
            result.append({
                "start":        round(t, 3),
                "end":          actual_end,
                "duration":     round(actual_end - t, 3),
                "clip_path":    clip_path,
                "text":         sect.get("text_snippet", ""),
                "visual_query": queries[0] if queries else "",
            })
            t = actual_end

        print(f"  Section [{t_start:.1f}–{t_end:.1f}s]: {len(clips_fetched)} clip(s), "
              f"{sum(c[1] for c in clips_fetched):.1f}/{s_dur:.1f}s covered")

    found = sum(1 for s in result if s.get("clip_path"))
    print(f"✅ Visual plan: {found} Ken Burns clips across {len(result)} sub-segments")
    return result


def fetch_all_clips_multi(
    segments: list,
    video_id: str,
    orientation: str = "landscape",
) -> list:
    """
    Fetch multiple Ken Burns clips per segment (per sentence).
    Returns an expanded list of sub-segments with precise timestamps.
    """
    print(f"\n🖼️  Multi-clip fetch for {len(segments)} segment(s) ({orientation})...")
    used_ids: set = set()
    expanded = []

    for i, seg in enumerate(segments):
        text    = seg.get("text", "")
        vq      = seg.get("visual_query", text[:60])
        s_start = seg.get("start", 0.0)
        s_end   = seg.get("end",   seg.get("duration", 8.0))
        s_dur   = s_end - s_start

        clips = fetch_clips_for_sentence(text, vq, s_dur, video_id, i,
                                         used_ids, orientation=orientation)

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
        {"text": "With wonder as our guide", "visual_query": "person watching stars", "duration": 5},
    ]
    result = fetch_all_clips(segments, "test-001")
    for r in result:
        print(f"  [{r['visual_query']}] → {r['clip_path']}")
