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



def _make_piano(duration: float) -> np.ndarray:
    """Gentle solo piano — soft looping phrases, warm and intimate."""
    sr  = SAMPLE_RATE
    n   = int(sr * duration)
    out = np.zeros(n)

    def piano_note(freq, dur, amp=0.06):  # amp kept low — mixed on top of voice
        t   = np.linspace(0, dur, int(sr * dur))
        env = np.exp(-t * 3.5) * 0.6 + np.exp(-t * 0.4) * 0.4
        tone  = np.sin(2 * np.pi * freq * t)
        tone += np.sin(2 * np.pi * freq * 2 * t) * 0.25
        tone += np.sin(2 * np.pi * freq * 3 * t) * 0.08
        return tone * env * amp

    # One full phrase (~24s) that loops seamlessly for any video length
    phrase_melody = [
        (261.63, 1.8), (329.63, 1.4), (392.00, 2.0), (329.63, 1.2),
        (261.63, 2.4), (220.00, 1.6), (196.00, 2.8), (261.63, 1.8),
        (293.66, 1.4), (349.23, 2.0), (392.00, 1.6), (261.63, 3.0),
    ]
    phrase_bass = [
        (130.81, 3.0), (164.81, 3.0), (98.00, 4.0), (130.81, 4.0),
    ]

    # Build one phrase into a buffer then tile to fill duration
    phrase_dur = sum(d for _, d in phrase_melody) + 1.0   # +1s silence at end
    phrase_n   = int(sr * phrase_dur)
    phrase_buf = np.zeros(phrase_n)

    pos = int(sr * 0.8)
    for freq, note_dur in phrase_melody:
        note = piano_note(freq, note_dur + 0.6)
        end  = min(phrase_n, pos + len(note))
        if pos >= phrase_n:
            break
        phrase_buf[pos:end] += note[:end - pos]
        pos += int(sr * note_dur * 0.85)

    bass_pos = int(sr * 1.2)
    for freq, note_dur in phrase_bass:
        note = piano_note(freq, note_dur, amp=0.03)
        end  = min(phrase_n, bass_pos + len(note))
        if bass_pos >= phrase_n:
            break
        phrase_buf[bass_pos:end] += note[:end - bass_pos]
        bass_pos += int(sr * note_dur * 1.8)

    # Tile phrase across full duration
    reps = (n // phrase_n) + 2
    tiled = np.tile(phrase_buf, reps)[:n]
    out += tiled

    # Fade in (2s) and fade out (3s)
    fade_in  = min(int(sr * 2.0), n)
    fade_out = min(int(sr * 3.0), n)
    out[:fade_in]  *= np.linspace(0, 1, fade_in)
    out[-fade_out:] *= np.linspace(1, 0, fade_out)

    return out.astype(np.float32)


def _make_violin(duration: float) -> np.ndarray:
    """Gentle solo violin — soft looping phrases, warm and emotional."""
    sr  = SAMPLE_RATE
    n   = int(sr * duration)
    out = np.zeros(n)

    def violin_note(freq, dur, amp=0.05):  # amp kept low — sits behind voice
        nt  = np.linspace(0, dur, int(sr * dur))
        attack  = np.clip(nt / 0.15, 0, 1)
        release = np.clip((dur - nt) / 0.2, 0, 1)
        env     = attack * release
        tone  = np.sin(2 * np.pi * freq * nt)
        tone += np.sin(2 * np.pi * freq * 2 * nt) * 0.45
        tone += np.sin(2 * np.pi * freq * 3 * nt) * 0.20
        tone += np.sin(2 * np.pi * freq * 4 * nt) * 0.10
        tone += np.sin(2 * np.pi * freq * 5 * nt) * 0.05
        vibrato = 1 + 0.012 * np.sin(2 * np.pi * 5.8 * nt) * np.clip(nt / 0.4, 0, 1)
        tone *= vibrato
        return tone * env * amp

    # One full phrase (~28s) that loops for any video length
    phrase_melody = [
        (293.66, 2.2), (349.23, 1.8), (440.00, 2.8), (349.23, 1.4),
        (293.66, 3.0), (261.63, 2.0), (220.00, 3.4), (246.94, 2.0),
        (293.66, 2.4), (329.63, 1.8), (293.66, 4.0),
    ]

    phrase_dur = sum(d for _, d in phrase_melody) + 2.0   # +2s silence between loops
    phrase_n   = int(sr * phrase_dur)
    phrase_buf = np.zeros(phrase_n)

    pos = int(sr * 1.0)
    for freq, note_dur in phrase_melody:
        note = violin_note(freq, note_dur + 0.5)
        end  = min(phrase_n, pos + len(note))
        if pos >= phrase_n:
            break
        phrase_buf[pos:end] += note[:end - pos]
        pos += int(sr * note_dur * 0.88)

    # Tile phrase across full duration
    reps  = (n // phrase_n) + 2
    tiled = np.tile(phrase_buf, reps)[:n]

    # Soft warm pad underneath (very quiet)
    t   = np.linspace(0, duration, n)
    lfo = (np.sin(2 * np.pi * 0.06 * t) + 1) / 2
    pad = np.sin(2 * np.pi * 146.83 * t) * 0.015 * lfo
    pad += np.sin(2 * np.pi * 220.00 * t) * 0.008 * lfo
    out = tiled + pad

    # Fade in (2s) and fade out (3s)
    fade_in  = min(int(sr * 2.0), n)
    fade_out = min(int(sr * 3.0), n)
    out[:fade_in]  *= np.linspace(0, 1, fade_in)
    out[-fade_out:] *= np.linspace(1, 0, fade_out)

    return out.astype(np.float32)

MUSIC_GENERATORS = {
    'lofi':      _make_lofi,
    'ambient':   _make_ambient,
    'cinematic': _make_cinematic,
    'upbeat':    _make_upbeat,
    'piano':     _make_piano,
    'violin':    _make_violin,
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
              music_volume: float = 0.10) -> str:
    """
    Mix narration voice with background music.
    music_volume: 0.0–1.0 relative to voice (0.10 = music at 10% of voice level)
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

