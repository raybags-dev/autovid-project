"""
AutoVid — Background Music Mixer
Generates royalty-free background music via numpy audio synthesis
and mixes it under the narration audio.

No external APIs. Pure numpy + ffmpeg.

Music styles: lofi, cinematic, ambient, upbeat, none
"""
import sys
import subprocess
import numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
import config

SAMPLE_RATE = 44100


# ── Note/chord helpers ────────────────────────────────────────────────────────

def _note(freq: float, duration: float, sr: int = SAMPLE_RATE, amp: float = 0.3) -> np.ndarray:
    t   = np.linspace(0, duration, int(sr * duration), endpoint=False)
    env = np.exp(-t * 1.5) * 0.7 + 0.3  # slight decay
    wave = (
        np.sin(2 * np.pi * freq * t) * 0.5
        + np.sin(4 * np.pi * freq * t) * 0.25
        + np.sin(6 * np.pi * freq * t) * 0.1
    ) * env * amp
    return wave


def _chord(freqs: list, duration: float, amp: float = 0.25) -> np.ndarray:
    n = int(SAMPLE_RATE * duration)
    out = np.zeros(n)
    for f in freqs:
        out += _note(f, duration, amp=amp / len(freqs))
    return out


def _pad_to(arr: np.ndarray, length: int) -> np.ndarray:
    if len(arr) >= length:
        return arr[:length]
    repeats = (length // len(arr)) + 1
    return np.tile(arr, repeats)[:length]


# ── Music style generators ────────────────────────────────────────────────────

def _make_lofi(duration: float) -> np.ndarray:
    """Lo-fi hip hop — slow chord progressions, warm pads."""
    sr  = SAMPLE_RATE
    n   = int(sr * duration)
    out = np.zeros(n)

    # Cmaj7 → Am7 → Fmaj7 → G7 progression (2 bars each)
    chords = [
        [261.63, 329.63, 392.00, 493.88],  # Cmaj7
        [220.00, 261.63, 329.63, 415.30],  # Am7
        [174.61, 220.00, 261.63, 349.23],  # Fmaj7
        [196.00, 246.94, 293.66, 392.00],  # G7
    ]
    bar = 2.0  # seconds per chord
    progression = np.array([])
    for c in chords:
        progression = np.concatenate([progression, _chord(c, bar, amp=0.18)])

    out += _pad_to(progression, n)

    # Add gentle kick on beats (every 0.5s)
    beat_len = int(sr * 0.5)
    kick_env = np.exp(-np.linspace(0, 10, beat_len))
    kick = np.sin(2 * np.pi * np.linspace(0, 60, beat_len)) * kick_env * 0.12
    for beat_start in range(0, n, beat_len):
        end = min(n, beat_start + len(kick))
        out[beat_start:end] += kick[:end - beat_start]

    return out


def _make_ambient(duration: float) -> np.ndarray:
    """Ambient — slow evolving drones, peaceful."""
    sr  = SAMPLE_RATE
    n   = int(sr * duration)
    t   = np.linspace(0, duration, n)

    # Root drone
    drone  = np.sin(2 * np.pi * 110 * t) * 0.12
    drone += np.sin(2 * np.pi * 165 * t) * 0.08
    drone += np.sin(2 * np.pi * 220 * t) * 0.05

    # Slow LFO modulation
    lfo  = (np.sin(2 * np.pi * 0.08 * t) + 1) / 2
    lfo2 = (np.sin(2 * np.pi * 0.13 * t) + 1) / 2
    drone *= (0.6 + 0.4 * lfo)

    # Pad sweeps
    sweep_freq = 220 * (1 + 0.1 * np.sin(2 * np.pi * 0.05 * t))
    sweep = np.sin(2 * np.pi * np.cumsum(sweep_freq) / sr) * 0.07 * lfo2

    return (drone + sweep).astype(np.float32)


def _make_cinematic(duration: float) -> np.ndarray:
    """Cinematic — epic strings + brass hits."""
    sr  = SAMPLE_RATE
    n   = int(sr * duration)
    out = np.zeros(n)

    # Slow rising string pads
    strings_freqs = [130.81, 164.81, 196.00, 246.94]  # Cm chord
    pad = _chord(strings_freqs, duration, amp=0.15)
    out += _pad_to(pad, n)

    # Brass hit every 4 seconds
    hit_dur = 0.8
    hit = _chord([130.81, 196.00, 246.94], hit_dur, amp=0.25)
    env = np.exp(-np.linspace(0, 6, len(hit)))
    hit *= env
    hit_interval = int(sr * 4.0)
    for start in range(0, n, hit_interval):
        end = min(n, start + len(hit))
        out[start:end] += hit[:end - start]

    # Low pulsing bass
    t   = np.linspace(0, duration, n)
    bass = np.sin(2 * np.pi * 65.4 * t) * 0.08
    lfo  = (np.sin(2 * np.pi * 0.25 * t) + 1) / 2
    out += bass * (0.4 + 0.6 * lfo)

    return out


def _make_upbeat(duration: float) -> np.ndarray:
    """Upbeat — punchy synth melody + driving beat."""
    sr  = SAMPLE_RATE
    n   = int(sr * duration)
    out = np.zeros(n)

    # Driving four-on-the-floor kick
    beat = 0.4  # seconds per beat (150 BPM)
    beat_n = int(sr * beat)
    env = np.exp(-np.linspace(0, 12, beat_n))
    kick = np.sin(2 * np.pi * np.linspace(0, 90, beat_n)) * env * 0.25
    for start in range(0, n, beat_n):
        end = min(n, start + len(kick))
        out[start:end] += kick[:end - start]

    # Synth chord stabs every beat
    chord_stab = _chord([261.63, 329.63, 392.00], 0.15, amp=0.18)
    env_stab   = np.exp(-np.linspace(0, 15, len(chord_stab)))
    chord_stab *= env_stab
    for start in range(0, n, beat_n * 2):
        end = min(n, start + len(chord_stab))
        out[start:end] += chord_stab[:end - start]

    # Bass line
    t    = np.linspace(0, duration, n)
    bass = np.sin(2 * np.pi * 130.81 * t) * 0.12
    out += bass

    return out


MUSIC_GENERATORS = {
    'lofi':      _make_lofi,
    'ambient':   _make_ambient,
    'cinematic': _make_cinematic,
    'upbeat':    _make_upbeat,
}


# ── Public API ────────────────────────────────────────────────────────────────

def generate_music(style: str, duration: float, video_id: str) -> str | None:
    """
    Generate background music track.
    Returns path to MP3 file, or None if style is 'none'.
    """
    if style == 'none':
        return None

    gen = MUSIC_GENERATORS.get(style, _make_ambient)
    print(f"🎵 Generating {style} background music ({duration:.0f}s)...")

    audio = gen(duration)

    # Normalise and convert to 16-bit PCM
    audio = audio / (np.max(np.abs(audio)) + 1e-6) * 0.85
    pcm   = (audio * 32767).astype(np.int16)

    # Save as raw WAV then convert to MP3 via ffmpeg
    raw_path = config.AUDIO_OUTPUT_DIR / f"{video_id}_music.raw"
    mp3_path = config.AUDIO_OUTPUT_DIR / f"{video_id}_music.mp3"

    raw_path.write_bytes(pcm.tobytes())

    subprocess.run([
        "ffmpeg", "-y",
        "-f", "s16le",
        "-ar", str(SAMPLE_RATE),
        "-ac", "1",
        "-i", str(raw_path),
        "-q:a", "4",
        str(mp3_path),
    ], capture_output=True)

    raw_path.unlink(missing_ok=True)

    if mp3_path.exists() and mp3_path.stat().st_size > 0:
        print(f"✅ Music ready: {mp3_path.name}")
        return str(mp3_path)

    print("⚠️  Music generation failed — continuing without background music")
    return None


def mix_audio(voice_path: str, music_path: str | None, output_path: str,
              music_volume: float = 0.18) -> str:
    """
    Mix narration voice with background music.
    music_volume: 0.0–1.0 relative to voice (0.18 = music at 18% of voice level)
    Returns output_path.
    """
    if not music_path:
        # No music — just copy voice
        import shutil
        shutil.copy2(voice_path, output_path)
        return output_path

    print(f"🎚  Mixing voice + music (music @ {int(music_volume*100)}% volume)...")

    subprocess.run([
        "ffmpeg", "-y",
        "-i", voice_path,
        "-i", music_path,
        "-filter_complex",
        f"[1:a]volume={music_volume}[music];[0:a][music]amix=inputs=2:duration=first:normalize=0[out]",
        "-map", "[out]",
        "-q:a", "3",
        output_path,
    ], capture_output=True, check=True)

    print(f"✅ Mixed audio: {Path(output_path).name}")
    return output_path