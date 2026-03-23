"""
AutoVid — Stick Figure Compositor

FFmpeg-based pipeline that overlays animated stick-figure clips onto a base video.

Strategies (applied in priority order per clip):
  1. Alpha-channel source  → direct composite with format=auto
  2. No alpha (MP4)        → chromakey the configured colour (default: green)

Looping modes:
  none      — play the clip once; natural duration
  full      — loop the entire clip for `duration` seconds
  last_1s   — play clip once, then loop the final 1 s until `duration`
  last_2s   — same but 2 s tail
  last_3s   — same but 3 s tail

Audio: base audio is always preserved; overlay SFX is optionally mixed in.
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Optional

STICK_FIGURE_DIR = Path(__file__).parent.parent / "stickFigureAssets"


# ── Probe helpers ──────────────────────────────────────────────────────────────

def get_video_info(path: str) -> dict:
    """Return duration, resolution, alpha-channel flag, and audio presence."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_streams", "-show_format",
        str(path),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {path!r}:\n{r.stderr}")

    info = json.loads(r.stdout)
    vstm = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    astm = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)

    pix_fmt = vstm.get("pix_fmt", "") if vstm else ""
    has_alpha = pix_fmt in (
        "yuva420p", "yuva444p", "yuva420p10le", "yuva422p",
        "rgba", "argb", "abgr", "bgra",
    )
    return {
        "duration": float(info.get("format", {}).get("duration", 0)),
        "width":    int(vstm["width"])  if vstm else 1920,
        "height":   int(vstm["height"]) if vstm else 1080,
        "has_alpha": has_alpha,
        "pix_fmt":  pix_fmt,
        "has_audio": astm is not None,
    }


def list_clips(enabled_only: bool = True) -> List[Dict]:
    """
    Return clip metadata from the database.
    Falls back to a filesystem scan if the DB table is empty (first run before seeding).
    """
    try:
        import database as db
        rows = db.list_stickfigure_clips(enabled_only=enabled_only)
        if rows:
            try:
                import config as _cfg
                supabase_base = (_cfg.SUPABASE_URL or "").rstrip("/")
            except Exception:
                supabase_base = ""
            def _clip_path(r):
                return (
                    r.get("public_url")
                    or (f"{supabase_base}/storage/v1/object/public/stickfigures/{r['filename']}" if supabase_base else "")
                    or r.get("file_path")
                    or ""
                )
            return [
                {
                    "id":        r["id"],
                    "filename":  r["filename"],
                    "label":     r["label"],
                    "keywords":  r.get("keywords") or [],
                    "path":      _clip_path(r),
                    "duration":  r.get("duration") or 0,
                    "width":     r.get("width") or 0,
                    "height":    r.get("height") or 0,
                    "has_alpha": r.get("has_alpha") or False,
                    "has_audio": r.get("has_audio") or False,
                    "enabled":   r.get("enabled", True),
                }
                for r in rows
            ]
    except Exception as e:
        print(f"⚠️  DB list_clips failed, falling back to filesystem: {e}")

    # Filesystem fallback
    clips = []
    for p in sorted(STICK_FIGURE_DIR.glob("*.mp4")):
        try:
            info = get_video_info(str(p))
        except Exception:
            info = {"duration": 0, "width": 0, "height": 0, "has_alpha": False, "has_audio": False}
        clips.append({
            "id":        None,
            "filename":  p.name,
            "label":     p.stem.replace("_", " ").replace("-", " "),
            "keywords":  [],
            "path":      str(p),
            "duration":  round(info["duration"], 2),
            "width":     info["width"],
            "height":    info["height"],
            "has_alpha": info["has_alpha"],
            "has_audio": info["has_audio"],
            "enabled":   True,
        })
    return clips


# ── Looped-clip factory ────────────────────────────────────────────────────────

def _build_looped_clip(
    clip_path: str,
    target_duration: float,
    loop_mode: str,
    tmp_dir: str,
    clip_info: dict,
) -> str:
    """
    Return a path to a version of clip_path that lasts exactly target_duration
    seconds, honouring loop_mode.  May return clip_path unchanged if no looping
    is needed.
    """
    clip_dur = clip_info["duration"]

    if loop_mode == "none" or clip_dur >= target_duration:
        return clip_path

    out = os.path.join(tmp_dir, f"loop_{Path(clip_path).stem}_{loop_mode}.mp4")

    if loop_mode == "full":
        # Infinite loop of the whole clip, trimmed to target_duration
        cmd = [
            "ffmpeg", "-y",
            "-stream_loop", "-1", "-i", clip_path,
            "-t", str(target_duration),
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
            "-an",
            out,
        ]
    else:
        # last_Ns: play full clip once, then loop the tail
        loop_secs = int(loop_mode.split("_")[1].rstrip("s"))
        tail_start = max(0.0, clip_dur - loop_secs)
        tail_duration = target_duration - clip_dur
        if tail_duration <= 0:
            return clip_path

        # Step 1: extract tail segment
        tail_path = os.path.join(tmp_dir, f"tail_{Path(clip_path).stem}.mp4")
        subprocess.run([
            "ffmpeg", "-y",
            "-ss", str(tail_start), "-i", clip_path,
            "-t", str(loop_secs),
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-an",
            tail_path,
        ], capture_output=True)

        # Step 2: loop the tail to fill tail_duration
        looped_tail = os.path.join(tmp_dir, f"looped_tail_{Path(clip_path).stem}.mp4")
        subprocess.run([
            "ffmpeg", "-y",
            "-stream_loop", "-1", "-i", tail_path,
            "-t", str(tail_duration),
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-an",
            looped_tail,
        ], capture_output=True)

        # Step 3: concat full clip + looped tail
        list_txt = os.path.join(tmp_dir, f"concat_{Path(clip_path).stem}.txt")
        with open(list_txt, "w") as f:
            f.write(f"file '{clip_path}'\n")
            f.write(f"file '{looped_tail}'\n")
        cmd = [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0", "-i", list_txt,
            "-t", str(target_duration),
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-an",
            out,
        ]

    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"⚠️  Loop build failed for {clip_path}, using original: {r.stderr[-500:]}")
        return clip_path

    return out


# ── Single-overlay application ─────────────────────────────────────────────────

def _apply_overlay(
    base_path: str,
    ov: dict,
    output_path: str,
    tmp_dir: str,
    chroma_color: str = "0x00FF00",
    chroma_similarity: float = 0.35,
    chroma_blend: float = 0.05,
    mix_audio: bool = True,
) -> None:
    """Apply a single overlay dict onto base_path → output_path."""
    clip_path  = ov["clip_path"]
    start_t    = float(ov.get("start_time", 0))
    x          = int(ov.get("x", 0))
    y          = int(ov.get("y", 0))
    scale      = float(ov.get("scale", 1.0))
    loop_mode  = ov.get("loop_mode", "none")
    mix_sfx    = ov.get("has_sound", True) and mix_audio

    clip_info  = get_video_info(clip_path)
    clip_dur   = float(ov.get("duration") or clip_info["duration"])

    # Build a (possibly looped) clip of exactly clip_dur seconds
    looped = _build_looped_clip(clip_path, clip_dur, loop_mode, tmp_dir, clip_info)
    looped_info = get_video_info(looped)

    end_t       = start_t + clip_dur
    has_alpha   = clip_info["has_alpha"]
    has_sfx     = looped_info["has_audio"]

    base_info   = get_video_info(base_path)
    clip_w = max(1, int(clip_info["width"]  * scale))
    clip_h = max(1, int(clip_info["height"] * scale))

    # ── Build filter_complex ──────────────────────────────────────────────
    parts = []

    # Prepare overlay video stream
    ov_filters = []
    if not has_alpha:
        ov_filters.append(
            f"chromakey=color={chroma_color}:similarity={chroma_similarity}:blend={chroma_blend}"
        )
    if abs(scale - 1.0) > 0.005:
        ov_filters.append(f"scale={clip_w}:{clip_h}")

    if ov_filters:
        parts.append(f"[1:v]{',' .join(ov_filters)}[ovv]")
        ov_label = "[ovv]"
    else:
        ov_label = "[1:v]"

    # Overlay with time enable
    # Always use format=auto — handles both native-alpha and chromakey alpha sources.
    # Note: FFmpeg's overlay filter uses "yuv420" not "yuv420p" for its format option,
    # so we rely on auto-selection to avoid codec negotiation errors.
    parts.append(
        f"[0:v]{ov_label}overlay=x={x}:y={y}"
        f":enable='between(t,{start_t},{end_t})'"
        f":format=auto[outv]"
    )

    filter_complex = ";".join(parts)

    # ── Audio ─────────────────────────────────────────────────────────────
    if mix_sfx and has_sfx:
        # Delay SFX to match start_t; mix with base audio
        delay_ms = int(start_t * 1000)
        audio_parts = [
            f"[1:a]atrim=0:{clip_dur},asetpts=PTS-STARTPTS,"
            f"adelay={delay_ms}|{delay_ms}[dela]",
            f"[0:a][dela]amix=inputs=2:normalize=0[outa]",
        ]
        filter_complex += ";" + ";".join(audio_parts)
        audio_map = ["-map", "[outa]"]
    else:
        audio_map = ["-map", "0:a?"]

    cmd = (
        ["ffmpeg", "-y"]
        + ["-i", base_path]
        + ["-i", looped]
        + ["-filter_complex", filter_complex]
        + ["-map", "[outv]"]
        + audio_map
        + ["-c:v", "libx264", "-preset", "fast", "-crf", "18"]
        + ["-c:a", "aac", "-b:a", "192k"]
        + ["-movflags", "+faststart"]
        + [str(output_path)]
    )

    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(
            f"FFmpeg overlay failed for {clip_path!r}:\n{r.stderr[-3000:]}"
        )


# ── Public composite entry-point ───────────────────────────────────────────────

def composite_video(
    base_path: str,
    overlays: List[Dict],
    output_path: str,
    mix_overlay_audio: bool = True,
    chroma_color: str = "0x00FF00",
    chroma_similarity: float = 0.35,
    chroma_blend: float = 0.05,
) -> str:
    """
    Overlay zero or more stick-figure clips onto a base video.
    All overlays are composited in a SINGLE FFmpeg pass — O(1) regardless of
    overlay count.  Previously was O(N) passes which caused 40+ min runtimes.

    Each overlay dict accepts:
        clip_path   str    absolute path to stick-figure clip
        start_time  float  seconds from the start of the base video
        duration    float  overlay window length (None → clip's natural length)
        x           int    left edge in pixels
        y           int    top  edge in pixels
        scale       float  1.0 = original size
        loop_mode   str    "none" | "full" | "last_1s" | "last_2s" | "last_3s"
        has_sound   bool   whether to mix the clip's audio (default True)

    Returns output_path.
    """
    if not overlays:
        import shutil
        shutil.copy2(base_path, output_path)
        return output_path

    overlays = sorted(overlays, key=lambda o: float(o.get("start_time", 0)))

    with tempfile.TemporaryDirectory(prefix="sfcomp_") as tmp_dir:
        # ── Step 1: pre-build any looped clip files (fast, small temp files) ──
        base_info     = get_video_info(base_path)
        base_h        = base_info["height"]
        base_duration = float(base_info["duration"])

        # Non-overlap filter: sort by start, keep only clips that don't overlap the previous one
        # (guarantees one clip on screen at a time and avoids FFmpeg filter chain conflicts)
        overlays_sorted = sorted(overlays, key=lambda o: float(o.get("start_time", 0)))
        non_overlapping = []
        last_end = -1.0
        for ov in overlays_sorted:
            loop_mode_tmp = ov.get("loop_mode", "none")
            start_t_tmp   = float(ov.get("start_time", 0))
            clip_dur_tmp  = float(ov.get("duration") or 5)
            end_t_tmp     = base_duration if loop_mode_tmp != "none" else start_t_tmp + clip_dur_tmp
            if start_t_tmp >= last_end:
                non_overlapping.append(ov)
                last_end = end_t_tmp
        overlays = non_overlapping

        prepared = []
        for idx, ov in enumerate(overlays):
            clip_path        = ov["clip_path"]
            loop_mode        = ov.get("loop_mode", "none")
            clip_info        = get_video_info(clip_path)
            clip_natural_dur = float(ov.get("duration") or clip_info["duration"])
            start_t          = float(ov.get("start_time", 0))
            # For loop/repeat: build a clip long enough to cover the rest of the base video
            if loop_mode != "none":
                target_dur = max(clip_natural_dur, base_duration - start_t)
            else:
                target_dur = clip_natural_dur
            looped      = _build_looped_clip(clip_path, target_dur, loop_mode, tmp_dir, clip_info)
            looped_info = get_video_info(looped)
            prepared.append({
                "ov":               ov,
                "looped":           looped,
                "clip_info":        clip_info,
                "looped_info":      looped_info,
                "clip_natural_dur": clip_natural_dur,
                "loop_mode":        loop_mode,
            })
            print(f"🎬 Prepared overlay {idx+1}/{len(overlays)}: {Path(clip_path).name}")

        # ── Step 2: single FFmpeg call with all overlays in filter_complex ────
        # Inputs: [0] = base video, [1..N] = overlay clips
        inputs = ["-i", base_path]
        for p in prepared:
            inputs += ["-i", p["looped"]]

        filter_parts = []
        audio_parts  = []
        audio_labels = []

        prev_v = "[0:v]"
        for idx, p in enumerate(prepared):
            ov               = p["ov"]
            clip_info        = p["clip_info"]
            clip_natural_dur = p["clip_natural_dur"]
            loop_mode        = p["loop_mode"]
            start_t          = float(ov.get("start_time", 0))
            has_alpha        = clip_info["has_alpha"]
            mix_sfx          = ov.get("has_sound", True) and mix_overlay_audio
            has_sfx          = p["looped_info"]["has_audio"]
            is_last          = idx == len(prepared) - 1

            input_label    = f"[{idx + 1}:v]"
            filtered_label = f"[fov{idx}]"

            # trim  — bound the stream so FFmpeg never stalls waiting for more frames
            # setpts — shift PTS to start_t: clip 2's frames get PTS 30–35s (not 0–5s).
            #          FFmpeg finds each clip's first frame exactly when the base timeline
            #          reaches start_t — no early consumption, no frozen stills.
            # enable — visibility gate: hides the overlay outside the clip window.
            #          Without it, the overlay filter shows clip 2's first frame from t=0
            #          (because there's no earlier frame to replace it), producing a
            #          frozen still until start_t.  PTS shift handles consumption timing;
            #          enable handles when the composite is actually visible.
            # NO shortest=1 — that terminates the entire output stream when overlay ends.
            looped_dur = float(p["looped_info"]["duration"])
            end_t = base_duration if loop_mode != "none" else start_t + clip_natural_dur
            fade_out_dur = float(ov.get("fade_out", 0))

            ov_filters = [
                f"trim=start=0:end={looped_dur:.3f}",
                f"setpts=PTS-STARTPTS+{start_t}/TB",
                "fps=30",
            ]
            if not has_alpha:
                ov_filters.append(
                    f"chromakey=color={chroma_color}"
                    f":similarity={chroma_similarity}:blend={chroma_blend}"
                )
            ov_filters.append(f"scale=-1:{base_h}")
            ov_filters.append("format=yuva420p")

            # Fade-out: alpha fades to 0 (transparent) over the last fade_out_dur seconds
            if fade_out_dur > 0 and looped_dur > fade_out_dur:
                fade_start = looped_dur - fade_out_dur
                ov_filters.append(
                    f"fade=t=out:st={fade_start:.3f}:d={fade_out_dur:.3f}:alpha=1"
                )

            filter_parts.append(f"{input_label}{','.join(ov_filters)}{filtered_label}")
            ov_label = filtered_label

            out_v = "[outv]" if is_last else f"[v{idx}]"
            filter_parts.append(
                f"{prev_v}{ov_label}overlay="
                f"x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2"
                f":enable='between(t,{start_t:.3f},{end_t:.3f})'"
                f"{out_v}"
            )
            prev_v = out_v

            # Per-clip audio — trim to natural clip duration only
            if mix_sfx and has_sfx:
                delay_ms = int(start_t * 1000)
                a_label  = f"[a{idx}]"
                audio_parts.append(
                    f"[{idx + 1}:a]atrim=0:{clip_natural_dur},asetpts=PTS-STARTPTS,"
                    f"adelay={delay_ms}|{delay_ms}{a_label}"
                )
                audio_labels.append(a_label)

        # Mix all audio streams in one amix
        base_has_audio = base_info.get("has_audio", False)
        if audio_labels and base_has_audio:
            # Base has audio — mix it with all overlay SFX
            all_audio = "[0:a]" + "".join(audio_labels)
            audio_parts.append(
                f"{all_audio}amix=inputs={1 + len(audio_labels)}:normalize=0[outa]"
            )
            audio_map = ["-map", "[outa]"]
        elif audio_labels:
            # Base has no audio (e.g. procedural visual) — mix overlay SFX only
            if len(audio_labels) == 1:
                audio_parts.append(f"{audio_labels[0]}acopy[outa]")
            else:
                all_audio = "".join(audio_labels)
                audio_parts.append(
                    f"{all_audio}amix=inputs={len(audio_labels)}:normalize=0[outa]"
                )
            audio_map = ["-map", "[outa]"]
        else:
            audio_map = ["-map", "0:a?"]

        filter_complex = ";".join(filter_parts + audio_parts)

        cmd = (
            ["ffmpeg", "-y"]
            + inputs
            + ["-filter_complex", filter_complex]
            + ["-map", "[outv]"]
            + audio_map
            + ["-c:v", "libx264", "-preset", "fast", "-crf", "18"]
            + ["-c:a", "aac", "-b:a", "192k"]
            + ["-movflags", "+faststart"]
            + [str(output_path)]
        )

        print(f"🚀 Running single-pass FFmpeg composite ({len(prepared)} overlays)…")
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError(
                f"FFmpeg composite failed:\n{r.stderr[-4000:]}"
            )

    print(f"✅ Composite complete → {output_path}")
    return output_path
