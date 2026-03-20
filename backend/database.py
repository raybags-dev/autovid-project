"""
AutoVid — Database Layer (Supabase/PostgreSQL)
All video CRUD operations live here.

Supabase SQL to run in your project's SQL Editor:
─────────────────────────────────────────────────
CREATE TYPE video_status AS ENUM (
    'generating', 'scripted', 'voiced', 'assembled',
    'captioned', 'labeled', 'ready', 'uploading', 'posted', 'failed'
);

CREATE TABLE videos (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt            TEXT NOT NULL,
    title             TEXT,
    description       TEXT,
    script            TEXT,
    status            video_status NOT NULL DEFAULT 'generating',
    labels            TEXT[] DEFAULT '{}',
    category          TEXT,
    duration_seconds  INTEGER,
    resolution        TEXT,
    file_path         TEXT,
    thumbnail_url     TEXT,
    youtube_id        TEXT,
    youtube_url       TEXT,
    views_count       INTEGER DEFAULT 0,
    likes_count       INTEGER DEFAULT 0,
    error_message     TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    posted_at         TIMESTAMPTZ
);

-- Subscriber list (run once in Supabase SQL Editor)
─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscribers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
─────────────────────────────────────────────────

-- Stick-Figure Clip Catalogue (run once in Supabase SQL Editor)
─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stickfigure_clips (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename    TEXT NOT NULL UNIQUE,          -- e.g. "climbing.mp4"
    label       TEXT NOT NULL,                 -- human display name
    keywords    TEXT[] DEFAULT '{}',           -- trigger words for auto-match
    file_path   TEXT NOT NULL,                 -- absolute server-side path
    public_url  TEXT DEFAULT '',               -- Supabase Storage public URL
    duration    FLOAT DEFAULT 0,
    width       INTEGER DEFAULT 0,
    height      INTEGER DEFAULT 0,
    has_alpha   BOOLEAN DEFAULT FALSE,
    has_audio   BOOLEAN DEFAULT FALSE,
    enabled     BOOLEAN DEFAULT TRUE,          -- can be toggled off without deleting
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sfclips_enabled ON stickfigure_clips(enabled);
ALTER TABLE stickfigure_clips ADD COLUMN IF NOT EXISTS public_url TEXT DEFAULT '';
─────────────────────────────────────────────────
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from supabase import create_client, Client
import config

def get_client() -> Client:
    """Always return a fresh client — avoids HTTP/2 'Server disconnected' errors
    that happen when a cached client's connection goes idle and drops."""
    return create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)


# ── App Settings (persistent key-value store) ─────────────────────────────────

def get_setting(key: str, default=None):
    """Read a setting from the app_settings table. Returns default if not found."""
    try:
        db = get_client()
        row = db.table("app_settings").select("value").eq("key", key).execute()
        if row.data:
            return row.data[0]["value"]
    except Exception as e:
        print(f"⚠️  get_setting({key}) failed: {e}")
    return default


def set_setting(key: str, value) -> bool:
    """Upsert a setting into the app_settings table. Returns True on success."""
    try:
        db = get_client()
        db.table("app_settings").upsert(
            {"key": key, "value": value, "updated_at": datetime.now(timezone.utc).isoformat()},
            on_conflict="key"
        ).execute()
        return True
    except Exception as e:
        print(f"⚠️  set_setting({key}) failed: {e}")
        return False


# ── Create ────────────────────────────────────────────────────────────────────

def create_video(prompt: str) -> dict:
    """Insert a new video record with 'generating' status. Returns the full row."""
    db = get_client()
    data = {
        "prompt": prompt,
        "status": "generating",
        "labels": [],
        "views_count": 0,
        "likes_count": 0,
    }
    result = db.table("videos").insert(data).execute()
    row = result.data[0]
    print(f"📼 Created video record: {row['id']}")
    return row


# ── Update helpers ────────────────────────────────────────────────────────────

def update_video(video_id: str, **fields) -> dict:
    """Generic update. Pass any column=value pairs."""
    db = get_client()
    result = db.table("videos").update(fields).eq("id", video_id).execute()
    return result.data[0]


def set_status(video_id: str, status: str, error_message: str = None):
    fields = {"status": status}
    if error_message:
        fields["error_message"] = error_message
    update_video(video_id, **fields)
    print(f"🔄 Video {video_id[:8]}... → {status}")


def set_script(video_id: str, title: str, description: str, script: str):
    update_video(video_id,
        title=title,
        description=description,
        script=script,
        status="scripted",
    )


def set_audio_ready(video_id: str, duration_seconds: int):
    update_video(video_id,
        duration_seconds=duration_seconds,
        status="voiced",
    )


def set_video_assembled(video_id: str, file_path: str, resolution: str):
    update_video(video_id,
        file_path=file_path,
        resolution=resolution,
        status="assembled",
    )


def set_captioned(video_id: str):
    update_video(video_id, status="captioned")


def set_labels(video_id: str, labels: list[str], category: str):
    update_video(video_id,
        labels=labels,
        category=category,
        status="labeled",
    )


def set_ready(video_id: str):
    update_video(video_id, status="ready")


def set_posted(video_id: str, youtube_id: str, youtube_url: str):
    update_video(video_id,
        youtube_id=youtube_id,
        youtube_url=youtube_url,
        status="posted",
        posted_at=datetime.now(timezone.utc).isoformat(),
    )


def set_failed(video_id: str, error: str):
    update_video(video_id,
        status="failed",
        error_message=error[:500],
    )


# ── Read ──────────────────────────────────────────────────────────────────────

def get_video(video_id: str) -> dict:
    db = get_client()
    result = db.table("videos").select("*").eq("id", video_id).single().execute()
    return result.data


def list_videos(status: Optional[str] = None, limit: int = 50) -> list[dict]:
    db = get_client()
    try:
        query = (db.table("videos")
                    .select("*")
                    .eq("archived", False)
                    .order("created_at", desc=True)
                    .limit(limit))
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return result.data
    except Exception:
        # Graceful fallback if 'archived' column not yet added via SQL migration
        query = db.table("videos").select("*").order("created_at", desc=True).limit(limit)
        if status:
            query = query.eq("status", status)
        return query.execute().data


def get_stats() -> dict:
    # Use a separate query that includes archived videos so views/likes are never undercounted
    db = get_client()
    try:
        all_rows = db.table("videos").select("status,views_count,likes_count").limit(5000).execute().data or []
    except Exception:
        all_rows = []
    active = [v for v in all_rows if not v.get("archived")]
    posted = [v for v in all_rows if v["status"] == "posted"]
    return {
        "total": len([v for v in active if v["status"] != "archived"]),
        "posted": len([v for v in active if v["status"] == "posted"]),
        "generating": len([v for v in active if v["status"] == "generating"]),
        "failed": len([v for v in active if v["status"] == "failed"]),
        "total_views": sum(v.get("views_count") or 0 for v in posted),
        "total_likes": sum(v.get("likes_count") or 0 for v in posted),
    }


# ── Compilations ──────────────────────────────────────────────────────────────

def create_compilation(title: str, source_ids: list) -> dict:
    """Insert a compilation video record. Reuses videos table with type flag."""
    db = get_client()
    data = {
        "prompt":    title,
        "title":     title,
        "status":    "generating",
        "labels":    ["compilation"],
        "views_count": 0,
        "likes_count": 0,
        "description": f"Compilation of {len(source_ids)} videos",
        "script":    ",".join(source_ids),   # store source IDs in script field
    }
    result = db.table("videos").insert(data).execute()
    row = result.data[0]
    print(f"📼 Created compilation record: {row['id']}")
    return row


def list_compilations(limit: int = 50) -> list[dict]:
    """List all compilation videos (identified by 'compilation' label)."""
    db = get_client()
    try:
        result = (db.table("videos")
                   .select("*")
                   .contains("labels", ["compilation"])
                   .eq("archived", False)
                   .order("created_at", desc=True)
                   .limit(limit)
                   .execute())
    except Exception:
        result = (db.table("videos")
                   .select("*")
                   .contains("labels", ["compilation"])
                   .order("created_at", desc=True)
                   .limit(limit)
                   .execute())
    return result.data or []


# ── Archive ────────────────────────────────────────────────────────────────────
# SQL migration required (run once in Supabase SQL Editor):
#   ALTER TABLE videos ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
#   CREATE INDEX IF NOT EXISTS idx_videos_archived ON videos(archived);

def archive_video(video_id: str) -> dict:
    """Mark a video as archived (hidden from normal listings)."""
    db = get_client()
    result = db.table("videos").update({"archived": True}).eq("id", video_id).execute()
    return result.data[0] if result.data else {}


def unarchive_video(video_id: str) -> dict:
    """Restore an archived video to normal listings."""
    db = get_client()
    result = db.table("videos").update({"archived": False}).eq("id", video_id).execute()
    return result.data[0] if result.data else {}


def list_archived_videos(limit: int = 200) -> list[dict]:
    """List all archived videos."""
    db = get_client()
    result = (db.table("videos")
                .select("*")
                .eq("archived", True)
                .order("created_at", desc=True)
                .limit(limit)
                .execute())
    return result.data or []


# ── Danger Zone ────────────────────────────────────────────────────────────────

# ── Stick-Figure Clip Catalogue ───────────────────────────────────────────────

def list_stickfigure_clips(enabled_only: bool = True) -> list[dict]:
    db = get_client()
    q = db.table("stickfigure_clips").select("*").order("label")
    if enabled_only:
        q = q.eq("enabled", True)
    return q.execute().data or []


def get_stickfigure_clip(clip_id: str) -> dict | None:
    db = get_client()
    r = db.table("stickfigure_clips").select("*").eq("id", clip_id).execute()
    return r.data[0] if r.data else None


def upsert_stickfigure_clip(
    filename: str,
    label: str,
    keywords: list[str],
    file_path: str,
    duration: float = 0,
    width: int = 0,
    height: int = 0,
    has_alpha: bool = False,
    has_audio: bool = False,
    public_url: str = "",
) -> dict:
    """Insert or update a clip record, keyed on filename."""
    db = get_client()
    row = {
        "filename":   filename,
        "label":      label,
        "keywords":   keywords,
        "file_path":  file_path,
        "duration":   duration,
        "width":      width,
        "height":     height,
        "has_alpha":  has_alpha,
        "has_audio":  has_audio,
        "enabled":    True,
        "public_url": public_url,
    }
    r = db.table("stickfigure_clips").upsert(row, on_conflict="filename").execute()
    return r.data[0]


def update_stickfigure_clip(clip_id: str, **fields) -> dict:
    db = get_client()
    r = db.table("stickfigure_clips").update(fields).eq("id", clip_id).execute()
    return r.data[0] if r.data else {}


def delete_stickfigure_clip(clip_id: str) -> bool:
    db = get_client()
    db.table("stickfigure_clips").delete().eq("id", clip_id).execute()
    return True


# ── Danger Zone ────────────────────────────────────────────────────────────────

def danger_clear_all_videos() -> int:
    """DANGER: Permanently delete ALL video records from the database."""
    db = get_client()
    result = db.table("videos").select("id").execute()
    count = len(result.data or [])
    if count > 0:
        db.table("videos").delete().gte("created_at", "1970-01-01").execute()
    print(f"🚨 DANGER: Deleted {count} video records")
    return count


def danger_clear_storage() -> dict:
    """DANGER: Delete ALL files from Supabase Storage (videos + narrations buckets)."""
    client = get_client()
    results = {"videos": 0, "narrations": 0, "errors": []}
    for bucket_name in ["videos", "narrations"]:
        try:
            files = client.storage.from_(bucket_name).list()
            if not files:
                continue
            names = [f["name"] for f in files if f.get("name")]
            if names:
                client.storage.from_(bucket_name).remove(names)
                results[bucket_name] = len(names)
        except Exception as e:
            results["errors"].append(f"{bucket_name}: {str(e)}")
    print(f"🚨 DANGER: Cleared storage — videos: {results['videos']}, narrations: {results['narrations']}")
    return results
