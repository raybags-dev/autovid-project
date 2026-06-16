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
    source      TEXT DEFAULT 'library',        -- 'library' | 'generated'
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sfclips_enabled ON stickfigure_clips(enabled);
CREATE INDEX IF NOT EXISTS idx_sfclips_source  ON stickfigure_clips(source);
ALTER TABLE stickfigure_clips ADD COLUMN IF NOT EXISTS public_url TEXT DEFAULT '';
ALTER TABLE stickfigure_clips ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'library';
─────────────────────────────────────────────────
-- Subscription users (exclusive content access) — run once in Supabase SQL Editor:
─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',  -- pending/approved/rejected/expired
    access_token  TEXT,
    plan          TEXT NOT NULL DEFAULT 'trial',
    trial_expires_at TIMESTAMPTZ,
    videos_created INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subu_status ON subscription_users(status);

-- Subscriber-created videos (run once in Supabase SQL Editor):
ALTER TABLE subscription_users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'trial';
ALTER TABLE subscription_users ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
ALTER TABLE subscription_users ADD COLUMN IF NOT EXISTS videos_created INT DEFAULT 0;

-- Subscriber-owned videos — tagged on the shared videos table (run once in Supabase SQL Editor):
ALTER TABLE videos ADD COLUMN IF NOT EXISTS subscriber_user_id UUID;
CREATE INDEX IF NOT EXISTS idx_videos_subscriber ON videos(subscriber_user_id) WHERE subscriber_user_id IS NOT NULL;

-- Subscriber YouTube OAuth tokens (run once in Supabase SQL Editor):
ALTER TABLE subscription_users ADD COLUMN IF NOT EXISTS youtube_oauth_token JSONB;

-- Subscriber channel URLs — for auto-publish routing (run once in Supabase SQL Editor):
ALTER TABLE subscription_users ADD COLUMN IF NOT EXISTS youtube_channel_url TEXT DEFAULT '';
ALTER TABLE subscription_users ADD COLUMN IF NOT EXISTS tiktok_profile_url TEXT DEFAULT '';

-- Exclusive videos flag — run once in Supabase SQL Editor:
ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN DEFAULT FALSE;

-- Exclusive flag for custom content — run once in Supabase SQL Editor:
ALTER TABLE custom_content ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN DEFAULT FALSE;

-- Captions-disabled flag — run once in Supabase SQL Editor:
ALTER TABLE videos ADD COLUMN IF NOT EXISTS captions_disabled BOOLEAN DEFAULT FALSE;

-- Blog post link — run once in Supabase SQL Editor:
ALTER TABLE videos ADD COLUMN IF NOT EXISTS blog_post_id UUID;
─────────────────────────────────────────────────
-- Blog comment scoping — run once in Supabase SQL Editor:
ALTER TABLE blog_comments ADD COLUMN IF NOT EXISTS is_blog_comment BOOLEAN DEFAULT FALSE;
ALTER TABLE blog_comments ADD COLUMN IF NOT EXISTS is_site_comment BOOLEAN DEFAULT FALSE;
ALTER TABLE blog_comments ADD COLUMN IF NOT EXISTS blog_post_id UUID;
CREATE INDEX IF NOT EXISTS idx_blog_comments_blog_post ON blog_comments(blog_post_id) WHERE is_blog_comment = TRUE;
CREATE INDEX IF NOT EXISTS idx_blog_comments_site ON blog_comments(is_site_comment) WHERE is_site_comment = TRUE;
─────────────────────────────────────────────────
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from supabase import Client, create_client

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


def list_videos(status: Optional[str] = None, limit: int = 50, subscriber_user_id: Optional[str] = None) -> list[dict]:
    db = get_client()
    try:
        query = (db.table("videos")
                    .select("*")
                    .eq("archived", False)
                    .order("created_at", desc=True)
                    .limit(limit))
        if status:
            query = query.eq("status", status)
        if subscriber_user_id:
            query = query.eq("subscriber_user_id", subscriber_user_id)
        else:
            # Admin view: exclude subscriber-owned videos
            query = query.is_("subscriber_user_id", "null")
        result = query.execute()
        return result.data
    except Exception:
        query = db.table("videos").select("*").order("created_at", desc=True).limit(limit)
        if status:
            query = query.eq("status", status)
        return query.execute().data


def create_subscriber_video(prompt: str, subscriber_user_id: str) -> dict:
    """Create a video record owned by a subscriber. Not shown in admin library."""
    db = get_client()
    data = {
        "prompt": prompt,
        "status": "generating",
        "labels": ["subscriber_video"],
        "views_count": 0,
        "likes_count": 0,
        "subscriber_user_id": subscriber_user_id,
    }
    try:
        result = db.table("videos").insert(data).execute()
    except Exception as e:
        if "subscriber_user_id" in str(e) or "column" in str(e).lower():
            # Migration not yet run — insert without subscriber_user_id, add label to track
            data.pop("subscriber_user_id", None)
            data["labels"] = ["subscriber_video", f"owner:{subscriber_user_id}"]
            result = db.table("videos").insert(data).execute()
        else:
            raise
    row = result.data[0]
    print(f"📼 Created subscriber video record: {row['id']}")
    return row


def list_subscriber_videos(subscriber_user_id: str, limit: int = 50) -> list[dict]:
    """List all videos created by a specific subscriber."""
    db = get_client()
    result = (db.table("videos")
                .select("id,title,status,thumbnail_url,file_path,duration_seconds,created_at,error_message,prompt")
                .eq("subscriber_user_id", subscriber_user_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute())
    return result.data or []


def get_subscriber_video(video_id: str, subscriber_user_id: str) -> dict | None:
    """Get a video only if it belongs to the given subscriber."""
    db = get_client()
    result = (db.table("videos")
                .select("*")
                .eq("id", video_id)
                .eq("subscriber_user_id", subscriber_user_id)
                .execute())
    return result.data[0] if result.data else None


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

# Blog posts table — run once in Supabase SQL Editor:
# CREATE TABLE IF NOT EXISTS blog_posts (
#     id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
#     title         TEXT NOT NULL,
#     slug          TEXT UNIQUE NOT NULL,
#     excerpt       TEXT DEFAULT '',
#     body          TEXT DEFAULT '',
#     cover_image_url TEXT DEFAULT '',
#     tags          TEXT[] DEFAULT '{}',
#     status        TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'published'
#     video_id      UUID REFERENCES videos(id) ON DELETE SET NULL,
#     youtube_url   TEXT DEFAULT '',
#     views         INTEGER DEFAULT 0,
#     created_at    TIMESTAMPTZ DEFAULT NOW(),
#     updated_at    TIMESTAMPTZ DEFAULT NOW(),
#     published_at  TIMESTAMPTZ
# );
# CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
# CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
# CREATE INDEX IF NOT EXISTS idx_blog_posts_video_id ON blog_posts(video_id);

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
    public_url: str = "",
    duration: float = 0,
    width: int = 0,
    height: int = 0,
    has_alpha: bool = False,
    has_audio: bool = False,
    source: str = "library",
) -> dict:
    """Insert or update a clip record, keyed on filename."""
    db = get_client()
    row = {
        "filename":  filename,
        "label":     label,
        "keywords":  keywords,
        "file_path": file_path,
        "public_url": public_url,
        "duration":  duration,
        "width":     width,
        "height":    height,
        "has_alpha": has_alpha,
        "has_audio": has_audio,
        "enabled":   True,
        "source":    source,
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

def danger_clear_podcasts() -> dict:
    """DANGER: Delete all podcast records from the database and their MP3 files from storage."""
    client = get_client()
    result = client.table("videos").select("id,narration_url").eq("resolution", "podcast").execute()
    rows = result.data or []

    # Collect narration file keys (filename portion of the URL)
    narration_keys = []
    for row in rows:
        url = row.get("narration_url") or ""
        if url:
            # Strip query params and extract the filename/path segment after the bucket name
            clean = url.split("?")[0]
            # Keys under "narrations" bucket are just the filename
            key = clean.rstrip("/").split("/")[-1]
            if key:
                narration_keys.append(key)

    storage_deleted = 0
    if narration_keys:
        try:
            client.storage.from_("narrations").remove(narration_keys)
            storage_deleted = len(narration_keys)
        except Exception as e:
            print(f"⚠️ Narration storage clear warning: {e}")

    db_count = len(rows)
    if db_count > 0:
        client.table("videos").delete().eq("resolution", "podcast").execute()

    print(f"🚨 DANGER: Cleared {db_count} podcast DB records, {storage_deleted} narration MP3s")
    return {"db_records": db_count, "storage_files": storage_deleted}


def danger_clear_all_narrations() -> dict:
    """DANGER: Clear narration_url from all videos and delete all MP3 files from storage."""
    client = get_client()
    result = client.table("videos").select("id,narration_url").not_.is_("narration_url", "null").execute()
    rows = result.data or []

    narration_keys = []
    for row in rows:
        url = row.get("narration_url") or ""
        if url:
            clean = url.split("?")[0]
            key = clean.rstrip("/").split("/")[-1]
            if key:
                narration_keys.append(key)

    storage_deleted = 0
    if narration_keys:
        try:
            client.storage.from_("narrations").remove(narration_keys)
            storage_deleted = len(narration_keys)
        except Exception as e:
            print(f"⚠️ Narration storage clear warning: {e}")

    if rows:
        client.table("videos").update({"narration_url": None}).not_.is_("narration_url", "null").execute()

    print(f"🚨 DANGER: Cleared narration_url from {len(rows)} videos, deleted {storage_deleted} MP3s")
    return {"cleared_records": len(rows), "storage_files": storage_deleted}


def danger_clear_stickfigures() -> dict:
    """DANGER: Delete all stickfigure clip records from the database."""
    client = get_client()
    result = client.table("stickfigure_clips").select("id").execute()
    count = len(result.data or [])
    if count > 0:
        client.table("stickfigure_clips").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    print(f"🚨 DANGER: Deleted {count} stickfigure clip records")
    return {"deleted": count}


def delete_all_blog_posts() -> int:
    """DANGER: Delete every blog post from the database."""
    client = get_client()
    result = client.table("blog_posts").select("id").execute()
    count = len(result.data or [])
    if count > 0:
        client.table("blog_posts").delete().gte("created_at", "1970-01-01").execute()
    print(f"🚨 DANGER: Deleted {count} blog posts")
    return count


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


# ── Subscription Users (exclusive content) ────────────────────────────────────

def create_subscription_user(email: str, password_hash: str) -> dict:
    db = get_client()
    try:
        row = {"email": email, "password_hash": password_hash, "status": "pending", "plan": "trial", "videos_created": 0}
        result = db.table("subscription_users").insert(row).execute()
        return result.data[0]
    except Exception as e:
        if "plan" in str(e) or "videos_created" in str(e) or "column" in str(e).lower():
            # Migration hasn't run yet — insert without new columns
            row = {"email": email, "password_hash": password_hash, "status": "pending"}
            result = db.table("subscription_users").insert(row).execute()
            return result.data[0]
        raise


def expire_old_trials() -> int:
    """Set status='expired' for approved trial accounts past their trial_expires_at. Returns count updated."""
    from datetime import datetime, timezone
    db = get_client()
    now = datetime.now(timezone.utc).isoformat()
    try:
        result = (db.table("subscription_users")
                    .update({"status": "expired"})
                    .eq("status", "approved")
                    .lt("trial_expires_at", now)
                    .execute())
        count = len(result.data or [])
        if count:
            print(f"[trial-cleanup] Expired {count} trial account(s)")
        return count
    except Exception as e:
        print(f"[trial-cleanup] Failed: {e}")
        return 0


def get_trials_expiring_soon(hours: int = 24) -> list[dict]:
    """Return approved trial accounts expiring within `hours` hours (for warning emails)."""
    from datetime import datetime, timezone, timedelta
    db = get_client()
    now = datetime.now(timezone.utc)
    cutoff = (now + timedelta(hours=hours)).isoformat()
    try:
        result = (db.table("subscription_users")
                    .select("id,email,trial_expires_at")
                    .eq("status", "approved")
                    .gt("trial_expires_at", now.isoformat())
                    .lt("trial_expires_at", cutoff)
                    .execute())
        return result.data or []
    except Exception as e:
        print(f"[trial-expiry-warn] Failed: {e}")
        return []


def get_subscription_user_by_email(email: str) -> dict | None:
    db = get_client()
    r = db.table("subscription_users").select("*").eq("email", email).execute()
    return r.data[0] if r.data else None


def get_subscription_user_by_id(user_id: str) -> dict | None:
    db = get_client()
    r = db.table("subscription_users").select("*").eq("id", user_id).execute()
    return r.data[0] if r.data else None


def list_subscription_users(status: str = None) -> list[dict]:
    db = get_client()
    q = db.table("subscription_users").select("*").order("created_at", desc=True)
    if status:
        q = q.eq("status", status)
    return q.execute().data or []


def update_subscription_user(user_id: str, **fields) -> dict:
    db = get_client()
    result = db.table("subscription_users").update(fields).eq("id", user_id).execute()
    return result.data[0] if result.data else {}


def set_video_exclusive(video_id: str, is_exclusive: bool) -> dict:
    client = get_client()
    result = client.table("videos").update({"is_exclusive": is_exclusive}).eq("id", video_id).execute()
    if result.data:
        return result.data[0]
    # Fall back to custom_content table
    try:
        result = client.table("custom_content").update({"is_exclusive": is_exclusive}).eq("id", video_id).execute()
        return result.data[0] if result.data else {}
    except Exception:
        return {}


# ── Custom Content ─────────────────────────────────────────────────────────────

def create_custom_content(title: str, description: str = "", tags: list = None,
                          category: str = "Entertainment", privacy: str = "public",
                          file_path: str = None, duration_seconds: int = None,
                          thumbnail_url: str = None) -> dict:
    client = get_client()
    row = {
        "title": title,
        "description": description,
        "tags": tags or [],
        "category": category,
        "privacy": privacy,
        "file_path": file_path,
        "duration_seconds": duration_seconds,
        "thumbnail_url": thumbnail_url,
        "status": "ready",
        "archived": False,
    }
    result = client.table("custom_content").insert(row).execute()
    return result.data[0]


def list_custom_content(include_archived: bool = False, limit: int = 200) -> list[dict]:
    client = get_client()
    q = client.table("custom_content").select("*").order("created_at", desc=True).limit(limit)
    if not include_archived:
        q = q.eq("archived", False)
    return q.execute().data or []


def get_custom_content(item_id: str) -> dict | None:
    client = get_client()
    r = client.table("custom_content").select("*").eq("id", item_id).execute()
    return r.data[0] if r.data else None


def update_custom_content(item_id: str, **fields) -> dict:
    client = get_client()
    result = client.table("custom_content").update(fields).eq("id", item_id).execute()
    return result.data[0] if result.data else {}


def delete_custom_content(item_id: str) -> bool:
    client = get_client()
    client.table("custom_content").delete().eq("id", item_id).execute()
    return True


# ── Prompt Pool ───────────────────────────────────────────────────────────────

def get_next_unused_prompt(pipeline: str = "long") -> Optional[dict]:
    """Return the oldest unused prompt for the given pipeline, or None if exhausted."""
    db = get_client()
    result = (
        db.table("prompt_pool")
        .select("*")
        .eq("pipeline", pipeline)
        .is_("used_at", "null")
        .order("created_at")
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def mark_prompt_used(prompt_id: str):
    db = get_client()
    db.table("prompt_pool").update({"used_at": datetime.now(timezone.utc).isoformat()}).eq("id", prompt_id).execute()


def add_prompts_to_pool(prompts: list, pipeline: str = "long", source: str = "manual") -> int:
    """Insert prompts, skipping exact duplicates. Returns count inserted."""
    db = get_client()
    rows = [{"prompt": p.strip(), "pipeline": pipeline, "source": source} for p in prompts if p.strip()]
    if not rows:
        return 0
    result = db.table("prompt_pool").upsert(rows, on_conflict="prompt,pipeline").execute()
    return len(result.data)


def count_prompt_pool(pipeline: str = "long") -> dict:
    db = get_client()
    total_r  = db.table("prompt_pool").select("id", count="exact").eq("pipeline", pipeline).execute()
    unused_r = db.table("prompt_pool").select("id", count="exact").eq("pipeline", pipeline).is_("used_at", "null").execute()
    return {"total": total_r.count or 0, "unused": unused_r.count or 0}


# ── Quotes ────────────────────────────────────────────────────────────────────
# Requires table: CREATE TABLE public.quotes (
#   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
#   text TEXT NOT NULL,
#   author TEXT NOT NULL DEFAULT '',
#   tags TEXT[] DEFAULT '{}',
#   created_at TIMESTAMPTZ DEFAULT now()
# );

def list_quotes(search: str = "", limit: int = 20, offset: int = 0) -> dict:
    """Return {quotes: [...], total: N}."""
    db = get_client()
    q = db.table("quotes").select("*", count="exact").order("created_at", desc=True)
    if search:
        q = q.or_(f"text.ilike.%{search}%,author.ilike.%{search}%")
    q = q.range(offset, offset + limit - 1)
    r = q.execute()
    return {"quotes": r.data or [], "total": r.count or 0}


def create_quote(text: str, author: str, tags: list = None) -> dict:
    db = get_client()
    row = {"text": text.strip(), "author": (author or "").strip(), "tags": tags or []}
    r = db.table("quotes").insert(row).execute()
    return r.data[0]


def delete_quote(quote_id: str) -> bool:
    db = get_client()
    db.table("quotes").delete().eq("id", quote_id).execute()
    return True


def list_quote_videos(limit: int = 50) -> list:
    """Return videos tagged with 'quote_video' label."""
    db = get_client()
    r = (db.table("videos")
         .select("*")
         .contains("labels", ["quote_video"])
         .order("created_at", desc=True)
         .limit(limit)
         .execute())
    return r.data or []


def reset_prompt_pool(pipeline: str = "long"):
    """Mark all prompts in the pool as unused (reset cycle)."""
    db = get_client()
    db.table("prompt_pool").update({"used_at": None}).eq("pipeline", pipeline).execute()


def list_recent_prompts(pipeline: str = "long", limit: int = 50) -> list:
    """Return recently used prompts (for semantic deduplication)."""
    db = get_client()
    result = (
        db.table("prompt_pool")
        .select("prompt")
        .eq("pipeline", pipeline)
        .not_.is_("used_at", "null")
        .order("used_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [r["prompt"] for r in (result.data or [])]


# ── Blog Posts ────────────────────────────────────────────────────────────────

def create_blog_post(data: dict) -> dict:
    client = get_client()
    result = client.table("blog_posts").insert(data).execute()
    if not result.data:
        err = getattr(result, "error", None)
        raise RuntimeError(str(err) if err else "Insert returned no data — check table schema and constraints")
    return result.data[0]

def update_blog_post(post_id: str, **fields) -> dict:
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    client = get_client()
    result = client.table("blog_posts").update(fields).eq("id", post_id).execute()
    if not result.data:
        raise RuntimeError("Update returned no data")
    return result.data[0]

def delete_blog_post(post_id: str):
    client = get_client()
    client.table("blog_posts").delete().eq("id", post_id).execute()

def get_blog_post(post_id: str) -> dict:
    client = get_client()
    result = client.table("blog_posts").select("*").eq("id", post_id).single().execute()
    return result.data

def get_blog_post_by_slug(slug: str) -> dict:
    client = get_client()
    result = client.table("blog_posts").select("*").eq("slug", slug).single().execute()
    return result.data

def list_blog_posts(status: str = None, limit: int = 50, offset: int = 0) -> list:
    client = get_client()
    query = client.table("blog_posts").select("*").order("created_at", desc=True).limit(limit).offset(offset)
    if status:
        query = query.eq("status", status)
    return query.execute().data

def count_blog_posts(status: str = None) -> int:
    try:
        client = get_client()
        query = client.table("blog_posts").select("id", count="exact")
        if status:
            query = query.eq("status", status)
        result = query.execute()
        return result.count or 0
    except Exception:
        return 0

def increment_blog_post_views(post_id: str):
    try:
        client = get_client()
        client.rpc("increment_blog_views", {"post_id": post_id}).execute()
    except Exception:
        pass  # non-critical
