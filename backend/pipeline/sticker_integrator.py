"""pipeline/sticker_integrator.py

Assembles a paragraph's visual by layering stick-figure stickers over a
procedurally-generated background using MoviePy.

Public API
----------
assemble_paragraph_visuals(paragraph_text, duration, background_style, ...)
    → path to rendered MP4
"""

from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Optional

import numpy as np

import config
from pipeline.stickfigure_matcher import _score_clip, load_keyword_map_from_db
from pipeline.video_fetcher import CONCEPT_EXPANSIONS
from pipeline.visual_generator import generate_visual

# ── Stop-word filter for keyword extraction ───────────────────────────────────
_STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "to", "of", "in", "on", "at", "for", "with",
    "and", "or", "but", "not", "this", "that", "it", "its", "we", "you",
    "they", "he", "she", "i", "my", "our", "your", "their", "so", "if",
    "as", "by", "from", "about", "into", "through", "than", "more", "just",
}


def _extract_keywords(text: str) -> list[str]:
    """Return meaningful lowercase words from text, excluding stop-words."""
    words = re.findall(r"[a-zA-Z]+", text.lower())
    kws = [w for w in words if w not in _STOP_WORDS and len(w) > 2]
    # Also inject concept-expansion synonyms so abstract paragraphs match better
    joined = text.lower()
    for concept, expansions in CONCEPT_EXPANSIONS.items():
        if concept in joined:
            for exp in expansions:
                kws.extend(re.findall(r"[a-zA-Z]+", exp.lower()))
    return kws


def _find_top_stickers(paragraph_text: str, top_n: int = 2) -> list[dict]:
    """Query local DB / seed map for the top-N best-matching clips."""
    keyword_map = load_keyword_map_from_db()
    sentence_lower = paragraph_text.lower()
    scored: list[tuple[int, str, dict]] = []
    for filename, info in keyword_map.items():
        clip_kws = info.get("keywords", [])
        score = _score_clip(clip_kws, sentence_lower)
        if score > 0:
            scored.append((score, filename, info))
    scored.sort(key=lambda x: -x[0])
    return [{"filename": fn, **info, "score": s} for s, fn, info in scored[:top_n]]


# ── Chroma-key helper ─────────────────────────────────────────────────────────

def _chroma_mask_frame(
    frame: np.ndarray,
    color: tuple[int, int, int] = (0, 255, 0),
    tolerance: int = 80,
) -> np.ndarray:
    """
    Return a float32 H×W grayscale mask where 1.0 = keep, 0.0 = transparent.
    frame is H×W×3 uint8 RGB.
    """
    dist = np.sqrt(
        (frame[:, :, 0].astype(np.int32) - color[0]) ** 2
        + (frame[:, :, 1].astype(np.int32) - color[1]) ** 2
        + (frame[:, :, 2].astype(np.int32) - color[2]) ** 2
    )
    return (dist > tolerance).astype(np.float32)


# ── Main public function ──────────────────────────────────────────────────────

def assemble_paragraph_visuals(
    paragraph_text: str,
    duration: float,
    background_style: str = "rain",
    video_id: Optional[str] = None,
    scale: float = 0.5,
    chroma_color: tuple[int, int, int] = (0, 255, 0),
    chroma_tolerance: int = 80,
) -> str:
    """
    Build a composite video for one paragraph: procedural background + sticker
    overlays applied sequentially.

    Args:
        paragraph_text:   Narration text for this paragraph (used for matching).
        duration:         Total output clip length in seconds.
        background_style: Key from visual_generator.FRAME_FUNCS (default "rain").
        video_id:         Used for output file naming; auto-generated if None.
        scale:            Sticker width as a fraction of background width (0.5 = 50 %).
        chroma_color:     RGB tuple for green-screen removal (default pure green).
        chroma_tolerance: Euclidean distance threshold for chroma-key.

    Returns:
        Absolute path string of the rendered MP4.

    Notes:
        * If no stickers match the paragraph, the plain background is returned.
        * Each matching sticker fills an equal slice of the total duration,
          looping if shorter than its time slot.
        * Clips that declare has_alpha=True are loaded with native transparency;
          all others are processed through the chroma-key helper.
    """
    # Late import so the module loads quickly even without moviepy installed
    from moviepy.editor import CompositeVideoClip, VideoFileClip
    from moviepy.video.VideoClip import VideoClip

    if video_id is None:
        video_id = uuid.uuid4().hex[:8]

    # ── 1. Generate background ───────────────────────────────────────────────
    bg_path = generate_visual(background_style, duration, f"{video_id}_bg")
    bg_clip = VideoFileClip(bg_path)
    bg_w, bg_h = bg_clip.size

    # ── 2. Find matching stickers ────────────────────────────────────────────
    stickers = _find_top_stickers(paragraph_text, top_n=2)
    if not stickers:
        print("[sticker_integrator] No matching stickers — returning background only.")
        bg_clip.close()
        return bg_path

    # ── 3. Build overlay layers ──────────────────────────────────────────────
    n = len(stickers)
    slot = duration / n          # equal time per sticker
    layers: list = [bg_clip]

    for idx, sticker in enumerate(stickers):
        path = sticker.get("file_path", "")
        if not Path(path).exists():
            print(f"[sticker_integrator] Skipping missing file: {path}")
            continue

        has_alpha: bool = bool(sticker.get("has_alpha", False))

        raw = VideoFileClip(path, has_mask=has_alpha)

        # Scale proportionally so sticker width = scale * bg_width
        target_w = int(bg_w * scale)
        ratio = target_w / max(raw.w, 1)
        scaled = raw.resize(ratio)

        # Loop to fill the time slot
        looped = scaled.loop(duration=slot)

        if not has_alpha:
            # Build a per-frame mask from chroma-key
            cc, ct = chroma_color, chroma_tolerance

            # Capture loop vars in default args to avoid closure over mutable vars
            def _make_mask_frame(t, _looped=looped, _cc=cc, _ct=ct):
                frame = _looped.get_frame(t)
                return _chroma_mask_frame(frame, color=_cc, tolerance=_ct)

            mask_clip = VideoClip(
                _make_mask_frame,
                ismask=True,
                duration=slot,
            ).set_fps(raw.fps or 24)

            looped = looped.set_mask(mask_clip)

        # Center on background
        x = (bg_w - looped.w) // 2
        y = (bg_h - looped.h) // 2

        # Place in the correct time slot
        overlay = looped.set_start(idx * slot).set_position((x, y))
        layers.append(overlay)

    # ── 4. Composite and render ──────────────────────────────────────────────
    out_dir = Path(config.VIDEOS_OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = str(out_dir / f"{video_id}_sticker_overlay.mp4")

    composite = CompositeVideoClip(layers, size=(bg_w, bg_h))
    composite.write_videofile(
        out_path,
        fps=24,
        codec="libx264",
        audio=False,
        preset="ultrafast",
        logger=None,
    )

    # Cleanup
    for c in layers:
        try:
            c.close()
        except Exception:
            pass
    try:
        composite.close()
    except Exception:
        pass

    return out_path
