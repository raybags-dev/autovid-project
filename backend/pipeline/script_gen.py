"""
AutoVid Pipeline — Step 1: Script Generator
Uses Groq (free LLM API) to generate a full video script from a prompt.

Output:
  - Catchy YouTube title
  - SEO description
  - Full narration script split into timed segments
  - Visual cues per segment (used to fetch stock footage)
  - Suggested tags/labels
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import json
from groq import Groq
import config

_client = None


def get_groq() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=config.GROQ_API_KEY)
    return _client


# ── Channel Profiles ─────────────────────────────────────────────────────────

CHANNEL_PROFILES = {
    "educational": {
        "name": "Educational",
        "description": "thoughtful essayist and knowledge communicator — think Kurzgesagt meets David Attenborough",
        "tone": "curious, clear, emotionally resonant, and mind-expanding. Make complex ideas feel exciting and deeply human. Never cold or clinical.",
        "style_rules": [
            "Open with a question or observation that immediately reframes how the viewer sees the topic",
            "Build the essay in layers — each segment adds a new dimension, not just a new fact",
            "Use vivid analogies, real human examples, and sensory language",
            "Let emotion live alongside information — this is not a lecture, it's an experience",
            "End with a broader truth or implication the viewer will carry with them",
        ],
    },
    "serious": {
        "name": "Serious",
        "description": "authoritative documentary narrator with deep emotional intelligence",
        "tone": "measured, weighty, and deeply human. No jokes, no fluff. Every word earns its place. Like a great documentary that stays with you.",
        "style_rules": [
            "Open with a striking image, statistic, or human moment — no generic introductions",
            "Build with deliberate momentum — each segment tightens the narrative",
            "Use contrast: the small and the vast, the personal and the universal",
            "Trust the viewer's intelligence — don't over-explain",
            "End with something the viewer needs to sit with — a truth, not a summary",
        ],
    },
    "inspirational": {
        "name": "Inspirational",
        "description": "master storyteller who speaks to the human heart",
        "tone": "warm, intimate, and emotionally powerful. Speak directly to the viewer's deepest experiences. Like a great TED talk — but more honest, less polished.",
        "style_rules": [
            "Open with a moment of real human vulnerability or universal longing",
            "Build the arc from struggle to understanding — not struggle to triumph, but struggle to wisdom",
            "Use 'you' and 'we' — this is a conversation, not a speech",
            "Weave in specific, concrete human details that make it feel true",
            "End with something that feels like a gift — a reframe, a permission, a truth",
        ],
    },
    "reflective": {
        "name": "Reflective",
        "description": "philosophical essayist in the tradition of Alan Watts and Oliver Burkeman",
        "tone": "quiet, deep, and unhurried. This is for people who stop and think. No rush, no hype. Pure contemplation turned into language.",
        "style_rules": [
            "Open with a paradox, a contradiction, or something that doesn't quite add up",
            "Move slowly — let ideas breathe and unfold rather than march",
            "Question assumptions the viewer didn't know they had",
            "Use silence and space in the rhythm of the writing",
            "End open-endedly — leave the viewer with more questions than answers, but richer ones",
        ],
    },
    "funny": {
        "name": "Funny",
        "description": "sharp, self-aware comedian who uses humour to reveal truth",
        "tone": "witty, irreverent, but always with a point. The comedy serves the insight, not the other way around.",
        "style_rules": [
            "Open with an absurd or unexpectedly honest hook",
            "Use comic timing — the setup matters as much as the punchline",
            "Let humour be a vehicle for real observations about life",
            "Subvert expectations mid-segment for maximum impact",
            "End with a laugh that also makes them think",
        ],
    },
}

DEFAULT_PROFILE = "educational"


def get_system_prompt(profile: str = DEFAULT_PROFILE) -> str:
    p = CHANNEL_PROFILES.get(profile, CHANNEL_PROFILES[DEFAULT_PROFILE])
    rules_str = "\n".join(f"- {r}" for r in p["style_rules"])
    return f"""You are a {p["description"]} writing deeply thoughtful YouTube video scripts.
Tone: {p["tone"]}

Profile-specific rules:
{rules_str}

CORE REQUIREMENT — LENGTH:
- Target 420-480 words of narration (approximately 3 minutes at natural speaking pace)
- This is a MINIMUM. Do not write short scripts. Develop the topic fully.
- Write 8-12 segments, each 30-50 words, covering distinct angles of the topic

WRITING QUALITY:
- Write a real essay — not a list of facts, not a surface overview
- Each segment must earn its place: a new perspective, a deeper layer, an emotional beat
- Use vivid, concrete language. Avoid vague generalities.
- Speak directly to the viewer — use "you", "we", "us"
- Let silence live in the words — rhythm and pacing matter as much as content
- Write EXACTLY as it should be spoken — natural human speech only
- Use commas, periods, and ellipsis (...) for natural pauses
- NEVER use [PAUSE], [BEAT], or any bracketed stage directions
- NEVER use asterisks, hashtags, or markdown formatting
- Always respond in valid JSON only — no markdown, no explanation
"""


# Legacy single prompt kept for backward compat
SYSTEM_PROMPT = get_system_prompt("educational")

SCRIPT_SCHEMA = """
Return ONLY this JSON structure — no markdown, no explanation, only raw JSON:
{
  "title": "YouTube video title (max 70 chars, compelling, no clickbait emoji spam — one emoji max)",
  "description": "YouTube description: 3-4 sentences, SEO-rich, emotionally resonant summary of the video",
  "hook": "Opening line — 1-2 sentences max. Must grab attention in the first 3 seconds. Ask a question, make a bold claim, or drop a striking image.",
  "segments": [
    {
      "text": "Narration for this segment. Each segment should be 30-50 words. Write 8-12 segments total to reach ~450 words of total narration. Each segment is a complete thought — a layer of the essay, not a bullet point.",
      "visual_query": "Cinematic stock video query for this exact emotional/narrative moment. Be specific and visual. Examples: 'elderly woman looking out rain-streaked window', 'timelapse city dawn fog clearing', 'hands writing in journal candlelight', 'child running through wheat field golden hour'. NEVER use abstract queries like 'concept' or 'background'.",
      "duration_hint": 18
    }
  ],
  "outro": "Closing 2-3 sentences. Leave the viewer with something — a question, a feeling, a truth to carry with them.",
  "suggested_labels": ["Philosophy", "Life"],
  "category": "Education",
  "mood": "inspirational"
}

Categories: Education, Entertainment, Science, Technology, Lifestyle, Philosophy, Health, Society
Mood options: inspirational, educational, dramatic, reflective, serious
"""

_PROMO_FOOTER_BASE = """

Feel free to subscribe. And post your thoughts on www.4lifemystery.com in the community section. I'd love to hear thoughts on this topic

🌐 Website: https://4lifemystery.com
🎧 Spotify: https://open.spotify.com/show/31b1tuqETLGjz0Oq6oqE8d
📺 YouTube: https://www.youtube.com/@4life_mystery/videos

Hashtags:
#Existential #LifeMystery #LifeReflection #Mortality #Philosophy #DeepThoughts #Mindfulness #HumanExperience #Regret"""

_PROMO_FOOTER_SENTINEL = "Feel free to subscribe."


def _title_to_hashtag(title: str) -> str:
    """Convert a video title to a CamelCase hashtag, e.g. 'Why Does Life Feel Meaningless?' → '#WhyDoesLifeFeelMeaningless'"""
    import re
    words = re.sub(r"[^a-zA-Z0-9 ]", "", title).split()
    return "#" + "".join(w.capitalize() for w in words if w)


def _append_promo_footer(description: str, title: str = None) -> str:
    """Append the standard 4Life Mystery promotion footer to a description.
    If title is provided, it is appended as the last hashtag."""
    if _PROMO_FOOTER_SENTINEL in (description or ""):
        return description  # already present
    title_tag = (" " + _title_to_hashtag(title)) if title else ""
    footer = _PROMO_FOOTER_BASE + title_tag
    return (description or "").rstrip() + footer


def generate_script(prompt: str, profile: str = DEFAULT_PROFILE) -> dict:
    """
    Generate a full video script from a user prompt.

    Args:
        prompt:  The video idea, e.g. "A cat explains quantum physics"
        profile: Channel profile — "educational" | "serious" | "inspirational" | "funny"

    Returns:
        dict with title, description, hook, segments, outro, labels, etc.
    """
    p = CHANNEL_PROFILES.get(profile, CHANNEL_PROFILES[DEFAULT_PROFILE])
    print(f"📝 Generating script [{p['name']}]: '{prompt}'")

    client = get_groq()
    response = client.chat.completions.create(
        model=config.GROQ_MODEL,
        messages=[
            {"role": "system", "content": get_system_prompt(profile) + SCRIPT_SCHEMA},
            {"role": "user", "content": f"Write a deeply thoughtful, emotionally resonant 3-minute video essay about: {prompt}\n\nRemember: target ~450 words across 8-12 segments. This is a proper essay, not a list. Make it beautiful."},
        ],
        temperature=0.82,
        max_tokens=4096,   # longer essays need more tokens
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    script_data = json.loads(raw)

    # Validate required fields
    required = ["title", "description", "hook", "segments", "outro", "suggested_labels", "category"]
    for field in required:
        if field not in script_data:
            raise ValueError(f"Script missing required field: {field}")

    if not script_data["segments"]:
        raise ValueError("Script has no segments")

    # Build the full narration string (hook + segments + outro)
    all_lines = [script_data["hook"]]
    all_lines += [seg["text"] for seg in script_data["segments"]]
    all_lines.append(script_data["outro"])
    # Leading + trailing silence markers keep ElevenLabs at full volume throughout.
    # Leading ". . ." prevents the soft-attack fade-in at the start of synthesis;
    # trailing ". . ." prevents the voice fading out before the last word.
    script_data["full_narration"] = ". . .  " + " ".join(all_lines) + "  . . ."

    # Estimate total duration (rough: 140 words per minute)
    word_count = len(script_data["full_narration"].split())
    script_data["estimated_duration"] = int((word_count / 150) * 60)  # ~150 wpm natural speech

    # Append standard promotion footer to every description
    script_data["description"] = _append_promo_footer(script_data.get("description", ""), title=script_data.get("title"))

    print(f"✅ Script generated: '{script_data['title']}'")
    print(f"   Segments: {len(script_data['segments'])}, ~{script_data['estimated_duration']}s")

    return script_data


SHORT_SCRIPT_SCHEMA = """
Return ONLY this JSON structure — no markdown, no explanation, only raw JSON:
{
  "title": "Short title (max 60 chars, punchy, one emoji max)",
  "description": "YouTube Shorts description: 1-2 sentences, emotionally resonant",
  "hook": "Opening hook — 1 sentence max. Bold claim, striking image, or question. Under 15 words.",
  "segments": [
    {
      "text": "Narration segment. Each segment 20-30 words. Write exactly 5-6 segments.",
      "visual_query": "Cinematic portrait/vertical stock video query. Be specific and visual.",
      "duration_hint": 12
    }
  ],
  "outro": "Closing 1-2 sentences. Leave the viewer with something real. Under 20 words.",
  "suggested_labels": ["Philosophy", "Life"],
  "category": "Education",
  "mood": "inspirational"
}
"""


# Creative angles injected per generation to guarantee unique content
# even when the same topic is reused across cycles.
SHORT_ANGLES = [
    "from a deeply personal, human-story perspective — make it feel like a confession",
    "through the lens of modern neuroscience and psychology — what the science actually reveals",
    "from a philosophical and existential angle — question what we assume to be true",
    "with surprising, counterintuitive insights that challenge everything the viewer thinks they know",
    "through forgotten historical stories and real human examples most people have never heard",
    "from the perspective of what we never say out loud — the uncomfortable truth",
    "through the lens of nature and the natural world — use animals, ecosystems, physics as metaphor",
    "with a focus on the emotional and spiritual dimensions — what it means to be human",
    "through the lens of culture clash — how different civilisations have answered this differently",
    "from the angle of what children understand that adults have forgotten",
]


def generate_short_script(prompt: str, angle: str = None) -> dict:
    """
    Generate a short-form script targeting ~450 words (~2.5 min at 150wpm).
    Shorts must always be at least 2 minutes long.

    angle: optional creative lens injected into the prompt to guarantee uniqueness
           when the same topic is generated multiple times.
    """
    print(f"📝 Generating short script: '{prompt}'" + (f" [angle: {angle[:40]}...]" if angle else ""))

    angle_directive = f"\n\nCreative angle — approach this EXCLUSIVELY through this lens: {angle}" if angle else ""

    client = get_groq()
    system = (
        "You are a YouTube Shorts writer crafting emotionally powerful 2-minute scripts.\n"
        "STRICT RULES:\n"
        "- Total narration MUST be 400-480 words (fits 2.5 minutes at natural pace)\n"
        "- Hook: 20-25 words — grab attention immediately\n"
        "- Segments: exactly 8-10 segments, each 35-50 words\n"
        "- Outro: 20-25 words — powerful closing call-to-action\n"
        "- No filler, no padding. Every word must earn its place.\n"
        "- Write EXACTLY as it should be spoken — natural human speech\n"
        "- Use commas and ellipsis (...) for natural pauses\n"
        "- NEVER use brackets, asterisks, hashtags, or markdown\n"
        "- Always respond in valid JSON only\n"
    )
    response = client.chat.completions.create(
        model=config.GROQ_MODEL,
        messages=[
            {"role": "system", "content": system + SHORT_SCRIPT_SCHEMA},
            {"role": "user", "content": f"Write a powerful 2-minute YouTube Short about: {prompt}{angle_directive}\n\nTarget 400-480 words total. Use 8-10 segments of 35-50 words each. Make every word count."},
        ],
        temperature=0.82,
        max_tokens=2048,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    script_data = json.loads(raw)

    required = ["title", "description", "hook", "segments", "outro", "suggested_labels", "category"]
    for field in required:
        if field not in script_data:
            raise ValueError(f"Short script missing required field: {field}")

    # Soft-enforce word limits — prevent runaway segments but allow generous content
    def _truncate_words(text: str, max_words: int) -> str:
        words = text.split()
        if len(words) <= max_words:
            return text
        truncated = words[:max_words]
        result = " ".join(truncated)
        if result and result[-1] not in ".!?":
            result += "."
        return result

    script_data["hook"] = _truncate_words(script_data["hook"], 30)

    # Allow up to 10 segments, each 55 words max
    segments = script_data["segments"][:10]
    for seg in segments:
        seg["text"] = _truncate_words(seg["text"], 55)
    script_data["segments"] = segments

    script_data["outro"] = _truncate_words(script_data["outro"], 30)

    all_lines = [script_data["hook"]]
    all_lines += [seg["text"] for seg in script_data["segments"]]
    all_lines.append(script_data["outro"])
    script_data["full_narration"] = ". . .  " + " ".join(all_lines) + "  . . ."

    word_count = len(script_data["full_narration"].split())
    script_data["estimated_duration"] = int((word_count / 150) * 60)
    script_data["is_short"] = True
    script_data["description"] = _append_promo_footer(script_data.get("description", ""), title=script_data.get("title"))

    print(f"✅ Short script generated: '{script_data['title']}'")
    print(f"   Words: {word_count}, estimated {script_data['estimated_duration']}s ({script_data['estimated_duration']//60}m {script_data['estimated_duration']%60}s)")

    return script_data


def _strip_emoji(text: str) -> str:
    """Remove emoji characters that can confuse Groq's JSON mode."""
    import re
    return re.sub(
        r'[\U00010000-\U0010ffff\U0001F300-\U0001F9FF\U00002600-\U000027BF]',
        '', text, flags=re.UNICODE,
    ).strip()


def generate_labels(title: str, description: str, script: str) -> dict:
    """
    Auto-generate labels and category for an existing script.
    Used in the labeling pipeline step.
    Retries once with a stripped/simplified prompt on JSON validation failure.
    """
    import re as _re

    safe_title = _strip_emoji(title)
    safe_desc  = _strip_emoji((description or "")[:200])
    safe_script = _strip_emoji((script or "")[:300])

    def _call(t, d, s):
        client = get_groq()
        return client.chat.completions.create(
            model=config.GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a YouTube SEO expert. Return ONLY valid JSON with no markdown, no extra text.",
                },
                {
                    "role": "user",
                    "content": (
                        f'Video title: "{t}"\n'
                        f'Description: "{d}"\n'
                        f'Script: "{s}"\n\n'
                        'Return JSON exactly like this:\n'
                        '{"labels":["Education","Lifestyle"],"category":"Education",'
                        '"youtube_tags":["tag1","tag2","tag3"]}'
                    ),
                },
            ],
            temperature=0.1,
            max_tokens=200,
            response_format={"type": "json_object"},
        )

    # First attempt
    try:
        resp = _call(safe_title, safe_desc, safe_script)
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        print(f"⚠️  generate_labels first attempt failed ({e}) — retrying with minimal prompt")

    # Retry with bare-minimum prompt to avoid any JSON generation issues
    try:
        client = get_groq()
        resp2 = client.chat.completions.create(
            model=config.GROQ_MODEL,
            messages=[
                {"role": "system", "content": "Return ONLY valid JSON. No markdown."},
                {"role": "user", "content": (
                    f'Topic: "{safe_title}". '
                    'Give YouTube labels and category. '
                    'JSON only: {"labels":["L1","L2"],"category":"C","youtube_tags":["t1","t2","t3"]}'
                )},
            ],
            temperature=0.1,
            max_tokens=150,
            response_format={"type": "json_object"},
        )
        return json.loads(resp2.choices[0].message.content)
    except Exception as e2:
        print(f"⚠️  generate_labels retry also failed ({e2}) — using fallback labels")
        # Safe fallback so the pipeline never hard-fails on this step
        return {"labels": ["Education", "Lifestyle"], "category": "Education", "youtube_tags": []}


def generate_description(title: str, script: str) -> str:
    """
    Generate a YouTube-ready SEO description for a Script Studio video.
    Used when the user writes their own script (no AI script generation),
    so the stored description is meaningful rather than a word-count placeholder.

    Returns the description string with the promo footer already appended.
    Falls back to a bare title-based string if Groq fails.
    """
    print(f"📝 Generating description for: '{title}'")
    # Use up to ~600 words of the script as context — enough for Groq to capture
    # the tone and subject matter without hitting token limits.
    excerpt = " ".join(script.split()[:600])
    try:
        client = get_groq()
        response = client.chat.completions.create(
            model=config.GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a YouTube SEO copywriter. "
                        "Write emotionally resonant, search-optimised YouTube descriptions. "
                        "Return ONLY valid JSON. No markdown."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Write a YouTube description for this video.\n\n"
                        f"Title: {title}\n\n"
                        f"Script excerpt:\n{excerpt}\n\n"
                        f'Return JSON: {{"description": "3-4 sentences. '
                        f"SEO-rich, emotionally resonant summary. "
                        f'No hashtags, no links — those are added separately."}}'
                    ),
                },
            ],
            temperature=0.7,
            max_tokens=300,
            response_format={"type": "json_object"},
        )
        raw = json.loads(response.choices[0].message.content)
        desc = raw.get("description", "").strip()
        if not desc:
            raise ValueError("Empty description returned")
        print(f"✅ Description generated ({len(desc)} chars)")
    except Exception as e:
        print(f"⚠️  Description generation failed ({e}) — using title fallback")
        desc = title

    return _append_promo_footer(desc, title=title)


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    result = generate_script("A penguin tries stand-up comedy at a corporate event")
    print(json.dumps(result, indent=2))

