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
    "funny": {
        "name": "Funny",
        "description": "viral YouTube comedian",
        "tone": "funny, energetic, and irreverent. Use wit, absurdist humour, comic timing, and unexpected punchlines. Keep it light — no dark or offensive jokes.",
        "style_rules": [
            "Open with a ridiculous hook that makes people laugh immediately",
            "Use comic timing — short setup, big payoff",
            "Self-aware, playful tone throughout",
            "End on a laugh or a twist",
        ],
    },
    "serious": {
        "name": "Serious",
        "description": "authoritative documentary-style narrator",
        "tone": "clear, confident, and informative. No jokes. Deliver facts and insights with weight and credibility.",
        "style_rules": [
            "Open with a bold, compelling statement of fact",
            "Build narrative with evidence and momentum",
            "Measured, authoritative tone — no fluff",
            "End with a strong takeaway or call to reflection",
        ],
    },
    "educational": {
        "name": "Educational",
        "description": "engaging science/knowledge communicator like Kurzgesagt",
        "tone": "curious, clear, and mind-expanding. Make complex ideas feel exciting and accessible.",
        "style_rules": [
            "Open with a surprising question or counterintuitive fact",
            "Break down complex ideas into simple vivid language",
            "Use analogies and real-world examples",
            "End with a broader implication that makes viewers think",
        ],
    },
    "inspirational": {
        "name": "Inspirational",
        "description": "motivational speaker and storyteller",
        "tone": "warm, uplifting, and human. Speak directly to the viewer's emotions and ambitions.",
        "style_rules": [
            "Open with a relatable struggle or universal truth",
            "Build emotional momentum through story",
            "Use 'you' to speak directly to the viewer",
            "End with a powerful, memorable call to action",
        ],
    },
}

DEFAULT_PROFILE = "funny"


def get_system_prompt(profile: str = DEFAULT_PROFILE) -> str:
    p = CHANNEL_PROFILES.get(profile, CHANNEL_PROFILES[DEFAULT_PROFILE])
    rules_str = "".join(f"- {r}" for r in p["style_rules"])
    return f"""You are a {p["description"]} writing YouTube video scripts.
Tone: {p["tone"]}

Profile-specific rules:
{rules_str}

Universal rules:
- Keep total narration under 90 seconds (about 200-250 words)
- Use short punchy sentences
- Write EXACTLY as it should be spoken — natural human speech only
- Use commas, periods, and ellipsis (...) for natural pauses and timing
- NEVER use [PAUSE], [BEAT], [LAUGHTER] or any bracketed stage directions
- NEVER use asterisks, hashtags, or any markdown formatting
- Always respond in valid JSON only — no markdown, no explanation
"""


# Legacy single prompt kept for backward compat
SYSTEM_PROMPT = get_system_prompt("funny")

SCRIPT_SCHEMA = """
Return ONLY this JSON structure:
{
  "title": "YouTube video title (max 60 chars, catchy, include emoji)",
  "description": "YouTube description (2-3 sentences, SEO friendly, include relevant keywords)",
  "hook": "First 5 seconds - must grab attention immediately",
  "segments": [
    {
      "text": "Narration text for this segment",
      "visual_query": "Highly specific, cinematic stock video search query for this exact moment. Think like a film director — what scene, emotion, or visual metaphor captures this line? Use vivid concrete nouns and emotions, NOT generic words. Examples: \'elderly hands holding rosary\', \'dramatic storm clouds timelapse\', \'scientist microscope closeup\', \'child laughing slow motion\', \'city lights night aerial\'. NEVER use vague queries like \'background video\' or \'nature scene\'.",
      "duration_hint": 5
    }
  ],
  "outro": "Final 3-5 second sign-off line",
  "suggested_labels": ["Comedy", "Animals"],
  "category": "Entertainment",
  "mood": "funny"
}

Categories: Entertainment, Education, Technology, Gaming, Lifestyle, Science, Food, Travel
Mood options: funny, educational, dramatic, inspirational, satirical
"""


def generate_script(prompt: str, profile: str = DEFAULT_PROFILE) -> dict:
    """
    Generate a full video script from a user prompt.

    Args:
        prompt:  The video idea, e.g. "A cat explains quantum physics"
        profile: Channel profile — "funny" | "serious" | "educational" | "inspirational"

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
            {"role": "user", "content": f"Create a funny YouTube video script about: {prompt}"},
        ],
        temperature=0.85,       # Higher = more creative
        max_tokens=2048,
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
    script_data["full_narration"] = " ".join(all_lines)

    # Estimate total duration (rough: 140 words per minute)
    word_count = len(script_data["full_narration"].split())
    script_data["estimated_duration"] = int((word_count / 140) * 60)

    print(f"✅ Script generated: '{script_data['title']}'")
    print(f"   Segments: {len(script_data['segments'])}, ~{script_data['estimated_duration']}s")

    return script_data


def generate_labels(title: str, description: str, script: str) -> dict:
    """
    Auto-generate labels and category for an existing script.
    Used in the labeling pipeline step.
    """
    client = get_groq()
    response = client.chat.completions.create(
        model=config.GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are a YouTube SEO expert. Return ONLY valid JSON. No markdown.",
            },
            {
                "role": "user",
                "content": f"""Analyze this video and return labels and category:

Title: {title}
Description: {description}
Script excerpt: {script[:300]}

Return JSON:
{{
  "labels": ["label1", "label2", "label3"],
  "category": "Entertainment",
  "youtube_tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}}

Choose 2-4 labels from: Comedy, Animals, Technology, Science, Food, Gaming, 
Education, Lifestyle, Travel, DIY, Sports, News, Music, Art, Business, Health
""",
            },
        ],
        temperature=0.3,
        max_tokens=256,
        response_format={"type": "json_object"},
    )

    return json.loads(response.choices[0].message.content)


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    result = generate_script("A penguin tries stand-up comedy at a corporate event")
    print(json.dumps(result, indent=2))

