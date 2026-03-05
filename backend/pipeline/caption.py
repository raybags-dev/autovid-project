import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import os
import re
import json
import textwrap
import subprocess
from pathlib import Path
import config


# ── Whisper Transcription ─────────────────────────────────────────────────────

def transcribe_audio(audio_path: str, model_size: str = "base") -> dict:
    """
    Transcribe audio using local Whisper model.
    Returns dict with full transcript + word-level segments.

    Model sizes (tradeoff: speed vs accuracy):
      tiny   → very fast, lower accuracy
      base   → fast, decent accuracy (recommended for dev)
      small  → good balance
      medium → high accuracy (recommended for production)
    """
    try:
        import whisper
    except ImportError:
        raise ImportError("Install Whisper: pip install openai-whisper")

    print(f"🎤 Transcribing audio with Whisper ({model_size})...")

    model = whisper.load_model(model_size)
    result = model.transcribe(
        audio_path,
        word_timestamps=True,
        language="en",
        fp16=False,          # Set True if you have a GPU (much faster)
        verbose=False,
    )

    # Flatten to word-level timestamps
    words = []
    for segment in result.get("segments", []):
        for word_data in segment.get("words", []):
            words.append({
                "word": word_data["word"].strip(),
                "start": round(word_data["start"], 3),
                "end": round(word_data["end"], 3),
            })

    print(f"✅ Transcribed: {len(words)} words, {len(result['segments'])} segments")
    return {
        "text": result["text"],
        "segments": result["segments"],
        "words": words,
    }


# ── SRT Generator ─────────────────────────────────────────────────────────────

def _seconds_to_srt_time(seconds: float) -> str:
    """Convert seconds to SRT timestamp format: HH:MM:SS,mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def generate_srt(whisper_result: dict, output_path: Path, max_chars_per_line: int = 40) -> str:
    """
    Generate an SRT caption file from Whisper transcription.
    Groups words into ~5-word chunks for readability.

    Returns: path to the .srt file
    """
    words = whisper_result.get("words", [])
    if not words:
        # Fallback: use segments directly
        words = []
        for seg in whisper_result.get("segments", []):
            words.append({"word": seg["text"].strip(), "start": seg["start"], "end": seg["end"]})

    srt_path = Path(output_path)
    chunks = []
    current_chunk = []
    current_chars = 0
    WORDS_PER_CHUNK = 6

    for i, word in enumerate(words):
        current_chunk.append(word)
        current_chars += len(word["word"]) + 1

        is_last = i == len(words) - 1
        chunk_full = len(current_chunk) >= WORDS_PER_CHUNK
        natural_break = word["word"].endswith((".", "!", "?", ",")) and len(current_chunk) >= 3

        if chunk_full or is_last or natural_break:
            if current_chunk:
                chunks.append(current_chunk)
                current_chunk = []
                current_chars = 0

    srt_content = []
    for idx, chunk in enumerate(chunks, 1):
        start = chunk[0]["start"]
        end   = chunk[-1]["end"]
        # idx is 1-based, chunks is 0-based — next chunk is chunks[idx]
        if idx < len(chunks):
            next_start = chunks[idx][0]["start"]
            end = min(end, next_start - 0.05)

        text = " ".join(w["word"] for w in chunk).strip()
        srt_content.append(
            f"{idx}\n{_seconds_to_srt_time(start)} --> {_seconds_to_srt_time(end)}\n{text}\n"
        )

    with open(srt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(srt_content))

    print(f"📄 SRT generated: {srt_path.name} ({len(chunks)} caption blocks)")
    return str(srt_path)


# ── Caption Burning ───────────────────────────────────────────────────────────

CAPTION_STYLE = {
    "FontName": "Arial",
    "FontSize": 26,                  # Bigger = easier to read
    "PrimaryColour": "&H00FFFFFF",   # Bright white text
    "OutlineColour": "&H00000000",   # Black outline for contrast
    "BackColour": "&H00000000",      # No background box — outline only (cleaner)
    "BorderStyle": 1,                # Outline + shadow only (not box)
    "Outline": 3,                    # Thicker outline = text pops on any background
    "Shadow": 1,
    "Alignment": 2,                  # Bottom center
    "MarginV": 80,                   # Slightly higher from bottom
    "Bold": 1,
}


def burn_captions(video_path: str, srt_path: str, video_id: str) -> str:
    """
    Burn SRT captions directly into the video using FFmpeg.
    This creates a new MP4 with captions permanently embedded.

    Returns: path to the captioned video file
    """
    output_path = config.VIDEOS_OUTPUT_DIR / f"{video_id}_captioned.mp4"

    # Build style string for FFmpeg subtitles filter
    style_parts = ",".join(f"{k}={v}" for k, v in CAPTION_STYLE.items())

    # Escape path for ffmpeg filter (Windows compatibility)
    srt_escaped = str(srt_path).replace("\\", "/").replace(":", "\\:")

    # FFmpeg command to burn subtitles
    # -map 0:v and -map 0:a explicitly include both video AND audio streams
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"subtitles='{srt_escaped}':force_style='{style_parts}'",
        "-map", "0:v",             # Explicitly include video stream
        "-map", "0:a",             # Explicitly include audio stream
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-c:a", "aac",             # Re-encode audio as AAC (more compatible than copy)
        "-b:a", config.AUDIO_BITRATE,
        "-b:v", config.VIDEO_BITRATE,
        str(output_path),
    ]

    print(f"💬 Burning captions into video...")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg caption burn failed:\n{result.stderr[-500:]}")

    file_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"✅ Captions burned: {output_path.name} ({file_size:.1f} MB)")

    # Clean up the raw (no-caption) video to save disk space
    if os.path.exists(video_path) and "_raw.mp4" in video_path:
        os.remove(video_path)
        print(f"🗑️  Cleaned up raw video")

    return str(output_path)


# ── Public Entry Point ────────────────────────────────────────────────────────

def add_captions(video_path: str, audio_path: str, video_id: str,
                 whisper_model: str = "base") -> str:
    """
    Full captioning pipeline:
    1. Transcribe audio with Whisper
    2. Generate SRT file
    3. Burn captions into video

    Returns: path to final captioned video
    """
    srt_dir = config.TEMP_DIR / video_id
    srt_dir.mkdir(parents=True, exist_ok=True)
    srt_path = srt_dir / f"{video_id}.srt"

    # Transcribe
    whisper_result = transcribe_audio(audio_path, model_size=whisper_model)

    # Save full transcript for DB
    transcript_path = srt_dir / f"{video_id}_transcript.json"
    with open(transcript_path, "w") as f:
        json.dump({"text": whisper_result["text"], "words": whisper_result["words"]}, f)

    # Generate SRT
    generate_srt(whisper_result, srt_path)

    # Burn into video
    final_path = burn_captions(video_path, str(srt_path), video_id)

    return final_path


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Captioner loaded. Run via orchestrator.py")

