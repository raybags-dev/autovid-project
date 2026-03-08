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
    query = db.table("videos").select("*").order("created_at", desc=True).limit(limit)
    if status:
        query = query.eq("status", status)
    result = query.execute()
    return result.data


def get_stats() -> dict:
    videos = list_videos(limit=1000)
    posted = [v for v in videos if v["status"] == "posted"]
    return {
        "total": len(videos),
        "posted": len(posted),
        "generating": len([v for v in videos if v["status"] == "generating"]),
        "failed": len([v for v in videos if v["status"] == "failed"]),
        "total_views": sum(v.get("views_count", 0) for v in posted),
        "total_likes": sum(v.get("likes_count", 0) for v in posted),
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
    result = (db.table("videos")
               .select("*")
               .contains("labels", ["compilation"])
               .order("created_at", desc=True)
               .limit(limit)
               .execute())
    return result.data or []
