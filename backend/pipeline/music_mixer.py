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



def _make_jazz(duration: float) -> np.ndarray:
    """Warm jazz comping — lazy swing chords with walking bass."""
    sr  = SAMPLE_RATE
    n   = int(sr * duration)
    out = np.zeros(n)

    # Jazz chord voicings (7th chords)
    chords = [
        [220.00, 261.63, 329.63, 415.30],  # Am7
        [196.00, 246.94, 329.63, 392.00],  # G7
        [174.61, 220.00, 277.18, 349.23],  # Fmaj7
        [130.81, 164.81, 220.00, 293.66],  # Cmaj7
    ]
    bar = 2.5
    progression = np.array([])
    for c in chords:
        progression = np.concatenate([progression, _chord(c, bar, amp=0.14)])
    out += _pad_to(progression, n)

    # Walking bass line
    bass_notes = [110.00, 123.47, 130.81, 146.83, 164.81, 146.83, 130.81, 123.47]
    step_len   = int(sr * 0.5)
    for idx, freq in enumerate(bass_notes * (n // (step_len * len(bass_notes)) + 1)):
        start = idx * step_len
        if start >= n: break
        tone  = _note(freq, min(0.48, (n - start) / sr), amp=0.11)
        end   = min(n, start + len(tone))
        out[start:end] += tone[:end - start]

    # Subtle hi-hat shuffle every 0.25s
    hh_len = int(sr * 0.05)
    t_hh   = np.linspace(0, 1, hh_len)
    hh     = (np.random.default_rng(11).uniform(-1, 1, hh_len)).astype(np.float32)
    hh    *= np.exp(-t_hh * 30) * 0.04
    for start in range(0, n, int(sr * 0.25)):
        end = min(n, start + hh_len)
        out[start:end] += hh[:end - start]

    t = np.linspace(0, duration, n)
    out *= (0.7 + 0.3 * (np.sin(2 * np.pi * 0.04 * t) + 1) / 2)
    return out.astype(np.float32)


def _make_meditation(duration: float) -> np.ndarray:
    """Deep meditation — resonant bowl drones and slow harmonic sweeps."""
    sr  = SAMPLE_RATE
    n   = int(sr * duration)
    t   = np.linspace(0, duration, n)

    # Tibetan bowl fundamentals (A = 220Hz, D = 146.83, G = 196)
    bowl1 = np.sin(2 * np.pi * 220.00 * t) * 0.10
    bowl2 = np.sin(2 * np.pi * 293.66 * t) * 0.07
    bowl3 = np.sin(2 * np.pi * 146.83 * t) * 0.05

    # Slow LFO for breath-like swell
    breath = (np.sin(2 * np.pi * 0.04 * t) + 1) / 2
    drone  = (bowl1 + bowl2 + bowl3) * (0.5 + 0.5 * breath)

    # Ultra-slow harmonic sweep
    sweep_f = 110.0 * (1 + 0.03 * np.sin(2 * np.pi * 0.02 * t))
    sweep   = np.sin(2 * np.pi * np.cumsum(sweep_f) / sr) * 0.04

    # Sub-bass rumble
    sub = np.sin(2 * np.pi * 55 * t) * 0.06 * ((np.sin(2 * np.pi * 0.07 * t) + 1) / 2)

    # Sparse bell strikes every ~12s
    bell_dur  = int(sr * 3.0)
    bell_freq = 528.0
    bell_t    = np.linspace(0, 3.0, bell_dur)
    bell_env  = np.exp(-bell_t * 0.8)
    bell      = np.sin(2 * np.pi * bell_freq * bell_t) * bell_env * 0.08
    for start in range(0, n, int(sr * 14)):
        end = min(n, start + bell_dur)
        drone[start:end] += bell[:end - start]

    out = (drone + sweep + sub).astype(np.float32)
    fade_in = min(int(sr * 3.0), n)
    out[:fade_in] *= np.linspace(0, 1, fade_in)
    return out


def _make_epic_trailer(duration: float) -> np.ndarray:
    """Epic trailer music — hybrid orchestral, dramatic builds."""
    sr  = SAMPLE_RATE
    n   = int(sr * duration)
    out = np.zeros(n)
    t   = np.linspace(0, duration, n)

    # Driving ostinato (repeating 8th-note pattern)
    ostinato_notes = [130.81, 164.81, 130.81, 196.00, 130.81, 164.81, 130.81, 174.61]
    step = int(sr * 0.25)
    for idx in range(n // step):
        freq  = ostinato_notes[idx % len(ostinato_notes)]
        start = idx * step
        tone  = _note(freq, 0.22, amp=0.12)
        env   = np.exp(-np.linspace(0, 8, len(tone)))
        tone *= env
        end   = min(n, start + len(tone))
        out[start:end] += tone[:end - start]

    # Massive string pad
    strings = _chord([130.81, 164.81, 196.00, 246.94], duration, amp=0.12)
    out += _pad_to(strings, n)

    # Cinematic brass hits every 4s with increasing intensity
    for hit_n, start in enumerate(range(0, n, int(sr * 4.0))):
        intensity = min(1.0, 0.3 + hit_n * 0.12)
        hit_dur   = 1.2
        hit       = _chord([130.81, 196.00, 246.94], hit_dur, amp=0.28 * intensity)
        env       = np.exp(-np.linspace(0, 5, len(hit)))
        hit      *= env
        end       = min(n, start + len(hit))
        out[start:end] += hit[:end - start]

    # Sub bass pulse on every beat
    beat_n = int(sr * 0.5)
    sub_env = np.exp(-np.linspace(0, 10, beat_n))
    sub_kick = np.sin(2 * np.pi * np.linspace(0, 80, beat_n)) * sub_env * 0.22
    for start in range(0, n, beat_n):
        end = min(n, start + len(sub_kick))
        out[start:end] += sub_kick[:end - start]

    # Dramatic build via slow crescendo envelope
    build = np.linspace(0.4, 1.0, n) ** 1.5
    out  *= build

    return out.astype(np.float32)


def _make_chill_electronic(duration: float) -> np.ndarray:
    """Chill electronic — warm synthesiser pads, gentle pulse, modern feel."""
    sr  = SAMPLE_RATE
    n   = int(sr * duration)
    t   = np.linspace(0, duration, n)
    out = np.zeros(n)

    # Warm synth pad (detuned oscillators for width)
    base  = 130.81
    pad   = np.zeros(n)
    for detune in [-0.5, 0, 0.5, 1.0]:
        f = base * (2 ** (detune / 1200))
        pad += np.sin(2 * np.pi * f * t) * 0.06
    for detune in [-0.3, 0.3]:
        f = base * 2 * (2 ** (detune / 1200))
        pad += np.sin(2 * np.pi * f * t) * 0.04

    lfo1  = (np.sin(2 * np.pi * 0.10 * t) + 1) / 2
    lfo2  = (np.sin(2 * np.pi * 0.07 * t) + 1) / 2
    pad  *= 0.5 + 0.5 * lfo1
    out  += pad

    # Four-on-the-floor electronic kick (very soft)
    beat  = int(sr * 0.5)
    k_env = np.exp(-np.linspace(0, 14, beat))
    kick  = np.sin(2 * np.pi * np.linspace(0, 70, beat)) * k_env * 0.10
    for start in range(0, n, beat):
        end = min(n, start + len(kick))
        out[start:end] += kick[:end - start]

    # Arpeggiated synth melody (very light)
    arp   = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63]
    arp_s = int(sr * 0.375)
    for idx in range(n // arp_s):
        freq  = arp[idx % len(arp)]
        start = idx * arp_s
        tone  = np.sin(2 * np.pi * freq * np.linspace(0, 0.35, int(sr * 0.35)))
        env   = np.exp(-np.linspace(0, 12, len(tone)))
        tone *= env * 0.05
        end   = min(n, start + len(tone))
        out[start:end] += tone[:end - start]

    # Subtle sub bass
    sub  = np.sin(2 * np.pi * 65.4 * t) * 0.07 * (0.5 + 0.5 * lfo2)
    out += sub

    fade_in = min(int(sr * 2.5), n)
    out[:fade_in] *= np.linspace(0, 1, fade_in)
    return out.astype(np.float32)


MUSIC_GENERATORS = {
    'lofi':             _make_lofi,
    'ambient':          _make_ambient,
    'cinematic':        _make_cinematic,
    'upbeat':           _make_upbeat,
    'jazz':             _make_jazz,
    'meditation':       _make_meditation,
    'epic_trailer':     _make_epic_trailer,
    'chill_electronic': _make_chill_electronic,
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

    print(f"   Writing {len(pcm.tobytes()) // 1024}KB raw PCM...")
    raw_path.write_bytes(pcm.tobytes())
    print(f"   Converting to MP3 via FFmpeg...")

    try:
        result = subprocess.run([
            "ffmpeg", "-y",
            "-f", "s16le",
            "-ar", str(SAMPLE_RATE),
            "-ac", "1",
            "-i", str(raw_path),
            "-q:a", "4",
            str(mp3_path),
        ], capture_output=True, timeout=60)  # 60s max — never hang forever
        if result.returncode != 0:
            print(f"⚠️  FFmpeg music error: {result.stderr.decode()[-200:]}")
    except subprocess.TimeoutExpired:
        print("⚠️  Music FFmpeg timed out after 60s — skipping music")
    except Exception as e:
        print(f"⚠️  Music FFmpeg exception: {e}")

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


def mix_background_music(video_path: str, style: str, video_id: str,
                          music_volume: float = 0.08) -> str:
    """
    High-level helper: generate background music and mix it into a video file.
    Returns path to the output video (same location, overwrites if successful).
    Falls back to original video on any error.
    """
    import subprocess, shutil
    from pathlib import Path

    out_path = Path(video_path)
    if not out_path.exists():
        return video_path

    # Get video duration
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", video_path],
            capture_output=True, text=True, check=True
        )
        duration = float(result.stdout.strip()) + 2.0
    except Exception as e:
        print(f"⚠️  Could not get video duration: {e}")
        return video_path

    # Generate music track
    music_path = generate_music(style, duration, f"{video_id}_bg")
    if not music_path:
        return video_path

    # Mix into video — replace audio stream
    tmp = str(out_path).replace(".mp4", "_musixed.mp4")
    try:
        subprocess.run([
            "ffmpeg", "-y",
            "-i", video_path,
            "-i", music_path,
            "-filter_complex",
            f"[1:a]volume={music_volume}[bg];[0:a][bg]amix=inputs=2:duration=first:normalize=0[aout]",
            "-map", "0:v",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            tmp,
        ], capture_output=True, check=True)

        # Replace original
        shutil.move(tmp, video_path)
        print(f"✅ Background music ({style}) mixed into video")
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Music mix FFmpeg error: {e.stderr.decode()[:200]}")
        Path(tmp).unlink(missing_ok=True)
    finally:
        Path(music_path).unlink(missing_ok=True)

    return video_path