"""
AutoVid — FastAPI Backend
Main application entry point with all API routes.
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Query, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
import jwt
import time
import threading as _threading
from concurrent.futures import ThreadPoolExecutor as _ThreadPoolExecutor

import hashlib

# ── Simple TTL cache for slow external-API status checks ──────────────────────
# Prevents blocking all worker threads when the Settings tab loads simultaneously.
_STATUS_CACHE: dict = {}   # key → {"data": ..., "expires": float}
_STATUS_CACHE_TTL = 30     # seconds

def _cached_status(key: str, fn, ttl: int = _STATUS_CACHE_TTL):
    """Return cached result if fresh, otherwise call fn() and cache it."""
    entry = _STATUS_CACHE.get(key)
    if entry and entry["expires"] > time.time():
        return entry["data"]
    result = fn()
    _STATUS_CACHE[key] = {"data": result, "expires": time.time() + ttl}
    return result

def _invalidate_cache(key: str):
    _STATUS_CACHE.pop(key, None)
# ──────────────────────────────────────────────────────────────────────────────
import config
import database as db
from pipeline.orchestrator import run_pipeline, retry_failed
from pipeline.youtube_uploader import check_quota_status

# ── App Setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AutoVid API",
    description="AI-powered YouTube video automation engine",
    version="1.0.0",
    redirect_slashes=False,  # Prevents CORS-breaking 307 redirects
)

# Serve local video files for preview (when Supabase storage upload failed)
from fastapi.staticfiles import StaticFiles as _SF
import config as _cfg
_cfg.VIDEOS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/local-videos", _SF(directory=str(_cfg.VIDEOS_OUTPUT_DIR), html=False), name="local-videos")

# Serve stick-figure asset clips for in-browser preview
_STICK_FIGURE_DIR = _cfg.BASE_DIR / "stickFigureAssets"
_STICK_FIGURE_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/stickfigures-assets", _SF(directory=str(_STICK_FIGURE_DIR), html=False), name="stickfigures-assets")

# CORS — must be added before any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

security = HTTPBearer(auto_error=False)

# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


def create_token(email: str) -> str:
    payload = {
        "sub": email,
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400 * 30,  # 30 days
        "role": "superuser",
    }
    return jwt.encode(payload, config.SECRET_KEY, algorithm="HS256")


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, config.SECRET_KEY, algorithms=["HS256"])
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired — please log in again")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.post("/auth/login")
def login(req: LoginRequest):
    """Superuser login — returns JWT token."""
    if req.email != config.SUPERUSER_EMAIL or req.password != config.SUPERUSER_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(req.email)
    return {"token": token, "email": req.email, "role": "superuser"}


@app.get("/auth/me")
def me(user: str = Depends(verify_token)):
    return {"email": user, "role": "superuser"}


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Public health check — no auth needed."""
    return {"status": "ok", "service": "AutoVid API"}


# ── Podcast RSS Feed ───────────────────────────────────────────────────────────

def _escape_xml(text: str) -> str:
    return (str(text)
        .replace("&", "&amp;").replace("<", "&lt;")
        .replace(">", "&gt;").replace('"', "&quot;"))


@app.get("/podcast/feed.xml")
def podcast_feed():
    """
    RSS 2.0 + iTunes/Spotify podcast feed.
    Submit this URL once at podcasters.spotify.com — new episodes appear automatically.
    Public endpoint (no auth) so Spotify can fetch it.

    Fields populated automatically per episode:
      title, description, pubDate, enclosure (mp3 url), guid, duration,
      itunes:image (YouTube thumbnail), itunes:explicit, itunes:episodeType
    """
    from fastapi.responses import Response
    from datetime import datetime, timezone

    all_videos = db.list_videos(limit=500)
    # Only episodes with an MP3 and a title; exclude future-scheduled ones and shorts
    now_iso = datetime.now(timezone.utc).isoformat()
    episodes = [
        v for v in all_videos
        if v.get("narration_url") and v.get("title")
        and v.get("resolution") != "1080x1920"          # exclude shorts (vertical format)
        and (v.get("scheduled_for") or "0") <= now_iso  # skip future-scheduled
    ]

    base_url      = config.BASE_URL.rstrip("/")
    feed_url      = f"{base_url}/api/podcast/feed.xml"
    ch_title      = _escape_xml(config.PODCAST_TITLE)
    ch_desc       = _escape_xml(config.PODCAST_DESCRIPTION)
    ch_author     = _escape_xml(config.PODCAST_AUTHOR)
    ch_email      = _escape_xml(config.PODCAST_EMAIL)
    ch_category   = config.PODCAST_CATEGORY          # already XML-safe in config
    ch_subcategory= _escape_xml(config.PODCAST_SUBCATEGORY)
    ch_language   = config.PODCAST_LANGUAGE
    ch_explicit   = config.PODCAST_EXPLICIT
    ch_image      = config.PODCAST_IMAGE_URL

    # Channel-level image block
    image_xml = ""
    if ch_image:
        image_xml = f"""
    <image>
      <url>{ch_image}</url>
      <title>{ch_title}</title>
      <link>{base_url}</link>
    </image>
    <itunes:image href="{ch_image}"/>"""

    # Owner block (required by Spotify)
    owner_xml = ""
    if ch_email:
        owner_xml = f"""
    <itunes:owner>
      <itunes:name>{ch_author}</itunes:name>
      <itunes:email>{ch_email}</itunes:email>
    </itunes:owner>"""

    # Sub-category block
    subcat_xml = ""
    if ch_subcategory:
        subcat_xml = f'<itunes:category text="{ch_subcategory}"/>'

    # Build episode items
    items_xml = ""
    for ep_num, v in enumerate(episodes, start=1):
        pub_raw = v.get("scheduled_for") or v.get("posted_at") or v.get("created_at", "")
        try:
            dt = datetime.fromisoformat(pub_raw.replace("Z", "+00:00"))
            rfc_date = dt.strftime("%a, %d %b %Y %H:%M:%S +0000")
        except Exception:
            rfc_date = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

        dur = v.get("duration_seconds") or 0
        # Episode artwork — prefer YouTube thumbnail (public URL), fall back to channel image
        yt_id = v.get("youtube_id") or ""
        ep_thumb = (
            f"https://i.ytimg.com/vi/{yt_id}/hqdefault.jpg" if yt_id
            else ch_image
        )
        ep_image_xml = f'<itunes:image href="{ep_thumb}"/>' if ep_thumb else ""
        ep_link = v.get("youtube_url") or base_url
        ep_desc = _escape_xml((v.get("description") or v.get("title") or ""))

        items_xml += f"""
  <item>
    <title>{_escape_xml(v['title'])}</title>
    <description>{ep_desc}</description>
    <pubDate>{rfc_date}</pubDate>
    <enclosure url="{v['narration_url']}" type="audio/mpeg" length="0"/>
    <guid isPermaLink="false">{v['id']}</guid>
    <link>{ep_link}</link>
    <itunes:duration>{dur}</itunes:duration>
    <itunes:explicit>{ch_explicit}</itunes:explicit>
    <itunes:episodeType>full</itunes:episodeType>
    <itunes:episode>{ep_num}</itunes:episode>
    {ep_image_xml}
  </item>"""

    build_date = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

    rss = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>{ch_title}</title>
    <link>{base_url}</link>
    <description>{ch_desc}</description>
    <language>{ch_language}</language>
    <lastBuildDate>{build_date}</lastBuildDate>
    <itunes:author>{ch_author}</itunes:author>
    <itunes:explicit>{ch_explicit}</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    <itunes:category text="{ch_category}">
      {subcat_xml}
    </itunes:category>
    <atom:link href="{feed_url}" rel="self" type="application/rss+xml"/>
    {image_xml}
    {owner_xml}
    {items_xml}
  </channel>
</rss>"""

    return Response(content=rss, media_type="application/rss+xml")


# ── Video models ──────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    prompt: str
    auto_upload: bool = True
    profile: str = "educational"
    visual_mood: Optional[str] = None
    music_style: str = "ambient"
    music_volume: float = 0.06
    use_stickfigures: bool = False


class VideoResponse(BaseModel):
    id: str
    prompt: str
    title: Optional[str] = None
    description: Optional[str] = None
    script: Optional[str] = None
    status: str
    labels: list = []
    category: Optional[str] = None
    duration_seconds: Optional[int] = None
    resolution: Optional[str] = None
    file_path: Optional[str] = None
    narration_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    youtube_id: Optional[str] = None
    youtube_url: Optional[str] = None
    views_count: int = 0
    likes_count: int = 0
    error_message: Optional[str] = None
    created_at: str
    posted_at: Optional[str] = None
    scheduled_for: Optional[str] = None   # ISO date — episode hidden from feed until this date
    archived: Optional[bool] = False


# ── Video routes — IMPORTANT: specific paths BEFORE /{video_id} ──────────────

def _job_signature(prompt: str, profile: str, visual_mood: str, music_style: str) -> str:
    """Stable hash of job parameters — used to deduplicate identical submissions."""
    key = f"{prompt.strip().lower()}|{profile}|{visual_mood or ''}|{music_style}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


@app.post("/videos/generate")
def generate_video(
    req: GenerateRequest,
    background_tasks: BackgroundTasks,
    user: str = Depends(verify_token),
):
    """Start the full AutoVid pipeline. Returns immediately — pipeline runs in background.
    Duplicate jobs (same prompt + settings already generating/queued) are rejected with 409."""
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    # ── Deduplication: reject if identical job is already active ─────────────
    sig = _job_signature(req.prompt, req.profile, req.visual_mood, req.music_style)
    active = db.list_videos(status="generating", limit=50)
    for v in active:
        if v.get("job_sig") == sig:
            raise HTTPException(
                status_code=409,
                detail=f"A job with the same prompt and settings is already running (video_id: {v['id']})"
            )

    # Pre-create DB record so we have a video_id to return immediately
    record   = db.create_video(req.prompt)
    video_id = record["id"]
    # Store signature so future requests can detect the duplicate
    try:
        db.update_video(video_id, job_sig=sig)
    except Exception:
        pass  # job_sig column may not exist yet — dedup still works via in-memory check

    _register_pipeline(video_id)

    def _cb(info):
        step = info.get("step", "?") if isinstance(info, dict) else str(info)
        msg  = info.get("message", "") if isinstance(info, dict) else ""
        _push_log(video_id, f"[{step}] {msg}")

    def _run():
        try:
            run_pipeline(
                prompt=req.prompt,
                auto_upload=req.auto_upload,
                profile=req.profile,
                visual_mood=req.visual_mood,
                music_style=req.music_style,
                music_volume=req.music_volume,
                progress_callback=_cb,
                video_id=video_id,
                use_stickfigures=req.use_stickfigures,
            )
        except Exception as e:
            _push_log(video_id, f"[ERROR] {e}")
        finally:
            _push_log(video_id, "__DONE__")
            _unregister_pipeline(video_id)

    pos = _queue_pipeline(_run, job_id=video_id, job_type="video", prompt=req.prompt)

    return {"message": "Pipeline queued" if pos > 1 else "Pipeline started", "prompt": req.prompt, "status": "generating", "video_id": video_id, "queue_position": pos}


@app.post("/videos/{video_id}/cancel")
def cancel_pipeline(video_id: str, user: str = Depends(verify_token)):
    """Cancel a running pipeline and mark it failed."""
    with _pipeline_lock:
        entry = _active_pipelines.get(video_id)
        if entry:
            entry["cancelled"] = True
    try:
        db.set_failed(video_id, "Cancelled by user")
    except Exception:
        pass
    return {"message": "Cancellation requested", "video_id": video_id}


_IN_PROGRESS_STATUSES = {"generating", "scripted", "voiced", "assembled", "captioned", "labeled"}

@app.get("/videos/{video_id}/logs")
def get_logs(video_id: str, since: int = Query(default=0), user: str = Depends(verify_token)):
    """Return buffered pipeline logs since a given line index.
    Frontend polls this every second — simple and reliable.

    With multiple backend instances the in-memory pipeline registry only exists
    on the instance that is *running* the job.  If this instance has no entry,
    we fall back to the DB status: if the video is still in-progress the
    pipeline is running on the other instance — return done=False so the
    frontend keeps polling until the DB status leaves the in-progress set.
    """
    with _pipeline_lock:
        entry = _active_pipelines.get(video_id)
    if not entry:
        # Check DB: if still in-progress, pipeline is alive on another instance
        try:
            v = db.get_video(video_id)
            if v and v.get("status") in _IN_PROGRESS_STATUSES:
                return {"lines": [], "total": 0, "done": False}
        except Exception:
            pass
        return {"lines": [], "total": 0, "done": True}
    lines = entry.get("log_buffer", [])
    running = not entry.get("done", False)
    return {
        "lines": lines[since:],   # only return new lines since last poll
        "total": len(lines),
        "done": not running,
    }


@app.post("/videos/backfill-storage")
def backfill_storage(user: str = Depends(verify_token)):
    """One-time migration: upload local video files to Supabase Storage."""
    from pipeline.storage import upload_to_storage
    import os
    all_videos = db.list_videos(limit=500)
    uploaded, skipped, missing = 0, 0, 0
    for v in all_videos:
        fp = v.get("file_path")
        if not fp or fp.startswith("http"):
            skipped += 1
            continue
        if not os.path.exists(fp):
            missing += 1
            continue
        try:
            url = upload_to_storage(fp, v["id"])
            db.update_video(v["id"], file_path=url)
            uploaded += 1
        except Exception as e:
            print(f"  ❌ {v['id'][:8]}: {e}")
    return {"uploaded": uploaded, "skipped": skipped, "missing_locally": missing}


@app.post("/videos/fix-stuck")
def fix_stuck_videos(user: str = Depends(verify_token)):
    """Reset any videos stuck in generating/processing states with no active pipeline."""
    all_videos = db.list_videos(limit=500)
    stuck_statuses = ['generating','scripted','voiced','assembled','captioned','labeled']
    fixed = 0
    for v in all_videos:
        if v['status'] in stuck_statuses:
            # Skip videos that are actively running or queued in the executor
            if v['id'] in _active_pipelines:
                continue
            # If it has a youtube_id it was actually posted — mark posted
            if v.get('youtube_id'):
                db.set_posted(v['id'], v['youtube_id'], v.get('youtube_url',''))
            # If it has a file_path it completed assembly — mark ready
            elif v.get('file_path'):
                db.set_ready(v['id'])
            # Otherwise it truly failed mid-pipeline
            else:
                db.set_failed(v['id'], 'Pipeline interrupted — please retry')
            fixed += 1
            print(f"  Fixed stuck: {v['id'][:8]} ({v['status']} → {'posted' if v.get('youtube_id') else 'ready' if v.get('file_path') else 'failed'})")
    return {"fixed": fixed, "message": f"Fixed {fixed} stuck videos"}


@app.post("/videos/fix-posted-status")
def fix_posted_status(user: str = Depends(verify_token)):
    """One-time fix: mark videos with a youtube_id as posted."""
    all_videos = db.list_videos(limit=500)
    fixed = 0
    for v in all_videos:
        if v.get("youtube_id") and v["status"] != "posted":
            db.update_video(v["id"],
                status="posted",
                posted_at=v.get("posted_at") or v["created_at"]
            )
            fixed += 1
    return {"fixed": fixed, "message": f"Fixed {fixed} videos"}



# ── Danger Zone ───────────────────────────────────────────────────────────────

class DangerAuthRequest(BaseModel):
    key: str


def verify_danger_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Dependency: accepts only tokens with role='danger' (issued by /admin/danger/verify)."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Danger token required")
    try:
        payload = jwt.decode(credentials.credentials, config.SECRET_KEY, algorithms=["HS256"])
        if payload.get("role") != "danger":
            raise HTTPException(status_code=403, detail="Insufficient privileges — danger token required")
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Danger token expired")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid danger token")


@app.post("/admin/danger/verify")
def verify_danger_access(req: DangerAuthRequest, user: str = Depends(verify_token)):
    """Verify the danger zone key and return a short-lived (1h) danger token."""
    if not config.DANGER_ZONE_KEY:
        raise HTTPException(status_code=503, detail="Danger zone is disabled — DANGER_ZONE_KEY not set in .env")
    if req.key != config.DANGER_ZONE_KEY:
        raise HTTPException(status_code=401, detail="Invalid danger zone key")
    payload = {
        "sub": user,
        "role": "danger",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }
    danger_token = jwt.encode(payload, config.SECRET_KEY, algorithm="HS256")
    return {"danger_token": danger_token}


@app.delete("/admin/danger/clear-videos")
def danger_clear_videos(user: str = Depends(verify_danger_token)):
    """DANGER: Permanently delete ALL video records from the database."""
    count = db.danger_clear_all_videos()
    return {"deleted": count, "message": f"Deleted all {count} video records from database"}


@app.delete("/admin/danger/clear-storage")
def danger_clear_storage_files(user: str = Depends(verify_danger_token)):
    """DANGER: Delete ALL files from Supabase Storage (videos + narrations buckets)."""
    result = db.danger_clear_storage()
    return {
        "videos_deleted": result["videos"],
        "narrations_deleted": result["narrations"],
        "errors": result["errors"],
        "message": f"Cleared {result['videos']} video files and {result['narrations']} narration files",
    }


@app.post("/videos/{video_id}/force-reset")
def force_reset_video(video_id: str, user: str = Depends(verify_token)):
    """Force-reset a single stuck video: resolve state based on available data."""
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    stuck = ['generating', 'scripted', 'voiced', 'assembled', 'captioned', 'labeled', 'uploading']
    if video['status'] not in stuck:
        raise HTTPException(status_code=400, detail=f"Video is not in a stuck state (status: {video['status']})")
    if video.get('youtube_id'):
        db.set_posted(video_id, video['youtube_id'], video.get('youtube_url', ''))
        return {"message": "Resolved as posted", "new_status": "posted"}
    elif video.get('file_path'):
        db.set_ready(video_id)
        return {"message": "Resolved as ready", "new_status": "ready"}
    else:
        db.set_failed(video_id, "Force-reset: pipeline was stuck with no output file")
        return {"message": "Resolved as failed (no output)", "new_status": "failed"}


@app.post("/videos/sync-youtube")
def sync_youtube_stats(user: str = Depends(verify_token)):
    """Pull latest views/likes from YouTube API for all posted videos."""
    posted = db.list_videos(status="posted")
    if not posted:
        return {"synced": 0, "message": "No posted videos"}
    try:
        from pipeline.youtube_uploader import get_authenticated_service
        service = get_authenticated_service()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"YouTube auth failed: {e}")

    youtube_ids = [v["youtube_id"] for v in posted if v.get("youtube_id")]
    synced = 0
    for i in range(0, len(youtube_ids), 50):
        batch = youtube_ids[i:i+50]
        try:
            resp = service.videos().list(part="statistics", id=",".join(batch)).execute()
            for item in resp.get("items", []):
                yt_id = item["id"]
                stats = item.get("statistics", {})
                match = next((v for v in posted if v["youtube_id"] == yt_id), None)
                if match:
                    db.update_video(match["id"],
                        views_count=int(stats.get("viewCount", 0)),
                        likes_count=int(stats.get("likeCount", 0)),
                    )
                    synced += 1
        except Exception as e:
            print(f"⚠️  Sync error: {e}")
    return {"synced": synced, "message": f"Synced {synced} videos"}


# ── Per-video routes — AFTER specific paths ───────────────────────────────────

@app.get("/videos", response_model=list[VideoResponse])
def list_videos(status: Optional[str] = None, user: str = Depends(verify_token)):
    return db.list_videos(status=status)


@app.get("/videos/archived")
def list_archived_videos(user: str = Depends(verify_token)):
    """List all archived videos."""
    return db.list_archived_videos()


@app.post("/videos/{video_id}/archive")
def archive_video(video_id: str, user: str = Depends(verify_token)):
    """Archive a video (hide from normal listings)."""
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    db.archive_video(video_id)
    return {"message": "Video archived"}


@app.post("/videos/{video_id}/unarchive")
def unarchive_video(video_id: str, user: str = Depends(verify_token)):
    """Restore a video from archive."""
    db.unarchive_video(video_id)
    return {"message": "Video unarchived"}


@app.get("/videos/{video_id}", response_model=VideoResponse)
def get_video(video_id: str, user: str = Depends(verify_token)):
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@app.post("/videos/{video_id}/retry")
def retry_video(video_id: str, background_tasks: BackgroundTasks, user: str = Depends(verify_token)):
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video["status"] != "failed":
        raise HTTPException(status_code=400, detail=f"Video not in failed state: {video['status']}")
    background_tasks.add_task(retry_failed, video_id)
    return {"message": "Retry started", "video_id": video_id}


class UploadRequest(BaseModel):
    title:       Optional[str] = None
    description: Optional[str] = None
    tags:        Optional[list[str]] = None
    privacy:     Optional[str] = "public"   # public | unlisted | private
    category:    Optional[str] = None
    made_for_kids: Optional[bool] = False


@app.post("/videos/{video_id}/upload")
def upload_to_youtube(video_id: str, req: UploadRequest, background_tasks: BackgroundTasks, user: str = Depends(verify_token)):
    """Upload video to YouTube with custom title, description, tags, privacy."""
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video["status"] != "ready":
        raise HTTPException(status_code=400, detail=f"Video must be ready (current: {video['status']})")

    # Merge form values with video defaults
    title       = (req.title       or video["title"]       or "AutoVid Video")[:100]
    description = (req.description or video["description"] or "")[:5000]
    tags        = req.tags         or video["labels"]       or []
    privacy     = req.privacy      or "public"
    category    = req.category     or video["category"]     or "Entertainment"

    # Persist the updated metadata back to DB
    db.update_video(video_id, title=title, description=description, labels=tags)

    def do_upload():
        import urllib.request, tempfile, os as _os
        from pathlib import Path as _P
        try:
            db.update_video(video_id, status="uploading", error_message=None)
            file_path = video["file_path"]

            if file_path and not file_path.startswith("http") and not _P(file_path).exists():
                import config as _cfg
                candidates = list(_cfg.VIDEOS_OUTPUT_DIR.glob(f"{video_id}*.mp4"))
                if candidates:
                    file_path = str(candidates[0])
                    db.update_video(video_id, file_path=file_path)
                else:
                    raise FileNotFoundError(
                        f"No video file found for {video_id[:8]}. Please regenerate the video."
                    )

            from pipeline.youtube_uploader import upload_video
            result = upload_video(
                video_path=file_path,
                title=title,
                description=description,
                labels=tags,
                category=category,
                privacy=privacy,
                thumbnail_path=video.get("thumbnail_url"),
            )
            db.set_posted(video_id, result["youtube_id"], result["youtube_url"])
            from pipeline.youtube_uploader import record_upload
            record_upload()  # track quota usage
            print(f"✅ Posted: {result['youtube_url']}")

            if file_path and not file_path.startswith("http"):
                local = _P(file_path)
                if local.exists():
                    local.unlink()

        except Exception as e:
            # Keep status "ready" so the video can still be uploaded to other platforms
            # or retried for YouTube without rebuilding the entire video.
            db.update_video(video_id, status="ready", error_message=f"YouTube upload failed: {e}"[:500])
            print(f"❌ Upload failed: {e}")

    background_tasks.add_task(do_upload)
    return {"message": "Upload started", "video_id": video_id}


@app.post("/videos/{video_id}/retry-upload")
def retry_upload(video_id: str, req: UploadRequest, background_tasks: BackgroundTasks, user: str = Depends(verify_token)):
    """Re-attempt YouTube upload without rebuilding the video. Works on ready/failed videos that have a file."""
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not video.get("file_path"):
        raise HTTPException(status_code=400, detail="No video file — regenerate the video first")
    if video["status"] not in {"ready", "failed"}:
        raise HTTPException(status_code=400, detail=f"Cannot retry upload: status is '{video['status']}'")

    title       = (req.title       or video.get("title")       or "AutoVid Video")[:100]
    description = (req.description or video.get("description") or "")[:5000]
    tags        = req.tags         or video.get("labels")       or []
    privacy     = req.privacy      or "public"
    category    = req.category     or video.get("category")     or "Entertainment"

    def do_retry():
        import urllib.request as _ureq, tempfile, os as _os
        tmp_file = None
        try:
            db.update_video(video_id, status="uploading", error_message=None)
            file_path = video["file_path"]
            if file_path and file_path.startswith("http"):
                tmp_file = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
                _ureq.urlretrieve(file_path, tmp_file.name)
                file_path = tmp_file.name
            from pipeline.youtube_uploader import upload_video, record_upload
            result = upload_video(
                video_path=file_path, title=title, description=description,
                labels=tags, category=category, privacy=privacy,
                thumbnail_path=video.get("thumbnail_url"),
            )
            db.set_posted(video_id, result["youtube_id"], result["youtube_url"])
            record_upload()
        except Exception as e:
            db.update_video(video_id, status="ready", error_message=f"YouTube upload failed: {e}"[:500])
            print(f"❌ Retry upload failed: {e}")
        finally:
            if tmp_file:
                try: _os.unlink(tmp_file.name)
                except Exception: pass

    background_tasks.add_task(do_retry)
    return {"message": "Upload retry started", "video_id": video_id}


@app.patch("/videos/{video_id}")
def update_video_meta(video_id: str, body: dict, user: str = Depends(verify_token)):
    """Update editable fields on a video record (title, description, labels)."""
    allowed = {"title", "description", "labels"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    db.update_video(video_id, **updates)
    return {"message": "Updated", "video_id": video_id, "updated": list(updates.keys())}


@app.patch("/compilations/{comp_id}/rename")
def rename_compilation(comp_id: str, body: dict, user: str = Depends(verify_token)):
    """Rename an existing compilation."""
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    db.update_video(comp_id, title=title)
    return {"message": "Renamed", "compilation_id": comp_id, "title": title}


@app.patch("/videos/{video_id}/youtube-settings")
def update_youtube_settings(video_id: str, req: UploadRequest, user: str = Depends(verify_token)):
    """Update privacy/title/description/tags on an already-uploaded YouTube video."""
    video = db.get_video(video_id)
    if not video or not video.get("youtube_id"):
        raise HTTPException(status_code=404, detail="Video not found or not on YouTube")
    try:
        from pipeline.youtube_uploader import get_authenticated_service
        service = get_authenticated_service()
        body = {"id": video["youtube_id"]}
        parts = []
        if req.privacy:
            body["status"] = {"privacyStatus": req.privacy, "selfDeclaredMadeForKids": req.made_for_kids or False}
            parts.append("status")
        if req.title or req.description or req.tags or req.category:
            from pipeline.youtube_uploader import CATEGORY_MAP
            body["snippet"] = {
                "title":       (req.title       or video["title"]       or "")[:100],
                "description": (req.description or video["description"] or "")[:5000],
                "tags":        req.tags or video["labels"] or [],
                "categoryId":  CATEGORY_MAP.get(req.category or video["category"] or "Entertainment", "24"),
                "defaultLanguage": "en",
            }
            parts.append("snippet")
        if parts:
            service.videos().update(part=",".join(parts), body=body).execute()
            if req.title:       db.update_video(video_id, title=req.title)
            if req.description: db.update_video(video_id, description=req.description)
            if req.tags:        db.update_video(video_id, labels=req.tags)
        return {"message": "YouTube settings updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/videos/{video_id}")
def delete_video(video_id: str, user: str = Depends(verify_token)):
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    db.get_client().table("videos").delete().eq("id", video_id).execute()
    return {"message": "Deleted"}


# ── YouTube Management Routes ────────────────────────────────────────────────

@app.delete("/videos/{video_id}/youtube")
def delete_from_youtube(video_id: str, user: str = Depends(verify_token)):
    """Delete video from YouTube AND update DB status to 'ready'."""
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not video.get("youtube_id"):
        raise HTTPException(status_code=400, detail="Video has no YouTube ID")
    try:
        from pipeline.youtube_uploader import delete_youtube_video
        delete_youtube_video(video["youtube_id"])
        db.update_video(video_id,
            status="ready",
            youtube_id=None,
            youtube_url=None,
            posted_at=None,
            views_count=0,
            likes_count=0,
        )
        return {"message": "Deleted from YouTube", "video_id": video_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"YouTube delete failed: {e}")


@app.get("/videos/{video_id}/youtube-details")
def get_youtube_details(video_id: str, user: str = Depends(verify_token)):
    """Fetch full YouTube metadata + stats for a posted video."""
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not video.get("youtube_id"):
        raise HTTPException(status_code=400, detail="Video not posted to YouTube")
    try:
        from pipeline.youtube_uploader import get_video_details
        details = get_video_details(video["youtube_id"])
        # Also update DB with latest stats
        db.update_video(video_id,
            views_count=details.get("views", 0),
            likes_count=details.get("likes", 0),
        )
        return details
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"YouTube API error: {e}")


@app.get("/videos/{video_id}/comments")
def get_comments(video_id: str, user: str = Depends(verify_token)):
    """Fetch YouTube comments for a posted video."""
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not video.get("youtube_id"):
        raise HTTPException(status_code=400, detail="Video not posted to YouTube")
    try:
        from pipeline.youtube_uploader import get_video_comments
        comments = get_video_comments(video["youtube_id"])
        return {"comments": comments, "count": len(comments)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comments fetch failed: {e}")


@app.post("/videos/{video_id}/comments")
def post_comment(video_id: str, body: dict, user: str = Depends(verify_token)):
    """Post a comment on a YouTube video."""
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not video.get("youtube_id"):
        raise HTTPException(status_code=400, detail="Video not posted to YouTube")
    text = body.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment text is required")
    try:
        from pipeline.youtube_uploader import post_youtube_comment
        result = post_youtube_comment(video["youtube_id"], text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comment failed: {e}")


@app.delete("/videos/{video_id}/comments/{comment_id}")
def delete_comment(video_id: str, comment_id: str, user: str = Depends(verify_token)):
    """Delete a YouTube comment."""
    try:
        from pipeline.youtube_uploader import delete_youtube_comment
        delete_youtube_comment(comment_id)
        return {"message": "Comment deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {e}")


@app.post("/videos/{video_id}/comments/{thread_id}/reply")
def reply_comment(video_id: str, thread_id: str, body: dict, user: str = Depends(verify_token)):
    """Reply to a top-level comment thread."""
    text = body.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Reply text required")
    try:
        from pipeline.youtube_uploader import reply_to_comment
        result = reply_to_comment(thread_id, text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reply failed: {e}")


@app.post("/videos/{video_id}/comments/{comment_id}/moderate")
def moderate_comment_endpoint(video_id: str, comment_id: str, body: dict, user: str = Depends(verify_token)):
    """Set moderation status: heldForReview | published | rejected."""
    status = body.get("status", "")
    ban    = body.get("ban_author", False)
    if status not in ("heldForReview", "published", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid status")
    try:
        from pipeline.youtube_uploader import moderate_comment
        moderate_comment(comment_id, status, ban_author=ban)
        return {"message": f"Comment set to {status}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Moderation failed: {e}")


# ── Script Studio ─────────────────────────────────────────────────────────────

class ScriptStudioRequest(BaseModel):
    title:            str
    script:           str
    profile:          str = "educational"
    visual_mood:      Optional[str] = None   # ocean|candle|forest|stars|hands|mountains|None=auto
    music_style:      str = "ambient"
    music_volume:     float = 0.06
    use_stickfigures: bool = False


@app.post("/script-studio/generate")
def script_studio_generate(req: ScriptStudioRequest, background_tasks: BackgroundTasks, user: str = Depends(verify_token)):
    """Start the script-first video generation pipeline."""
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    word_count = len(req.script.split())
    if word_count < 30:
        raise HTTPException(status_code=400, detail=f"Script too short ({word_count} words). Minimum 30 words.")

    row      = db.create_video(prompt=req.title)
    video_id = row["id"]

    # Register pipeline so /logs polling endpoint can read progress
    _register_pipeline(video_id)

    def _cb(info):
        # script_pipeline calls cb(stage, message) as two args OR orchestrator as dict
        if isinstance(info, dict):
            step = info.get("step", "?")
            msg  = info.get("message", "")
        else:
            step = str(info)
            msg  = ""
        _push_log(video_id, f"[{step}] {msg}")

    from pipeline.script_pipeline import run_script_pipeline

    def _run():
        try:
            run_script_pipeline(
                video_id=video_id,
                title=req.title,
                script=req.script,
                profile=req.profile,
                visual_mood=req.visual_mood,
                music_style=req.music_style,
                music_volume=req.music_volume,
                use_stickfigures=req.use_stickfigures,
                cb=_cb,
            )
        except Exception as e:
            _push_log(video_id, f"[ERROR] {e}")
        finally:
            _push_log(video_id, "[DONE] Pipeline finished")
            _unregister_pipeline(video_id)

    pos = _queue_pipeline(_run, job_id=video_id, job_type="script", prompt=req.title)

    return {"video_id": video_id, "message": "Script pipeline queued" if pos > 1 else "Script pipeline started", "word_count": word_count, "queue_position": pos}


# ── Stats & Quota ─────────────────────────────────────────────────────────────

@app.get("/stats")
def get_stats(user: str = Depends(verify_token)):
    return db.get_stats()


@app.get("/pipeline/metrics")
def pipeline_metrics(user: str = Depends(verify_token)):
    """Return 24-hour job history for pipeline visualization."""
    _ensure_history_reset()
    with _job_history_lock:
        hourly = dict(_job_history["hourly"])
        jobs   = list(_job_history["jobs"])
        date   = _job_history["date"]
    pending = _pipeline_executor._work_queue.qsize()
    total_done   = sum(v["done"]   for v in hourly.values())
    total_failed = sum(v["failed"] for v in hourly.values())
    return {
        "date":          date,
        "hourly":        hourly,
        "recent_jobs":   jobs[:50],
        "summary": {
            "total_done":   total_done,
            "total_failed": total_failed,
            "pending":      pending,
        },
    }


@app.get("/queue/status")
def queue_status(user: str = Depends(verify_token)):
    """Return current job queue state — active + pending jobs."""
    generating = db.list_videos(status="generating", limit=50)
    celery_info = {"available": False, "queued": 0}
    try:
        from workers.celery_worker import celery_app
        inspect = celery_app.control.inspect(timeout=1.0)
        active  = inspect.active()  or {}
        reserved = inspect.reserved() or {}
        celery_info = {
            "available": True,
            "active":   sum(len(t) for t in active.values()),
            "queued":   sum(len(t) for t in reserved.values()),
        }
    except Exception:
        pass
    pending_in_queue = _pipeline_executor._work_queue.qsize()
    return {
        "generating": len(generating),
        "pending":    pending_in_queue,
        "total":      len(generating) + pending_in_queue,
        "jobs": [{"id": v["id"], "prompt": v.get("prompt", "")[:60], "created_at": v.get("created_at")} for v in generating],
        "celery": celery_info,
    }


@app.get("/quota")
def get_quota(user: str = Depends(verify_token)):
    # Quota file is local JSON — no API call, but still cache to reduce disk reads
    import time
    now = time.time()
    if not hasattr(get_quota, '_cache') or now - get_quota._cache[1] > 300:
        get_quota._cache = (check_quota_status(), now)  # cache 5 min
    return get_quota._cache[0]


# ── Auto-Generator Settings ──────────────────────────────────────────────────

class AutoGenerateSettings(BaseModel):
    enabled:  bool
    days:     list           # [0-6] days of week
    profile:  str
    prompts:  list           # list of prompt strings
    hour:     int            # UTC hour to run (0-23)

@app.get("/auto-generate/settings")
def get_auto_generate_settings(user: str = Depends(verify_token)):
    from pipeline.auto_generator import get_settings
    return get_settings()

@app.post("/auto-generate/settings")
def save_auto_generate_settings(req: AutoGenerateSettings, user: str = Depends(verify_token)):
    from pipeline.auto_generator import save_settings
    settings = {
        "enabled": req.enabled,
        "days":    req.days,
        "profile": req.profile,
        "prompts": req.prompts,
        "hour":    req.hour,
    }
    save_settings(settings)
    return {"message": "Auto-generate settings saved", "settings": settings}

@app.post("/auto-generate/trigger")
def trigger_auto_generate(user: str = Depends(verify_token)):
    """Manually trigger one auto-generated video. Registers log queue so frontend can stream progress."""
    import threading
    from pipeline.auto_generator import run_auto_generate, get_settings
    from pipeline.script_gen import CHANNEL_PROFILES

    # Pre-create DB record so we can return video_id immediately
    settings = get_settings()
    prompts  = settings.get("prompts", [])
    if not prompts:
        raise HTTPException(status_code=400, detail="No prompts configured in auto-generate settings")

    # Pick next prompt (same logic as run_auto_generate)
    from pipeline.auto_generator import _pick_next_prompt
    prompt   = _pick_next_prompt(prompts)
    profile  = settings.get("profile", "educational")

    record   = db.create_video(prompt)
    video_id = record["id"]
    _register_pipeline(video_id)

    def _cb(info: dict):
        # Orchestrator calls cb({"step": ..., "message": ...})
        step = info.get("step", "?") if isinstance(info, dict) else str(info)
        msg  = info.get("message", "") if isinstance(info, dict) else ""
        _push_log(video_id, f"[{step}] {msg}")

    def _run():
        try:
            from pipeline.orchestrator import run_pipeline
            run_pipeline(
                prompt=prompt,
                profile=profile,
                auto_upload=False,
                music_style="Birds_Atmosphere_Piano",
                video_id=video_id,
                progress_callback=_cb,
            )
            _push_log(video_id, "[DONE] Pipeline finished — video ready for review")
        except Exception as e:
            _push_log(video_id, f"[ERROR] {e}")
        finally:
            _unregister_pipeline(video_id)

    threading.Thread(target=_run, daemon=True).start()
    return {
        "message": "Auto-generate triggered",
        "video_id": video_id,
        "prompt": prompt,
        "profile": profile,
    }


# ── Auto-Short Settings ──────────────────────────────────────────────────────

class AutoShortSettings(BaseModel):
    enabled:      bool
    days:         list
    topics:       list
    hour:         int
    ambience:     str = "rain"
    music_style:  str = "Laidback_Fevorite"
    music_volume: float = 0.04

@app.get("/auto-short/settings")
def get_auto_short_settings_endpoint(user: str = Depends(verify_token)):
    from pipeline.auto_generator import get_auto_short_settings
    return get_auto_short_settings()

@app.post("/auto-short/settings")
def save_auto_short_settings_endpoint(req: AutoShortSettings, user: str = Depends(verify_token)):
    from pipeline.auto_generator import save_auto_short_settings
    settings = {
        "enabled":      req.enabled,
        "days":         req.days,
        "topics":       req.topics,
        "hour":         req.hour,
        "ambience":     req.ambience,
        "music_style":  req.music_style,
        "music_volume": req.music_volume,
    }
    save_auto_short_settings(settings)
    return {"message": "Auto-short settings saved", "settings": settings}

@app.post("/auto-short/trigger")
def trigger_auto_short(user: str = Depends(verify_token)):
    """Manually trigger one auto-generated short."""
    import threading
    from pipeline.auto_generator import run_auto_short, get_auto_short_settings, _pick_next_short_topic

    settings = get_auto_short_settings()
    topics   = settings.get("topics", [])
    if not topics:
        raise HTTPException(status_code=400, detail="No topics configured in auto-short settings")

    topic, angle = _pick_next_short_topic(topics)
    ambience     = settings.get("ambience", "rain")
    music_style  = settings.get("music_style", "Laidback_Fevorite")
    music_volume = float(settings.get("music_volume", 0.04))

    record   = db.create_video(f"[Short] {topic}")
    video_id = record["id"]
    _register_pipeline(video_id)

    def _cb(info: dict):
        step = info.get("step", "?") if isinstance(info, dict) else str(info)
        msg  = info.get("message", "") if isinstance(info, dict) else ""
        _push_log(video_id, f"[{step}] {msg}")

    def _run():
        try:
            from pipeline.orchestrator import run_short_pipeline
            run_short_pipeline(prompt=topic, ambience=ambience, video_id=video_id, cb=_cb, music_style=music_style, music_volume=music_volume, angle=angle)
            _push_log(video_id, "[DONE] Short pipeline finished — ready for review")
        except Exception as e:
            _push_log(video_id, f"[ERROR] {e}")
        finally:
            _unregister_pipeline(video_id)

    threading.Thread(target=_run, daemon=True).start()
    return {"message": "Auto-short started", "video_id": video_id, "topic": topic}


# ── Podcast Episode Pipeline ──────────────────────────────────────────────────

class PodcastSettings(BaseModel):
    enabled:      bool
    days:         list
    topics:       list
    hour:         int
    music_style:  str = "ambient"


class PodcastGenerateRequest(BaseModel):
    topic:        Optional[str] = None
    title:        Optional[str] = None
    essay:        Optional[str] = None
    music_style:  str = "ambient"
    music_volume: float = 0.06


@app.get("/podcast-episode/settings")
def get_podcast_settings_endpoint(user: str = Depends(verify_token)):
    from pipeline.podcast_pipeline import get_podcast_settings
    return get_podcast_settings()


@app.post("/podcast-episode/settings")
def save_podcast_settings_endpoint(req: PodcastSettings, user: str = Depends(verify_token)):
    from pipeline.podcast_pipeline import save_podcast_settings
    settings = {
        "enabled":      req.enabled,
        "days":         req.days,
        "topics":       req.topics,
        "hour":         req.hour,
        "music_style":  req.music_style,
    }
    save_podcast_settings(settings)
    return {"message": "Podcast settings saved", "settings": settings}


@app.post("/podcast-episode/trigger")
def trigger_auto_podcast(user: str = Depends(verify_token)):
    """Manually trigger one auto-generated podcast episode (picks next topic)."""
    import threading
    from pipeline.podcast_pipeline import (
        get_podcast_settings, _pick_next_podcast_topic, run_podcast_episode,
    )

    settings = get_podcast_settings()
    topics   = settings.get("topics", [])
    if not topics:
        raise HTTPException(status_code=400, detail="No topics configured in podcast settings")

    topic = _pick_next_podcast_topic(topics)
    music = settings.get("music_style", "ambient")

    record   = db.create_video(f"[Podcast] {topic}")
    video_id = record["id"]
    _register_pipeline(video_id)

    def _run():
        run_podcast_episode(
            topic=topic,
            music_style=music,
            video_id=video_id,
            push_log_fn=_push_log,
            unregister_fn=_unregister_pipeline,
        )

    threading.Thread(target=_run, daemon=True).start()
    return {"message": "Podcast episode started", "video_id": video_id, "topic": topic}


@app.post("/podcast-episode/generate")
def generate_podcast_episode(req: PodcastGenerateRequest, user: str = Depends(verify_token)):
    """
    Manually generate a podcast episode with a custom essay or topic.
    - Provide essay + title for direct TTS (skips LLM)
    - Provide topic for LLM essay generation
    """
    import threading
    from pipeline.podcast_pipeline import run_podcast_episode

    if not req.essay and not req.topic and not req.title:
        raise HTTPException(status_code=400, detail="Provide at least a topic or essay")

    prompt = req.topic or req.title or "Podcast Episode"
    record   = db.create_video(f"[Podcast] {prompt}")
    video_id = record["id"]
    _register_pipeline(video_id)

    def _run():
        run_podcast_episode(
            topic=req.topic,
            title=req.title,
            essay=req.essay,
            music_style=req.music_style,
            music_volume=req.music_volume,
            video_id=video_id,
            push_log_fn=_push_log,
            unregister_fn=_unregister_pipeline,
        )

    pos = _queue_pipeline(_run, job_id=video_id, job_type="podcast", prompt=req.topic or req.title or "")
    return {"message": "Podcast queued" if pos > 1 else "Podcast generation started", "video_id": video_id, "queue_position": pos}


@app.get("/billing")
def get_billing(user: str = Depends(verify_token)):
    """Aggregate billing/subscription info from all integrated services."""
    import os
    result = {}

    # ── ElevenLabs ────────────────────────────────────────────────────────────
    try:
        from elevenlabs.client import ElevenLabs as _EL
        el = _EL(api_key=os.getenv("ELEVENLABS_API_KEY", ""))
        sub = el.user.get_subscription()
        _next_reset_unix = getattr(sub, "next_character_count_reset_unix", None)
        _reset_date = None
        if _next_reset_unix:
            import datetime as _dt
            _reset_date = _dt.datetime.utcfromtimestamp(_next_reset_unix).strftime("%b %d, %Y")
        result["elevenlabs"] = {
            "tier":            getattr(sub, "tier", "unknown"),
            "chars_used":      getattr(sub, "character_count", 0),
            "chars_limit":     getattr(sub, "character_limit", 0),
            "chars_remaining": getattr(sub, "character_limit", 0) - getattr(sub, "character_count", 0),
            "percent_used":    round(getattr(sub, "character_count", 0) / max(getattr(sub, "character_limit", 1), 1) * 100, 1),
            "next_reset":      _next_reset_unix,
            "reset_date":      _reset_date,
            "voice_id":        config.ELEVENLABS_VOICE_ID[:8] + "…" if config.ELEVENLABS_VOICE_ID else "—",
            "status":          "ok",
        }
    except Exception as e:
        result["elevenlabs"] = {"status": "error", "error": str(e)}

    # ── YouTube / Google ──────────────────────────────────────────────────────
    try:
        yt_quota = check_quota_status()
        result["youtube"] = {
            "units_used_today": yt_quota.get("units_used", 0),
            "units_limit_day": 10000,
            "units_remaining": yt_quota.get("units_remaining", 10000),
            "uploads_today": yt_quota.get("uploads_today", 0),
            "uploads_remaining_today": yt_quota.get("uploads_remaining", 6),
            "upload_cost_units": 1600,
            "note": "YouTube Data API v3 — free tier 10,000 units/day",
            "status": "ok",
        }
    except Exception as e:
        result["youtube"] = {"status": "error", "error": str(e)}

    # ── Supabase ──────────────────────────────────────────────────────────────
    try:
        from supabase import create_client
        sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
        videos_count = len(sb.table("videos").select("id").execute().data)

        # Pro tier limits
        STORAGE_LIMIT_GB  = 100   # 100 GB included on Pro
        FILE_SIZE_LIMIT_GB = 5    # 5 GB max per file on Pro

        # Query actual storage usage by listing files in each bucket
        storage_bytes = 0
        bucket_stats  = {}
        for bucket_name in ["videos", "narrations"]:
            try:
                files = sb.storage.from_(bucket_name).list(options={"limit": 1000})
                if files and isinstance(files, list):
                    b_bytes = sum(
                        (f.get("metadata") or {}).get("size", 0)
                        for f in files if isinstance(f, dict)
                    )
                    b_count = len([
                        f for f in files
                        if isinstance(f, dict) and f.get("name") and not f.get("name", "").startswith(".")
                    ])
                    storage_bytes += b_bytes
                    bucket_stats[bucket_name] = {
                        "size_mb":    round(b_bytes / (1024 * 1024), 1),
                        "file_count": b_count,
                    }
            except Exception:
                bucket_stats[bucket_name] = {"size_mb": 0, "file_count": 0}

        storage_used_gb  = storage_bytes / (1024 ** 3)
        storage_percent  = round(storage_used_gb / STORAGE_LIMIT_GB * 100, 3)

        result["supabase"] = {
            "project_url":          config.SUPABASE_URL,
            "tier":                 "Pro",
            "videos_in_db":         videos_count,
            "storage_used_gb":      round(storage_used_gb, 3),
            "storage_used_mb":      round(storage_bytes / (1024 * 1024), 1),
            "storage_limit_gb":     STORAGE_LIMIT_GB,
            "storage_percent":      storage_percent,
            "file_size_limit_gb":   FILE_SIZE_LIMIT_GB,
            "videos_bucket_mb":     bucket_stats.get("videos",     {}).get("size_mb",    0),
            "videos_file_count":    bucket_stats.get("videos",     {}).get("file_count", 0),
            "narrations_bucket_mb": bucket_stats.get("narrations", {}).get("size_mb",    0),
            "narrations_file_count":bucket_stats.get("narrations", {}).get("file_count", 0),
            "note":                 "Supabase Pro — 100 GB Storage, 8 GB Database, 5 GB max file size",
            "status":               "ok",
        }
    except Exception as e:
        result["supabase"] = {"status": "error", "error": str(e)}

    # ── Groq ──────────────────────────────────────────────────────────────────
    groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    # Per-model rate limits (Groq free tier as of 2025)
    _groq_limits = {
        "llama-3.3-70b-versatile": {"ctx_k": 128, "req_min": 30, "tok_min": 6000,  "tok_day": 500000},
        "llama-3.1-70b-versatile": {"ctx_k": 128, "req_min": 30, "tok_min": 6000,  "tok_day": 500000},
        "llama-3.1-8b-instant":    {"ctx_k": 128, "req_min": 30, "tok_min": 20000, "tok_day": 500000},
        "mixtral-8x7b-32768":      {"ctx_k": 32,  "req_min": 30, "tok_min": 5000,  "tok_day": 500000},
        "gemma2-9b-it":            {"ctx_k": 8,   "req_min": 30, "tok_min": 15000, "tok_day": 500000},
    }
    _gl = _groq_limits.get(groq_model, {"ctx_k": 128, "req_min": 30, "tok_min": 6000, "tok_day": 500000})
    result["groq"] = {
        "model":        groq_model,
        "pricing":      "Free",
        "context_k":    _gl["ctx_k"],
        "req_per_min":  _gl["req_min"],
        "tok_per_min":  _gl["tok_min"],
        "tok_per_day":  _gl["tok_day"],
        "note":         f"Groq free tier — {_gl['tok_min']:,} tok/min, {_gl['tok_day']//1000}K tok/day",
        "status":       "ok",
    }

    # ── Pexels ────────────────────────────────────────────────────────────────
    pixabay_configured = bool(os.getenv("PIXABAY_API_KEY", ""))
    result["pexels"] = {
        "note":               "Pexels API — free, 200 requests/hour, 20,000/month",
        "status":             "ok",
        "pricing":            "Free",
        "rate_limit_hour":    200,
        "monthly_limit":      20000,
        "content_types":      "Videos, Photos",
        "pixabay_fallback":   pixabay_configured,
        "attribution":        "Required",
    }

    # ── Hetzner VPS ───────────────────────────────────────────────────────────
    hetzner_token = os.getenv("HETZNER_API_TOKEN", "")
    if hetzner_token:
        try:
            import urllib.request as _req
            import json as _json

            def _hetzner(path):
                r = _req.Request(
                    f"https://api.hetzner.cloud/v1{path}",
                    headers={"Authorization": f"Bearer {hetzner_token}"}
                )
                with _req.urlopen(r, timeout=8) as resp:
                    return _json.loads(resp.read())

            # Server info
            servers = _hetzner("/servers")["servers"]
            server  = next((s for s in servers if s.get("public_net", {}).get("ipv4", {}).get("ip") == "157.180.67.199"), servers[0] if servers else None)

            if server:
                st        = server.get("server_type", {})
                loc       = server.get("datacenter", {}).get("location", {})
                resources = server.get("resources", {})
                net       = server.get("public_net", {})

                # Billing — current month invoice estimate
                billing_data = {}
                try:
                    inv = _hetzner("/invoices?status=pending")
                    billing_data = inv.get("invoices", [{}])[0] if inv.get("invoices") else {}
                except Exception:
                    pass

                result["hetzner"] = {
                    "status":          "ok",
                    "server_name":     server.get("name", "—"),
                    "server_status":   server.get("status", "—"),       # running | off | restarting
                    "server_type":     st.get("name", "—"),             # cx22, cpx31 etc
                    "cpu_cores":       st.get("cores", "—"),
                    "ram_gb":          st.get("memory", "—"),
                    "disk_gb":         st.get("disk", "—"),
                    "disk_type":       st.get("storage_type", "—"),     # local / network
                    "location":        f"{loc.get('city','—')}, {loc.get('country','—')}",
                    "ipv4":            net.get("ipv4", {}).get("ip", "—"),
                    "monthly_cost":    f"€{st.get('prices', [{}])[0].get('price_monthly', {}).get('gross', '—')}",
                    "included_traffic_tb": st.get("included_traffic", 0) / 1e12 if st.get("included_traffic") else "—",
                    "outgoing_traffic_gb": round(server.get("outgoing_traffic", 0) / 1e9, 2),
                    "ingoing_traffic_gb":  round(server.get("ingoing_traffic", 0) / 1e9, 2),
                    "created":         server.get("created", "—")[:10],
                    "estimated_invoice": billing_data.get("amount_due", None),
                }
            else:
                result["hetzner"] = {"status": "error", "error": "No servers found on this account"}
        except Exception as e:
            result["hetzner"] = {"status": "error", "error": str(e)}
    else:
        result["hetzner"] = {"status": "no_token", "error": "Add HETZNER_API_TOKEN to .env"}

    return result


# ── Channel Management Routes ────────────────────────────────────────────────

# Simple in-process cache for channel videos — avoids burning quota on every tab open
_channel_videos_cache: dict = {"data": None, "fetched_at": 0}
CHANNEL_CACHE_TTL = 3600  # 1 hour

# ── Public stats cache ────────────────────────────────────────────────────────
_stats_cache: dict = {"data": None, "fetched_at": 0}
STATS_CACHE_TTL = 3600  # 1 hour


@app.get("/public/stats")
def get_public_stats():
    """Aggregated landing-page stats: total followers, episodes, comment count."""
    import time
    global _stats_cache
    age = time.time() - _stats_cache["fetched_at"]
    if _stats_cache["data"] is not None and age < STATS_CACHE_TTL:
        return _stats_cache["data"]

    result = {"followers": None, "episodes": None, "comments": None, "total_views": None, "total_likes": None}

    # ── YouTube subscriber count ──────────────────────────────────────────────
    try:
        from pipeline.youtube_uploader import get_authenticated_service
        svc = get_authenticated_service()
        ch = svc.channels().list(
            part="statistics", id=config.YOUTUBE_CHANNEL_ID
        ).execute()
        subs = int(ch["items"][0]["statistics"].get("subscriberCount", 0))
        result["followers"] = subs
    except Exception as e:
        print(f"⚠️  Stats: YouTube subscriber fetch failed: {e}")

    # ── Episode count + views/likes aggregates (all videos, no limit) ────────
    try:
        db_client = db.get_client()
        all_rows = db_client.table("videos").select("status,views_count,likes_count,narration_url,title").limit(5000).execute().data or []
        result["episodes"] = len([v for v in all_rows if v.get("narration_url") and v.get("title")])
        posted = [v for v in all_rows if v.get("status") == "posted"]
        result["total_views"] = sum(v.get("views_count") or 0 for v in posted)
        result["total_likes"] = sum(v.get("likes_count") or 0 for v in posted)
    except Exception as e:
        print(f"⚠️  Stats: episode count failed: {e}")

    # ── Approved comment count ────────────────────────────────────────────────
    try:
        db_client = db.get_client()
        r = db_client.table("blog_comments").select("id", count="exact").eq("status", "approved").execute()
        result["comments"] = r.count or 0
    except Exception as e:
        print(f"⚠️  Stats: comment count failed: {e}")

    _stats_cache["data"] = result
    _stats_cache["fetched_at"] = time.time()
    return result


class SubscribeRequest(BaseModel):
    email: str


@app.post("/public/subscribe")
def public_subscribe(req: SubscribeRequest):
    """Store an email subscription for new-content notifications."""
    import re
    em = req.email.strip().lower()
    if not em or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", em):
        raise HTTPException(status_code=422, detail="invalid_email")
    try:
        client = db.get_client()
        existing = (
            client.table("subscribers")
            .select("id")
            .eq("email", em)
            .execute()
        )
        if existing.data:
            raise HTTPException(status_code=409, detail="already_subscribed")
        client.table("subscribers").insert({"email": em}).execute()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"⚠️  Subscribe: {e}")
        raise HTTPException(status_code=500, detail="server_error")


@app.get("/public/channel-videos")
def get_public_channel_videos():
    """Public endpoint — returns cached public channel videos for the landing page.
    No auth required. Serves from the shared cache populated by the authed endpoint.
    Falls back to a fresh fetch if cache is empty.
    """
    import time
    global _channel_videos_cache
    age = time.time() - _channel_videos_cache["fetched_at"]
    if _channel_videos_cache["data"] is not None and age < CHANNEL_CACHE_TTL:
        data = _channel_videos_cache["data"]
        public_videos = [v for v in data.get("videos", []) if v.get("privacy") == "public"]
        return {"videos": public_videos[:12], "total": len(public_videos)}
    # Cache empty — do a fresh fetch (best-effort, no error thrown to public)
    try:
        from pipeline.youtube_uploader import get_authenticated_service
        service = get_authenticated_service()
        ch = service.channels().list(part="contentDetails", mine=True).execute()
        uploads_playlist = ch["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
        req = service.playlistItems().list(
            part="snippet,contentDetails", playlistId=uploads_playlist, maxResults=12)
        res = req.execute()
        video_ids = [i["contentDetails"]["videoId"] for i in res.get("items", [])]
        videos = []
        if video_ids:
            details = service.videos().list(
                part="snippet,statistics,status", id=",".join(video_ids)).execute()
            for item in details.get("items", []):
                sn = item["snippet"]
                st = item.get("statistics", {})
                status = item.get("status", {})
                if status.get("privacyStatus") != "public":
                    continue
                thumbnails = sn.get("thumbnails", {})
                thumb = (thumbnails.get("high") or thumbnails.get("medium") or thumbnails.get("default") or {}).get("url")
                videos.append({
                    "id": item["id"], "title": sn.get("title", ""),
                    "thumbnail": thumb, "published_at": sn.get("publishedAt"),
                    "views": int(st.get("viewCount", 0)),
                    "likes": int(st.get("likeCount", 0)),
                    "comments": int(st.get("commentCount", 0)),
                })
        _channel_videos_cache["data"] = {"videos": videos, "total": len(videos)}
        _channel_videos_cache["fetched_at"] = time.time()
        return {"videos": videos, "total": len(videos)}
    except Exception as e:
        print(f"⚠️  Public channel videos fetch failed: {e}")
        return {"videos": [], "total": 0, "error": str(e)}


@app.get("/channel/videos")
def get_channel_videos(refresh: bool = False, user: str = Depends(verify_token)):
    """Fetch all videos from the authenticated YouTube channel.
    Cached for 1 hour to avoid burning API quota on every page load.
    Pass ?refresh=true to force a fresh fetch.
    """
    import time
    global _channel_videos_cache

    # Serve cache if fresh and not forcing refresh
    age = time.time() - _channel_videos_cache["fetched_at"]
    if not refresh and _channel_videos_cache["data"] is not None and age < CHANNEL_CACHE_TTL:
        print(f"📦 Channel videos cache hit (age: {int(age)}s)")
        return _channel_videos_cache["data"]

    from pipeline.youtube_uploader import get_authenticated_service
    try:
        service = get_authenticated_service()
        # Get uploads playlist ID
        ch = service.channels().list(part="contentDetails", mine=True).execute()
        uploads_playlist = ch["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]

        videos = []
        next_page = None
        while True:
            req = service.playlistItems().list(
                part="snippet,contentDetails",
                playlistId=uploads_playlist,
                maxResults=50,
                pageToken=next_page,
            )
            res = req.execute()
            video_ids = [i["contentDetails"]["videoId"] for i in res.get("items", [])]

            if video_ids:
                details = service.videos().list(
                    part="snippet,statistics,status,contentDetails",
                    id=",".join(video_ids)
                ).execute()

                for item in details.get("items", []):
                    sn = item["snippet"]
                    st = item.get("statistics", {})
                    status = item.get("status", {})
                    cd = item.get("contentDetails", {})
                    dur = cd.get("duration", "")
                    import re
                    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', dur)
                    if m:
                        h, mi, s = m.groups()
                        parts = []
                        if h:  parts.append(f"{h}h")
                        if mi: parts.append(f"{mi}m")
                        if s:  parts.append(f"{s}s")
                        dur = " ".join(parts)

                    thumbnails = sn.get("thumbnails", {})
                    thumb = (thumbnails.get("high") or thumbnails.get("medium") or thumbnails.get("default") or {}).get("url")

                    videos.append({
                        "id":           item["id"],
                        "title":        sn.get("title", ""),
                        "description":  sn.get("description", ""),
                        "thumbnail":    thumb,
                        "published_at": sn.get("publishedAt"),
                        "privacy":      status.get("privacyStatus", "unknown"),
                        "views":        int(st.get("viewCount", 0)),
                        "likes":        int(st.get("likeCount", 0)),
                        "comments":     int(st.get("commentCount", 0)),
                        "duration":     dur,
                    })

            next_page = res.get("nextPageToken")
            if not next_page:
                break

        result = {"videos": videos, "total": len(videos)}
        _channel_videos_cache["data"] = result
        _channel_videos_cache["fetched_at"] = time.time()
        print(f"📡 Channel videos cached ({len(videos)} videos)")
        return result

    except Exception as e:
        err = str(e).lower()
        if "quota" in err or "403" in err:
            print(f"⚠️  YouTube quota exceeded on /channel/videos")
            if _channel_videos_cache["data"] is not None:
                print("   Serving stale cached data")
                return _channel_videos_cache["data"]
            raise HTTPException(
                status_code=429,
                detail="YouTube API quota exceeded. Resets at midnight Pacific Time. Try again later."
            )
        if _channel_videos_cache["data"] is not None:
            print(f"⚠️  YouTube API error, serving stale cache: {e}")
            return _channel_videos_cache["data"]
        raise


@app.post("/channel/videos/{video_id}/privacy")
def set_video_privacy(video_id: str, body: dict, user: str = Depends(verify_token)):
    """Set privacy status of a YouTube video: public, private, or unlisted."""
    from pipeline.youtube_uploader import get_authenticated_service
    privacy = body.get("privacy", "private")
    if privacy not in ("public", "private", "unlisted"):
        raise HTTPException(status_code=400, detail="privacy must be public, private, or unlisted")
    service = get_authenticated_service()
    service.videos().update(
        part="status",
        body={"id": video_id, "status": {"privacyStatus": privacy}}
    ).execute()
    return {"message": f"Video set to {privacy}", "video_id": video_id}


@app.delete("/channel/videos/{video_id}")
def delete_channel_video(video_id: str, user: str = Depends(verify_token)):
    """Permanently delete a video from YouTube channel."""
    from pipeline.youtube_uploader import get_authenticated_service
    service = get_authenticated_service()
    service.videos().delete(id=video_id).execute()
    # Also update DB if we have it
    try:
        from database import update_video
        # find video by youtube_id
        sb = db.get_client()
        rows = sb.table("videos").select("id").eq("youtube_id", video_id).execute().data
        if rows:
            update_video(rows[0]["id"], status="ready", youtube_id=None, youtube_url=None)
    except Exception:
        pass
    return {"message": "Deleted from YouTube", "video_id": video_id}


# ── Startup ───────────────────────────────────────────────────────────────────



@app.post("/videos/{video_id}/create-short")
def create_short(video_id: str, background_tasks: BackgroundTasks, user: str = Depends(verify_token)):
    """Clip the best 60s from an existing video and save as a YouTube Short."""
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not video.get("file_path"):
        raise HTTPException(status_code=400, detail="No video file available")

    # Use source video_id as the log key so frontend can poll /videos/{video_id}/logs
    _register_pipeline(video_id)

    def do_short():
        try:
            _push_log(video_id, "[1/4] Downloading source video...")
            from pipeline.shorts_generator import create_short_from_video
            short_path = create_short_from_video(video["file_path"], video_id + "_short")
            _push_log(video_id, "[2/4] Short clip created — uploading to storage...")
            from pipeline.storage import upload_to_storage
            short_id = video_id + "_short"
            storage_url = upload_to_storage(short_path, short_id)
            _push_log(video_id, "[3/4] Saving to database...")
            import uuid
            short_record_id = str(uuid.uuid4())
            db.get_client().table("videos").insert({
                "id": short_record_id,
                "prompt": f"[Short clip of: {video.get('title',video_id)}]",
                "title": f"#Shorts {(video.get('title') or 'AutoVid')[:85]}",
                "description": (video.get("description") or "") + "\n\n#Shorts #AutoVid #AI",
                "status": "ready",
                "labels": (video.get("labels") or []) + ["short", "Shorts", "AI"],
                "file_path": storage_url,
                "resolution": "1080x1920",
            }).execute()
            import os
            if os.path.exists(short_path):
                os.unlink(short_path)
            # Mark source video so it won't be used again
            current_labels = video.get("labels") or []
            if "used_for_short" not in current_labels:
                db.update_video(video_id, labels=current_labels + ["used_for_short"])
            _push_log(video_id, "[4/4] Done — short is ready.")
            _push_log(video_id, "__DONE__")
            print(f"✅ Short saved to Supabase: {storage_url}")
        except Exception as e:
            _push_log(video_id, f"[ERROR] {e}")
            _push_log(video_id, "__DONE__")
            print(f"❌ Short creation failed: {e}")
            import traceback; traceback.print_exc()
        finally:
            _unregister_pipeline(video_id)

    pos = _queue_pipeline(do_short, job_id=video_id, job_type="short_clip", prompt=video.get("title") or video.get("prompt") or "")
    return {"message": "Short creation queued" if pos > 1 else "Short creation started", "video_id": video_id, "queue_position": pos}


@app.post("/shorts/generate")
def generate_short(background_tasks: BackgroundTasks, body: dict, user: str = Depends(verify_token)):
    """Generate a brand-new YouTube Short from scratch (portrait 9:16)."""
    prompt           = body.get("prompt", "")
    ambience         = body.get("ambience", "rain")
    music_style      = body.get("music_style", "Laidback_Fevorite")
    music_volume     = float(body.get("music_volume", 0.04))
    custom_script    = body.get("custom_script", "").strip() if body.get("custom_script") else ""
    use_stickfigures = bool(body.get("use_stickfigures", False))
    if not prompt and not custom_script:
        raise HTTPException(status_code=400, detail="Prompt or custom_script required")

    # Duplicate check — only for prompt-based generation (not custom scripts)
    if prompt and not custom_script:
        existing = db.get_client().table("videos").select("id, status") \
            .ilike("title", f"[Short] {prompt}").limit(1).execute().data
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"A short with this prompt already exists (id: {existing[0]['id']}, status: {existing[0]['status']}). Edit the prompt to make it unique."
            )

    label = prompt or "Custom Script"
    record   = db.create_video(f"[Short] {label[:100]}")
    video_id = record["id"]
    _register_pipeline(video_id)

    def _cb(info):
        step = info.get("step", "?") if isinstance(info, dict) else str(info)
        msg  = info.get("message", "") if isinstance(info, dict) else ""
        _push_log(video_id, f"[{step}] {msg}")

    def _run():
        try:
            from pipeline.orchestrator import run_short_pipeline as _short_pipeline
            _short_pipeline(prompt=label, ambience=ambience, video_id=video_id, cb=_cb, music_style=music_style, music_volume=music_volume, custom_script=custom_script or None, use_stickfigures=use_stickfigures)
            _push_log(video_id, "[DONE] Short pipeline finished — ready for review")
        except Exception as e:
            _push_log(video_id, f"[ERROR] {e}")
            print(f"❌ Short pipeline failed: {e}")
        finally:
            _unregister_pipeline(video_id)

    pos = _queue_pipeline(_run, job_id=video_id, job_type="short", prompt=label)
    return {"message": "Short pipeline queued" if pos > 1 else "Short pipeline started", "video_id": video_id, "queue_position": pos}


@app.get("/shorts")
def list_shorts(
    limit: int = 25,
    offset: int = 0,
    user: str = Depends(verify_token),
):
    """List all videos tagged as Shorts."""
    try:
        client = db.get_client()
        # Fetch both "short" and "Shorts" labeled videos
        result = (
            client.table("videos")
            .select("*")
            .or_("labels.cs.{short},labels.cs.{Shorts}")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or []
    except Exception as e:
        print(f"❌ list_shorts error: {e}")
        return []


@app.post("/cache/clear")
def clear_cache(user: str = Depends(verify_token)):
    """Signal that clients should clear their local cache."""
    return {"cleared": True, "message": "Cache cleared — refresh to load fresh data"}


# Auto-reply toggle — loaded from DB on startup so it survives restarts
# ── Pipeline registry — active pipelines for cancel + log streaming ──────────
_active_pipelines: dict = {}
_pipeline_lock = _threading.Lock()

# ── Serial pipeline queue ─────────────────────────────────────────────────────
# max_workers=1 means only ONE pipeline runs at a time across ALL job types
# (video, short, podcast, compilation, script-studio).  Additional submissions
# are queued by the executor and started automatically when the current job
# finishes.  Log streaming still works because all jobs run in-process.
_pipeline_executor = _ThreadPoolExecutor(max_workers=1, thread_name_prefix="pipeline")

# ── Job history (in-memory, resets at midnight UTC) ───────────────────────────
from datetime import datetime as _datetime, timezone as _tz

_job_history: dict = {"date": None, "hourly": {}, "jobs": []}
_job_history_lock = _threading.Lock()

def _today_utc() -> str:
    return _datetime.now(_tz.utc).strftime("%Y-%m-%d")

def _ensure_history_reset():
    today = _today_utc()
    with _job_history_lock:
        if _job_history["date"] != today:
            _job_history["date"]   = today
            _job_history["hourly"] = {str(h): {"done": 0, "failed": 0} for h in range(24)}
            _job_history["jobs"]   = []

def _record_job(job_id: str, job_type: str, prompt: str, started_at: float, status: str):
    """Record a completed/failed job into the daily history."""
    _ensure_history_reset()
    now   = _datetime.now(_tz.utc)
    hour  = str(now.hour)
    key   = "done" if status == "done" else "failed"
    dur   = round(time.time() - started_at)
    with _job_history_lock:
        _job_history["hourly"][hour][key] += 1
        _job_history["jobs"].insert(0, {
            "id":         job_id,
            "type":       job_type,
            "prompt":     (prompt or "")[:60],
            "started_at": started_at,
            "ended_at":   time.time(),
            "duration_s": dur,
            "status":     status,
            "hour":       int(hour),
        })
        _job_history["jobs"] = _job_history["jobs"][:200]  # keep last 200

def _queue_pipeline(fn, job_id: str = None, job_type: str = "job", prompt: str = "") -> int:
    """Submit fn to the serial executor.  Returns approximate queue position (1 = next/running).
    Wraps fn so job completion is automatically recorded in history."""
    _ensure_history_reset()
    started_at = time.time()

    def _tracked():
        status = "failed"
        try:
            fn()
            status = "done"
        except Exception:
            status = "failed"
            raise
        finally:
            if job_id:
                _record_job(job_id, job_type, prompt, started_at, status)

    pending = _pipeline_executor._work_queue.qsize()
    _pipeline_executor.submit(_tracked)
    return pending + 1   # position: 1 = will start as soon as current finishes

def _register_pipeline(video_id: str, log_q=None):
    with _pipeline_lock:
        _active_pipelines[video_id] = {"log_buffer": [], "cancelled": False, "done": False}

def _unregister_pipeline(video_id: str):
    """Mark pipeline as done — keep buffer for 5 min so frontend can still read logs."""
    with _pipeline_lock:
        entry = _active_pipelines.get(video_id)
        if entry:
            entry["done"] = True
    # Clean up after 5 minutes
    def _cleanup():
        time.sleep(300)
        with _pipeline_lock:
            _active_pipelines.pop(video_id, None)
    _threading.Thread(target=_cleanup, daemon=True).start()

def _is_cancelled(video_id: str) -> bool:
    with _pipeline_lock:
        return _active_pipelines.get(video_id, {}).get("cancelled", False)

def _push_log(video_id: str, msg: str):
    with _pipeline_lock:
        entry = _active_pipelines.get(video_id)
        if entry is not None:
            entry.setdefault("log_buffer", []).append(msg)
            if len(entry["log_buffer"]) > 500:   # cap at 500 lines
                entry["log_buffer"] = entry["log_buffer"][-500:]


def _get_auto_reply_enabled() -> bool:
    try:
        val = db.get_setting("auto_reply_enabled", default="true")
        return str(val).lower() not in ("false", "0", "no")
    except Exception:
        return True  # safe default if DB unavailable

def _set_auto_reply_enabled(enabled: bool):
    try:
        db.set_setting("auto_reply_enabled", str(enabled).lower())
    except Exception as e:
        print(f"⚠️  Could not persist auto_reply_enabled: {e}")

_auto_reply_enabled = _get_auto_reply_enabled()


@app.get("/auto-reply/status")
def get_auto_reply_status(user: str = Depends(verify_token)):
    """Get auto-reply enabled state and backoff status."""
    from pipeline.auto_replier import _quota_exceeded_until, _quota_backed_off
    import time
    backed_off = _quota_backed_off()
    resume_in_h = max(0, int((_quota_exceeded_until - time.time()) / 3600)) if backed_off else 0
    return {
        "enabled": _get_auto_reply_enabled(),   # always read live from DB
        "quota_backed_off": backed_off,
        "resume_in_hours": resume_in_h,
    }


@app.post("/auto-reply/toggle")
def toggle_auto_reply(body: dict, user: str = Depends(verify_token)):
    """Enable or disable auto-reply. Persisted to DB — survives restarts."""
    global _auto_reply_enabled
    enabled = bool(body.get("enabled", True))
    _auto_reply_enabled = enabled
    _set_auto_reply_enabled(enabled)   # persist to Supabase
    state = "enabled" if enabled else "disabled"
    print(f"💬 Auto-reply {state} by user — saved to DB")
    return {"enabled": enabled, "message": f"Auto-reply {state}"}


@app.post("/auto-reply/trigger")
def trigger_auto_reply(user: str = Depends(verify_token)):
    """Manually trigger one auto-reply cycle."""
    from pipeline.auto_replier import run_reply_cycle
    run_reply_cycle()
    return {"message": "Auto-reply cycle triggered"}


def _start_pipeline_watchdog():
    """Kills any pipeline stuck for >90 min — runs as daemon thread."""
    import threading
    def _watch():
        while True:
            time.sleep(120)
            try:
                with _pipeline_lock:
                    ids = list(_active_pipelines.keys())
                for vid in ids:
                    try:
                        video = db.get_video(vid)
                    except Exception:
                        continue
                    if not video:
                        _unregister_pipeline(vid)
                        continue
                    # Check age via updated_at or created_at
                    import datetime
                    ts_str = video.get("updated_at") or video.get("created_at")
                    if ts_str:
                        try:
                            ts = datetime.datetime.fromisoformat(ts_str.replace("Z","+00:00"))
                            age_mins = (datetime.datetime.now(datetime.timezone.utc) - ts).total_seconds() / 60
                            if age_mins > 90:
                                print(f"⏰ Watchdog: {vid[:8]} stuck {age_mins:.0f}min — cancelling")
                                with _pipeline_lock:
                                    entry = _active_pipelines.get(vid)
                                    if entry: entry["cancelled"] = True
                                _push_log(vid, "[ERROR] Watchdog: pipeline timed out (90 min limit)")
                                db.set_failed(vid, "Timed out — cancelled by watchdog after 90 minutes")
                                _unregister_pipeline(vid)
                        except Exception:
                            pass
            except Exception as e:
                print(f"Watchdog error: {e}")
    threading.Thread(target=_watch, daemon=True).start()


@app.on_event("startup")
def startup():
    print("🚀 AutoVid API starting...")
    _start_pipeline_watchdog()

    # ── Recover stuck videos ──────────────────────────────────────────────────
    # Only fail videos stuck in an in-progress status for more than 30 minutes.
    # This avoids nuking a video that just started when the server restarts.
    try:
        from datetime import datetime, timezone, timedelta
        STUCK_THRESHOLD = timedelta(minutes=30)
        stuck_statuses  = ["scripted", "voiced", "assembled", "captioned", "labeled"]
        now             = datetime.now(timezone.utc)
        recovered       = 0
        for status in stuck_statuses:
            for v in db.list_videos(status=status):
                created_raw = v.get("created_at", "")
                try:
                    created = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
                    age     = now - created
                    if age < STUCK_THRESHOLD:
                        continue  # still young — give it time
                except Exception:
                    pass  # can't parse timestamp — fail it to be safe
                db.set_failed(v["id"], f"Pipeline interrupted — server restarted mid-run (was: {status}). Please retry.")
                recovered += 1
        if recovered:
            print(f"⚠️  Recovered {recovered} stuck video(s) older than 30min — marked failed so they can be retried")
        else:
            print("✅ No stuck videos found at startup")
    except Exception as e:
        print(f"⚠️  Startup recovery check failed: {e}")

    try:
        config.validate()
    except EnvironmentError as e:
        print(f"⚠️  Config warning: {e}")
    # Auto-reply scheduler
    try:
        from pipeline.auto_replier import start_reply_scheduler
        start_reply_scheduler()
    except Exception as e:
        print(f"⚠️  Auto-reply scheduler failed to start: {e}")

    # Auto-generator scheduler
    try:
        from pipeline.auto_generator import start_auto_scheduler
        start_auto_scheduler()
    except Exception as e:
        print(f"⚠️  Auto-generator scheduler failed to start: {e}")

    # Auto-short scheduler
    try:
        from pipeline.auto_generator import start_auto_short_scheduler
        start_auto_short_scheduler()
    except Exception as e:
        print(f"⚠️  Auto-short scheduler failed to start: {e}")

    # Auto-podcast scheduler
    try:
        from pipeline.podcast_pipeline import start_podcast_scheduler
        start_podcast_scheduler()
    except Exception as e:
        print(f"⚠️  Auto-podcast scheduler failed to start: {e}")

    # Output sweeper — deletes stale files older than 1 hour
    try:
        from pipeline.orchestrator import start_output_sweeper
        start_output_sweeper()
    except Exception as e:
        print(f"⚠️  Output sweeper failed to start: {e}")

    print("✅ AutoVid API ready → http://localhost:8000")
    print("   Docs: http://localhost:8000/docs")



# ── Compilations ──────────────────────────────────────────────────────────────

class CompilationClip(BaseModel):
    video_id:  str
    file_path: str
    title:     Optional[str] = ""
    start:     Optional[float] = 0.0
    end:       Optional[float] = None   # None = use full clip
    narration_url: Optional[str] = None

class CompilationRequest(BaseModel):
    title: str
    clips: list[CompilationClip]
    mode: str = "video"   # "video" | "mp3"


@app.get("/compilations")
def list_compilations(user: str = Depends(verify_token)):
    """List all compilation videos."""
    return db.list_compilations()


@app.post("/compilations/create")
def create_compilation(
    req: CompilationRequest,
    background_tasks: BackgroundTasks,
    user: str = Depends(verify_token),
):
    """Start a compilation pipeline. Returns immediately."""
    if len(req.clips) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 clips")
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")

    source_ids = [c.video_id for c in req.clips]
    record     = db.create_compilation(req.title, source_ids)
    comp_id    = record["id"]

    clips_data = [c.dict() for c in req.clips]
    _register_pipeline(comp_id)

    def _cb(info):
        step = info.get("step", "?") if isinstance(info, dict) else str(info)
        msg  = info.get("message", "") if isinstance(info, dict) else ""
        _push_log(comp_id, f"[{step}] {msg}")

    def run():
        try:
            if req.mode == "mp3":
                from pipeline.compiler import create_mp3_compilation as _compile_mp3
                _compile_mp3(compilation_id=comp_id, clips=clips_data, title=req.title, cb=_cb)
            else:
                from pipeline.compiler import create_compilation as _compile
                _compile(compilation_id=comp_id, clips=clips_data, title=req.title, cb=_cb)
            _push_log(comp_id, "[DONE] Compilation finished")
        except Exception as e:
            _push_log(comp_id, f"[ERROR] {e}")
            print(f"❌ Compilation pipeline error: {e}")
        finally:
            _unregister_pipeline(comp_id)

    pos = _queue_pipeline(run, job_id=comp_id, job_type="compilation", prompt=req.title)
    return {"compilation_id": comp_id, "message": "Compilation queued" if pos > 1 else "Compilation started", "clip_count": len(req.clips), "queue_position": pos}

# ── TikTok OAuth + Upload ──────────────────────────────────────────────────────

@app.get("/tiktok/auth")
def tiktok_auth():
    """Redirect user to TikTok OAuth consent page."""
    from pipeline.tiktok_uploader import build_auth_url
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=build_auth_url())

@app.get("/tiktok/callback")
def tiktok_callback(code: str = None, error: str = None, error_description: str = None):
    """TikTok redirects here after user approves. Exchange code for tokens."""
    from fastapi.responses import HTMLResponse
    if error:
        return HTMLResponse(f"""
        <html><body style="background:#08080f;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center"><h2>TikTok Auth Failed</h2><p>{error_description or error}</p>
        <a href="https://4lifemystery.com/dashboard" style="color:#00a0dc">Back to dashboard</a></div></body></html>
        """)
    try:
        from pipeline.tiktok_uploader import exchange_code
        exchange_code(code)
        return HTMLResponse("""
        <html><body style="background:#08080f;color:#4ade80;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center"><h2>✅ TikTok Connected!</h2><p>You can close this tab.</p>
        <a href="https://4lifemystery.com/dashboard" style="color:#00a0dc">Back to dashboard</a></div></body></html>
        """)
    except Exception as e:
        return HTMLResponse(f"""
        <html><body style="background:#08080f;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center"><h2>TikTok Auth Error</h2><p>{e}</p>
        <a href="https://4lifemystery.com/dashboard" style="color:#00a0dc">Back to dashboard</a></div></body></html>
        """)

@app.get("/tiktok/status")
def tiktok_status(user: str = Depends(verify_token)):
    """Check if TikTok is connected (cached 30 s)."""
    def _check():
        from pipeline.tiktok_uploader import load_token
        token = load_token()
        return {"connected": token is not None, "open_id": token.get("open_id") if token else None}
    return _cached_status("tiktok_status", _check)

@app.post("/tiktok/disconnect")
def tiktok_disconnect(user: str = Depends(verify_token)):
    from pipeline.tiktok_uploader import disconnect
    disconnect()
    return {"message": "TikTok disconnected"}

# ── Spotify OAuth ──────────────────────────────────────────────────────────────

@app.get("/spotify/connect")
def spotify_connect(user: str = Depends(verify_token)):
    """Return the Spotify authorization URL for the frontend to redirect to."""
    from pipeline.spotify_client import get_auth_url
    return {"url": get_auth_url()}

@app.get("/spotify/callback")
def spotify_callback(code: str = None, error: str = None):
    """Spotify redirects here after user approval. Exchange code for tokens."""
    from fastapi.responses import HTMLResponse
    if error:
        return HTMLResponse(f"""
        <html><body style="background:#08080f;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center"><h2>Spotify Auth Failed</h2><p>{error}</p>
        <a href="https://4lifemystery.com/dashboard" style="color:#1db954">Back to dashboard</a></div></body></html>
        """)
    try:
        from pipeline.spotify_client import exchange_code
        exchange_code(code)
        return HTMLResponse("""
        <html><body style="background:#08080f;color:#1db954;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center"><h2>✅ Spotify Connected!</h2><p>You can close this tab and return to the dashboard.</p>
        <a href="https://4lifemystery.com/dashboard" style="color:#1db954">Back to dashboard</a></div></body></html>
        """)
    except Exception as e:
        return HTMLResponse(f"""
        <html><body style="background:#08080f;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center"><h2>Spotify Auth Error</h2><p>{e}</p>
        <a href="https://4lifemystery.com/dashboard" style="color:#1db954">Back to dashboard</a></div></body></html>
        """)

@app.get("/spotify/status")
def spotify_status(user: str = Depends(verify_token)):
    """Check Spotify connection (cached 30 s)."""
    def _check():
        from pipeline.spotify_client import load_token, get_profile
        token = load_token()
        if not token:
            return {"connected": False}
        try:
            profile = get_profile()
            return {
                "connected":    True,
                "display_name": profile.get("display_name"),
                "email":        profile.get("email"),
                "country":      profile.get("country"),
                "followers":    profile.get("followers", {}).get("total"),
                "image":        (profile.get("images") or [{}])[0].get("url"),
            }
        except Exception:
            return {"connected": True, "display_name": None}
    return _cached_status("spotify_status", _check)

@app.post("/spotify/disconnect")
def spotify_disconnect(user: str = Depends(verify_token)):
    from pipeline.spotify_client import disconnect
    disconnect()
    return {"message": "Spotify disconnected"}

@app.get("/spotify/top-tracks")
def spotify_top_tracks(limit: int = 10, time_range: str = "long_term", user: str = Depends(verify_token)):
    from pipeline.spotify_client import get_top_tracks, is_connected
    if not is_connected():
        return []
    try:
        tracks = get_top_tracks(limit=limit, time_range=time_range)
        return [{"name": t["name"], "artists": [a["name"] for a in t["artists"]], "popularity": t.get("popularity"), "preview_url": t.get("preview_url")} for t in tracks]
    except Exception as e:
        print(f"⚠️  Spotify top-tracks: {e}")
        return []

@app.get("/spotify/top-artists")
def spotify_top_artists(limit: int = 10, time_range: str = "long_term", user: str = Depends(verify_token)):
    from pipeline.spotify_client import get_top_artists, is_connected
    if not is_connected():
        return []
    try:
        artists = get_top_artists(limit=limit, time_range=time_range)
        return [{"name": a["name"], "genres": a.get("genres", []), "followers": a.get("followers", {}).get("total"), "popularity": a.get("popularity")} for a in artists]
    except Exception as e:
        print(f"⚠️  Spotify top-artists: {e}")
        return []

# ── Buzzsprout ────────────────────────────────────────────────────────────────

@app.get("/buzzsprout/settings")
def get_buzzsprout_settings_endpoint(user: str = Depends(verify_token)):
    """Return current Buzzsprout settings (token masked for display)."""
    from pipeline.buzzsprout_client import get_buzzsprout_settings
    s = get_buzzsprout_settings()
    masked = ("*" * (len(s["api_token"]) - 4) + s["api_token"][-4:]) if len(s.get("api_token","")) > 4 else s.get("api_token","")
    return {**s, "api_token": masked, "api_token_set": bool(s.get("api_token"))}


@app.post("/buzzsprout/settings")
def save_buzzsprout_settings_endpoint(body: dict, user: str = Depends(verify_token)):
    """Save Buzzsprout API token, podcast ID, and auto-upload preference."""
    from pipeline.buzzsprout_client import save_buzzsprout_settings, get_buzzsprout_settings
    current = get_buzzsprout_settings()
    api_token = body.get("api_token", "")
    if api_token.startswith("*"):
        api_token = current.get("api_token", "")
    save_buzzsprout_settings({
        "api_token":   api_token,
        "podcast_id":  body.get("podcast_id",  current.get("podcast_id",  "")),
        "auto_upload": body.get("auto_upload",  current.get("auto_upload", False)),
    })
    _invalidate_cache("buzzsprout_status")
    return {"message": "Buzzsprout settings saved"}


@app.get("/buzzsprout/status")
def buzzsprout_status(user: str = Depends(verify_token)):
    """Check Buzzsprout connection (cached 30 s to avoid blocking worker threads)."""
    def _check():
        from pipeline.buzzsprout_client import get_buzzsprout_settings, get_podcast_info, list_episodes, is_configured
        s = get_buzzsprout_settings()
        if not is_configured():
            return {"connected": False}
        try:
            info     = get_podcast_info(s["api_token"], s["podcast_id"])
            episodes = list_episodes(s["api_token"], s["podcast_id"], limit=5)
            return {
                "connected":     True,
                "podcast_id":    s["podcast_id"],
                "auto_upload":   s["auto_upload"],
                "title":         info.get("title", ""),
                "image_url":     info.get("image_url", ""),
                "episode_count": info.get("episodes_count", len(episodes)),
                "recent_episodes": [
                    {"id": e["id"], "title": e.get("title", ""), "published_at": e.get("published_at"),
                     "duration": e.get("duration"), "url": f"https://www.buzzsprout.com/{s['podcast_id']}/episodes/{e['id']}"}
                    for e in episodes
                ],
            }
        except Exception as e:
            return {"connected": False, "error": str(e)}
    return _cached_status("buzzsprout_status", _check)


@app.post("/podcast-episode/{video_id}/upload-buzzsprout")
def upload_episode_to_buzzsprout(video_id: str, background_tasks: BackgroundTasks, user: str = Depends(verify_token)):
    """Manually push a podcast episode to Buzzsprout."""
    from pipeline.buzzsprout_client import is_configured, upload_podcast_episode
    if not is_configured():
        raise HTTPException(status_code=400, detail="Buzzsprout not configured — add credentials in Settings")
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not video.get("narration_url"):
        raise HTTPException(status_code=400, detail="No audio file available for this episode")
    if video.get("buzzsprout_episode_id"):
        raise HTTPException(status_code=409, detail=f"Already on Buzzsprout (episode {video['buzzsprout_episode_id']})")

    def do_upload():
        try:
            _push_log(video_id, "[BUZZSPROUT] Starting upload to Buzzsprout...")
            upload_podcast_episode(video_id, log_fn=lambda m: _push_log(video_id, m))
            _push_log(video_id, "[BUZZSPROUT] ✅ Upload complete — processing on Buzzsprout")
        except Exception as e:
            _push_log(video_id, f"[BUZZSPROUT] ❌ Upload failed: {e}")

    background_tasks.add_task(do_upload)
    return {"message": "Buzzsprout upload started", "video_id": video_id}


# ── Podbean ────────────────────────────────────────────────────────────────────

@app.get("/podbean/settings")
def get_podbean_settings_endpoint(user: str = Depends(verify_token)):
    from pipeline.podbean_client import get_podbean_settings
    s = get_podbean_settings()
    masked_secret = ("*" * (len(s["client_secret"]) - 4) + s["client_secret"][-4:]) if len(s.get("client_secret","")) > 4 else s.get("client_secret","")
    return {**s, "client_secret": masked_secret, "client_secret_set": bool(s.get("client_secret"))}


@app.post("/podbean/settings")
def save_podbean_settings_endpoint(body: dict, user: str = Depends(verify_token)):
    from pipeline.podbean_client import save_podbean_settings, get_podbean_settings
    current = get_podbean_settings()
    client_secret = body.get("client_secret", "")
    if client_secret.startswith("*"):
        client_secret = current.get("client_secret", "")
    save_podbean_settings({
        "client_id":     body.get("client_id",     current.get("client_id",     "")),
        "client_secret": client_secret,
        "auto_upload":   body.get("auto_upload",   current.get("auto_upload",   False)),
    })
    _invalidate_cache("podbean_status")
    return {"message": "Podbean settings saved"}


@app.get("/podbean/status")
def podbean_status(user: str = Depends(verify_token)):
    """Check Podbean connection (cached 30 s to avoid blocking worker threads)."""
    def _check():
        from pipeline.podbean_client import get_podbean_settings, get_podcast_info, list_episodes, is_configured
        s = get_podbean_settings()
        if not is_configured():
            return {"connected": False}
        try:
            info     = get_podcast_info(s["client_id"], s["client_secret"])
            episodes = list_episodes(s["client_id"], s["client_secret"], limit=5)
            return {
                "connected":        True,
                "auto_upload":      s["auto_upload"],
                "title":            info.get("title", ""),
                "image":            info.get("logo_url", ""),
                "subscriber_count": info.get("subscriber_count", 0),
                "episode_count":    info.get("total_count", len(episodes)),
                "recent_episodes": [
                    {"id": e.get("id",""), "title": e.get("title",""),
                     "published_at": e.get("publish_time",""), "duration": e.get("duration",0),
                     "player_url": e.get("player_url","")}
                    for e in episodes
                ],
            }
        except Exception as e:
            return {"connected": False, "error": str(e)}
    return _cached_status("podbean_status", _check)


@app.post("/podcast-episode/{video_id}/upload-podbean")
def upload_episode_to_podbean(video_id: str, background_tasks: BackgroundTasks, user: str = Depends(verify_token)):
    """Manually push a podcast episode to Podbean."""
    from pipeline.podbean_client import is_configured, upload_podcast_episode
    if not is_configured():
        raise HTTPException(status_code=400, detail="Podbean not configured — add credentials in Settings")
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not video.get("narration_url"):
        raise HTTPException(status_code=400, detail="No audio file available")
    if video.get("podbean_episode_id"):
        raise HTTPException(status_code=409, detail=f"Already on Podbean (episode {video['podbean_episode_id']})")

    def do_upload():
        try:
            _push_log(video_id, "[PODBEAN] Starting upload to Podbean...")
            upload_podcast_episode(video_id, log_fn=lambda m: _push_log(video_id, m))
            _push_log(video_id, "[PODBEAN] ✅ Episode published — distributing to Spotify, Apple Podcasts & more")
        except Exception as e:
            _push_log(video_id, f"[PODBEAN] ❌ Upload failed: {e}")

    background_tasks.add_task(do_upload)
    return {"message": "Podbean upload started", "video_id": video_id}


# ── Subscriptions / Expenditure Tracker ──────────────────────────────────────

def _parse_expenditures_file() -> list:
    """Parse backend/embeds/expeditures.txt into a subscription list."""
    import re, os
    path = os.path.join(os.path.dirname(__file__), "embeds", "expeditures.txt")
    if not os.path.exists(path):
        return []
    text = open(path, encoding="utf-8").read()
    blocks = re.split(r'\n\s*\n', text.strip())
    result, i = [], 1
    for block in blocks:
        lines = [l.strip() for l in block.strip().splitlines() if l.strip()]
        if len(lines) < 2:
            continue
        name = lines[0]
        fee_raw    = next((l.split(":", 1)[1].strip() for l in lines if l.lower().startswith("fee:")), "")
        period_raw = next((l.split(":", 1)[1].strip() for l in lines if l.lower().startswith("period:")), "monthly")
        next_bill  = next((l.split(":", 1)[1].strip() for l in lines if l.lower().startswith("next bill:")), "")
        if not fee_raw or fee_raw.upper() == "FREE" or fee_raw.strip() == "__":
            continue
        currency = "EUR" if "EUR" in fee_raw.upper() else "USD"
        cost_str = re.sub(r"[^\d.,]", "", fee_raw).replace(",", ".")
        try:
            cost = float(cost_str)
        except Exception:
            continue
        cycle = period_raw.lower().strip()
        if cycle not in ("monthly", "yearly", "weekly", "daily"):
            cycle = "monthly"
        result.append({
            "id": str(i), "name": name,
            "cost": cost, "currency": currency, "cycle": cycle,
            "next_billing": next_bill if next_bill != "__" else "",
        })
        i += 1
    return result


@app.get("/subscriptions")
def get_subscriptions(user: str = Depends(verify_token)):
    """Return saved subscription list; seeds from expenditures file on first call."""
    import json
    raw = db.get_setting("subscriptions", default="")
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            pass
    # First call — seed from file and persist
    seeded = _parse_expenditures_file()
    if seeded:
        db.set_setting("subscriptions", json.dumps(seeded))
    return seeded

from fastapi import Body as _Body

@app.post("/subscriptions")
def save_subscriptions(body: list = _Body(...), user: str = Depends(verify_token)):
    """Persist subscription list as JSON."""
    import json
    db.set_setting("subscriptions", json.dumps(body))
    return {"ok": True}


@app.get("/podbean/callback")
def podbean_oauth_callback(code: str = None, error: str = None):
    """OAuth2 callback — not needed for Client Credentials flow but registered for completeness."""
    from fastapi.responses import HTMLResponse
    if error:
        return HTMLResponse(f"<html><body style='background:#08080f;color:#f87171;font-family:sans-serif;padding:40px'><h2>Podbean Auth Error</h2><p>{error}</p><a href='/dashboard' style='color:#00a0dc'>Back to dashboard</a></body></html>")
    return HTMLResponse("<html><body style='background:#08080f;color:#4ade80;font-family:sans-serif;padding:40px'><h2>✅ Podbean Connected</h2><p>You can close this tab.</p></body></html>")


@app.post("/videos/{video_id}/upload-tiktok")
def upload_to_tiktok(video_id: str, body: dict = {}, background_tasks: BackgroundTasks = None, user: str = Depends(verify_token)):
    """Upload a ready video to TikTok."""
    from pipeline.tiktok_uploader import is_connected
    if not is_connected():
        raise HTTPException(status_code=400, detail="TikTok not connected. Go to Settings to connect.")
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if not video.get("file_path"):
        raise HTTPException(status_code=400, detail="No video file available")

    privacy = body.get("privacy", "SELF_ONLY")

    def do_upload():
        import tempfile, requests as req2, os
        try:
            db.get_client().table("videos").update({"tiktok_status": "uploading"}).eq("id", video_id).execute()
            # Download from Supabase storage to temp file
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
                tmp_path = tmp.name
                r = req2.get(video["file_path"], timeout=120, stream=True)
                r.raise_for_status()
                for chunk in r.iter_content(chunk_size=8192):
                    tmp.write(chunk)
            from pipeline.tiktok_uploader import upload_to_tiktok as _upload
            result = _upload(
                video_path=tmp_path,
                title=video.get("title") or "4Life Mystery",
                description=video.get("description") or "",
                privacy=privacy,
            )
            os.unlink(tmp_path)
            db.get_client().table("videos").update({
                "tiktok_status":     "posted",
                "tiktok_publish_id": result.get("publish_id"),
            }).eq("id", video_id).execute()
            print(f"✅ TikTok upload complete: {result}")
        except Exception as e:
            db.get_client().table("videos").update({"tiktok_status": "failed"}).eq("id", video_id).execute()
            print(f"❌ TikTok upload failed: {e}")
            import traceback; traceback.print_exc()

    background_tasks.add_task(do_upload)
    return {"message": "TikTok upload started", "video_id": video_id}


# ─────────────────────────────────────────────────────────────────────────────
# BLOG / PUBLIC COMMENTS
# ─────────────────────────────────────────────────────────────────────────────

import hashlib as _hashlib
import time as _time
from collections import defaultdict as _defaultdict

# Simple in-memory rate limiter: ip → list of timestamps
_blog_rate: dict = _defaultdict(list)
_BLOG_RATE_LIMIT = 3   # max comments per IP
_BLOG_RATE_WINDOW = 3600  # seconds (1 hour)

def _check_blog_rate(ip: str) -> bool:
    """Returns True if allowed, False if rate-limited."""
    now = _time.time()
    _blog_rate[ip] = [t for t in _blog_rate[ip] if now - t < _BLOG_RATE_WINDOW]
    if len(_blog_rate[ip]) >= _BLOG_RATE_LIMIT:
        return False
    _blog_rate[ip].append(now)
    return True

def _profanity_check(text: str) -> bool:
    """Returns True if text contains profanity."""
    try:
        from better_profanity import profanity
        profanity.load_censor_words()
        return profanity.contains_profanity(text)
    except ImportError:
        # Fallback basic list
        BAD = ["fuck","shit","bitch","asshole","cunt","nigger","faggot","retard","whore","slut"]
        lower = text.lower()
        return any(w in lower for w in BAD)

class BlogCommentIn(BaseModel):
    name: str
    email: Optional[str] = None
    content: str
    fingerprint: str

class BlogLikeIn(BaseModel):
    fingerprint: str

class BlogRejectIn(BaseModel):
    reason: str

class BlogReplyIn(BaseModel):
    content: str

@app.get("/blog/comments")
async def get_blog_comments(page: int = 1, limit: int = 20, fp: str = ""):
    db_client = db.get_client()
    offset = (page - 1) * limit
    # Top-level approved comments
    res = (db_client.table("blog_comments")
             .select("*")
             .eq("status", "approved")
             .is_("parent_id", "null")
             .order("created_at", desc=True)
             .range(offset, offset + limit - 1)
             .execute())
    comments = res.data or []
    comment_ids = [c["id"] for c in comments]

    # Fetch approved replies for these comments
    replies_map: dict = {}
    if comment_ids:
        rep_res = (db_client.table("blog_comments")
                     .select("*")
                     .eq("status", "approved")
                     .in_("parent_id", comment_ids)
                     .order("created_at", desc=False)
                     .execute())
        for r in (rep_res.data or []):
            replies_map.setdefault(r["parent_id"], []).append(r)

    # Fetch which comments this fingerprint already liked
    liked_ids: set = set()
    if fp:
        lk_res = (db_client.table("blog_comment_likes")
                    .select("comment_id")
                    .eq("liker_fingerprint", fp)
                    .execute())
        liked_ids = {r["comment_id"] for r in (lk_res.data or [])}

    # Count total
    cnt = db_client.table("blog_comments").select("id", count="exact").eq("status", "approved").is_("parent_id", "null").execute()
    total = cnt.count or 0

    for c in comments:
        c["replies"] = replies_map.get(c["id"], [])
        c["liked_by_me"] = c["id"] in liked_ids
        # strip private fields
        c.pop("ip_hash", None)
        c.pop("commenter_fingerprint", None)
        c.pop("email", None)
        for r in c["replies"]:
            r.pop("ip_hash", None)
            r.pop("commenter_fingerprint", None)
            r.pop("email", None)

    return {"comments": comments, "total": total, "page": page, "limit": limit}


@app.post("/blog/comments")
async def submit_blog_comment(body: BlogCommentIn, request: Request):
    name = body.name.strip()
    content = body.content.strip()
    if len(name) < 2:
        raise HTTPException(400, "Name must be at least 2 characters")
    if len(content) < 5 or len(content) > 2000:
        raise HTTPException(400, "Comment must be 5–2000 characters")
    if _profanity_check(name) or _profanity_check(content):
        raise HTTPException(400, "Your comment contains inappropriate language. Please keep it respectful.")

    ip = request.headers.get("x-forwarded-for", request.client.host).split(",")[0].strip()
    ip_hash = _hashlib.sha256(ip.encode()).hexdigest()[:16]
    if not _check_blog_rate(ip_hash):
        raise HTTPException(429, "Too many comments. Please wait before submitting again.")

    db_client = db.get_client()
    row = {
        "name": name[:80],
        "email": (body.email or "")[:120] or None,
        "content": content,
        "status": "pending",
        "commenter_fingerprint": body.fingerprint[:64] if body.fingerprint else None,
        "ip_hash": ip_hash,
    }
    res = db_client.table("blog_comments").insert(row).execute()
    return {"id": res.data[0]["id"], "status": "pending", "message": "Comment submitted for review. Thank you!"}


@app.post("/blog/comments/{comment_id}/reply")
async def reply_blog_comment(comment_id: str, body: BlogCommentIn, request: Request):
    """Public reply to an approved top-level comment (goes through moderation)."""
    name = body.name.strip()
    content = body.content.strip()
    if len(name) < 2:
        raise HTTPException(400, "Name must be at least 2 characters")
    if len(content) < 5 or len(content) > 2000:
        raise HTTPException(400, "Reply must be 5–2000 characters")
    if _profanity_check(name) or _profanity_check(content):
        raise HTTPException(400, "Your reply contains inappropriate language. Please keep it respectful.")

    ip = request.headers.get("x-forwarded-for", request.client.host).split(",")[0].strip()
    ip_hash = _hashlib.sha256(ip.encode()).hexdigest()[:16]
    if not _check_blog_rate(ip_hash):
        raise HTTPException(429, "Too many comments. Please wait before submitting again.")

    db_client = db.get_client()
    parent = (db_client.table("blog_comments")
                .select("id,status")
                .eq("id", comment_id)
                .eq("status", "approved")
                .is_("parent_id", "null")
                .execute())
    if not parent.data:
        raise HTTPException(404, "Comment not found or not available for replies")

    row = {
        "name": name[:80],
        "email": (body.email or "")[:120] or None,
        "content": content,
        "status": "pending",
        "commenter_fingerprint": body.fingerprint[:64] if body.fingerprint else None,
        "ip_hash": ip_hash,
        "parent_id": comment_id,
    }
    res = db_client.table("blog_comments").insert(row).execute()
    return {"id": res.data[0]["id"], "status": "pending", "message": "Reply submitted for review. Thank you!"}


@app.post("/blog/comments/{comment_id}/like")
async def like_blog_comment(comment_id: str, body: BlogLikeIn):
    if not body.fingerprint:
        raise HTTPException(400, "Fingerprint required")
    db_client = db.get_client()
    # Get comment
    c = db_client.table("blog_comments").select("id,likes_count,commenter_fingerprint,status").eq("id", comment_id).execute()
    if not c.data:
        raise HTTPException(404, "Comment not found")
    comment = c.data[0]
    if comment["status"] != "approved":
        raise HTTPException(400, "Cannot like unapproved comment")
    if comment.get("commenter_fingerprint") == body.fingerprint:
        raise HTTPException(400, "You cannot like your own comment")
    # Toggle like
    existing = db_client.table("blog_comment_likes").select("id").eq("comment_id", comment_id).eq("liker_fingerprint", body.fingerprint).execute()
    if existing.data:
        # Unlike
        db_client.table("blog_comment_likes").delete().eq("comment_id", comment_id).eq("liker_fingerprint", body.fingerprint).execute()
        new_count = max(0, (comment["likes_count"] or 0) - 1)
        db_client.table("blog_comments").update({"likes_count": new_count}).eq("id", comment_id).execute()
        return {"liked": False, "likes_count": new_count}
    else:
        # Like
        db_client.table("blog_comment_likes").insert({"comment_id": comment_id, "liker_fingerprint": body.fingerprint}).execute()
        new_count = (comment["likes_count"] or 0) + 1
        db_client.table("blog_comments").update({"likes_count": new_count}).eq("id", comment_id).execute()
        return {"liked": True, "likes_count": new_count}


# ── ADMIN BLOG ROUTES ─────────────────────────────────────────────────────────

@app.get("/admin/blog/comments")
async def admin_get_comments(status: str = "pending", page: int = 1, limit: int = 50, _u=Depends(verify_token)):
    db_client = db.get_client()
    offset = (page - 1) * limit
    q = db_client.table("blog_comments").select("*").order("created_at", desc=True).range(offset, offset + limit - 1)
    if status != "all":
        q = q.eq("status", status)
    res = q.execute()
    comments = res.data or []

    # Attach parent_snippet for replies so admin knows which comment they're responding to
    parent_ids = list({c["parent_id"] for c in comments if c.get("parent_id")})
    parent_map: dict = {}
    if parent_ids:
        parents = (db_client.table("blog_comments")
                     .select("id,name,content")
                     .in_("id", parent_ids)
                     .execute())
        parent_map = {p["id"]: p for p in (parents.data or [])}
    for c in comments:
        if c.get("parent_id") and c["parent_id"] in parent_map:
            p = parent_map[c["parent_id"]]
            c["parent_snippet"] = {"name": p["name"], "content": p["content"][:120]}

    # count
    cq = db_client.table("blog_comments").select("id", count="exact")
    if status != "all":
        cq = cq.eq("status", status)
    cnt = cq.execute()
    # pending count always useful
    pending_cnt = db_client.table("blog_comments").select("id", count="exact").eq("status", "pending").execute()
    return {"comments": comments, "total": cnt.count or 0, "pending_count": pending_cnt.count or 0}


@app.post("/admin/blog/comments/{comment_id}/approve")
async def admin_approve_comment(comment_id: str, _u=Depends(verify_token)):
    db_client = db.get_client()
    db_client.table("blog_comments").update({"status": "approved", "rejection_reason": None}).eq("id", comment_id).execute()
    return {"ok": True}


@app.post("/admin/blog/comments/{comment_id}/reject")
async def admin_reject_comment(comment_id: str, body: BlogRejectIn, _u=Depends(verify_token)):
    db_client = db.get_client()
    db_client.table("blog_comments").update({"status": "rejected", "rejection_reason": body.reason}).eq("id", comment_id).execute()
    return {"ok": True}


@app.delete("/admin/blog/comments/{comment_id}")
async def admin_delete_comment(comment_id: str, _u=Depends(verify_token)):
    db_client = db.get_client()
    db_client.table("blog_comments").delete().eq("id", comment_id).execute()
    return {"ok": True}


@app.post("/admin/blog/comments/{comment_id}/retract")
async def admin_retract_comment(comment_id: str, _u=Depends(verify_token)):
    """Retract an approved comment — pulls it from public view (sets back to pending)."""
    db_client = db.get_client()
    db_client.table("blog_comments").update({"status": "pending"}).eq("id", comment_id).execute()
    return {"ok": True}


@app.post("/admin/blog/comments/{comment_id}/reply")
async def admin_reply_comment(comment_id: str, body: BlogReplyIn, _u=Depends(verify_token)):
    content = body.content.strip()
    if len(content) < 2 or len(content) > 2000:
        raise HTTPException(400, "Reply must be 2–2000 characters")
    db_client = db.get_client()
    # Verify parent exists
    parent = db_client.table("blog_comments").select("id").eq("id", comment_id).execute()
    if not parent.data:
        raise HTTPException(404, "Comment not found")
    row = {
        "name": "4Life Mystery",
        "content": content,
        "status": "approved",
        "is_admin_reply": True,
        "parent_id": comment_id,
    }
    res = db_client.table("blog_comments").insert(row).execute()
    return res.data[0]


# ── Stick-Figure Video Editor ─────────────────────────────────────────────────

from pathlib import Path as _Path

_STICKFIGURE_DDL = """
CREATE TABLE IF NOT EXISTS stickfigure_clips (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename    TEXT NOT NULL UNIQUE,
    label       TEXT NOT NULL,
    keywords    TEXT[] DEFAULT '{}',
    file_path   TEXT NOT NULL,
    public_url  TEXT DEFAULT '',
    duration    FLOAT DEFAULT 0,
    width       INTEGER DEFAULT 0,
    height      INTEGER DEFAULT 0,
    has_alpha   BOOLEAN DEFAULT FALSE,
    has_audio   BOOLEAN DEFAULT FALSE,
    enabled     BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sfclips_enabled ON stickfigure_clips(enabled);
ALTER TABLE stickfigure_clips ADD COLUMN IF NOT EXISTS public_url TEXT DEFAULT '';
"""

@app.post("/admin/migrate/stickfigure-clips")
def migrate_stickfigure_clips(_u: str = Depends(verify_token)):
    """
    One-time migration: create the stickfigure_clips table in Supabase.
    Safe to call multiple times (uses CREATE TABLE IF NOT EXISTS).
    """
    import re as _re
    import urllib.request as _ur
    import json as _json

    # Derive project ref from SUPABASE_URL (https://<ref>.supabase.co)
    match = _re.search(r"https://([^.]+)\.supabase\.co", config.SUPABASE_URL)
    if not match:
        raise HTTPException(500, f"Cannot parse project ref from SUPABASE_URL={config.SUPABASE_URL!r}")
    project_ref = match.group(1)

    url = f"https://api.supabase.com/v1/projects/{project_ref}/database/query"

    # The Management API requires an access token (sbp_...).
    # Fall back to using the service key which works for the SQL endpoint
    # exposed directly on the project's REST URL.
    payload = _json.dumps({"query": _STICKFIGURE_DDL}).encode()

    # Try Management API first
    req = _ur.Request(url, data=payload,
                      headers={"Content-Type": "application/json",
                               "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}"})
    try:
        with _ur.urlopen(req, timeout=15) as resp:
            body = resp.read().decode()
            return {"ok": True, "method": "management_api", "response": body[:300]}
    except Exception as mgmt_err:
        pass  # fall through to direct approach

    # Direct approach: use the supabase-py client with raw HTTP to the SQL endpoint
    # Supabase exposes /rest/v1/rpc/exec_sql if the function exists; we use
    # the admin REST endpoint instead which supabase-py v2 exposes.
    try:
        _client = db.get_client()
        # supabase-py v2 exposes the underlying postgrest session
        # Use it to POST raw SQL via the pg endpoint
        inner = getattr(_client, "postgrest", None)
        if inner is None:
            raise RuntimeError("No postgrest attr on client")
        # Try calling a helper RPC if user has created one
        result = _client.rpc("exec_sql", {"sql": _STICKFIGURE_DDL}).execute()
        return {"ok": True, "method": "rpc", "result": str(result)[:300]}
    except Exception as rpc_err:
        pass

    raise HTTPException(
        501,
        "Automatic migration unavailable — please run this SQL once in your Supabase SQL Editor:\n\n"
        + _STICKFIGURE_DDL
    )

# In-memory job tracking for composite operations
_composite_jobs: dict = {}  # video_id → {"status": str, "message": str, "output_path": str}
_composite_lock = _threading.Lock()


def _resolve_video_file(file_path: str, video_id: str) -> str:
    """
    Return a local filesystem path for a video, downloading from Supabase
    Storage if the file_path is a remote URL.  Raises HTTPException if the
    file cannot be obtained.
    """
    import urllib.request as _ur
    import shutil as _sh

    if not file_path:
        raise HTTPException(400, "Video has no file_path stored in the database")

    # Already a local path that exists?
    candidate = _Path(file_path)
    if not candidate.is_absolute():
        candidate = _cfg.VIDEOS_OUTPUT_DIR / candidate.name
    if candidate.exists():
        return str(candidate)

    # file_path is a URL → download to VIDEOS_OUTPUT_DIR
    if file_path.startswith("http://") or file_path.startswith("https://"):
        fname    = _Path(file_path.split("?")[0]).name  # strip query params
        dest     = _cfg.VIDEOS_OUTPUT_DIR / fname
        if dest.exists():
            return str(dest)
        print(f"⬇️  Downloading video for compositor: {file_path}")
        try:
            with _ur.urlopen(file_path, timeout=120) as resp, open(dest, "wb") as fh:
                _sh.copyfileobj(resp, fh)
            print(f"✅ Downloaded → {dest}")
            return str(dest)
        except Exception as e:
            raise HTTPException(400, f"Could not download video from storage: {e}")

    raise HTTPException(400, "Video file not found on disk and is not a downloadable URL")


class OverlayItem(BaseModel):
    clip_path: str          # absolute server path
    start_time: float       # seconds into base video
    duration: Optional[float] = None
    x: int = 0
    y: int = 0
    scale: float = 0.5
    loop_mode: str = "none"  # none | full | last_1s | last_2s | last_3s
    has_sound: bool = True


class CompositeRequest(BaseModel):
    overlays: list[OverlayItem]
    mix_overlay_audio: bool = True
    chroma_color: str = "0x00FF00"
    chroma_similarity: float = 0.35
    chroma_blend: float = 0.05
    replace_original: bool = False  # if True, overwrite the video file


class AutoCompositeRequest(BaseModel):
    min_gap: float = 8.0
    max_overlays: int = 8
    mix_overlay_audio: bool = True
    replace_original: bool = False


@app.get("/stickfigures")
def list_stickfigures(
    enabled_only: bool = True,
    skip: int = 0,
    limit: int = 0,
    _u: str = Depends(verify_token),
):
    """List all stick-figure clips from the DB (with filesystem fallback).

    Pass skip/limit for paginated loading (limit=0 returns all).
    """
    from pipeline.stickfigure_compositor import list_clips
    clips = list_clips(enabled_only=enabled_only)
    supabase_base = (config.SUPABASE_URL or "").rstrip("/")
    valid = []
    for c in clips:
        # Only expose MP4 files
        if not c.get("filename", "").lower().endswith(".mp4"):
            continue
        # Build preview URL: stored public_url → computed Supabase URL → local fallback
        file_exists = _Path(c.get("file_path", "")).exists()
        computed_url = f"{supabase_base}/storage/v1/object/public/stickfigures/{c['filename']}" if supabase_base else ""
        has_url = bool(c.get("public_url") or computed_url)
        if not file_exists and not has_url:
            continue
        c["preview_url"] = c.get("public_url") or computed_url or f"/stickfigures-assets/{c['filename']}"
        valid.append(c)
    total = len(valid)
    if limit > 0:
        page_clips = valid[skip: skip + limit]
    else:
        page_clips = valid[skip:]
    return {"clips": page_clips, "total": total, "skip": skip, "limit": limit}


@app.post("/stickfigures/seed")
def seed_stickfigures(_u: str = Depends(verify_token)):
    """
    Populate the stickfigure_clips table from the files on disk + the built-in
    keyword map.  Safe to call multiple times — uses upsert on filename.
    Returns counts of inserted/updated records.
    """
    from pipeline.stickfigure_compositor import get_video_info
    from pipeline.stickfigure_matcher import _SEED_KEYWORDS

    upserted = 0
    skipped  = 0
    errors   = []

    from pipeline.storage import upload_clip_to_storage

    for filename, keywords in _SEED_KEYWORDS.items():
        path = _STICK_FIGURE_DIR / filename
        if not path.exists():
            skipped += 1
            continue
        try:
            info  = get_video_info(str(path))
            label = filename.replace(".mp4", "").replace("_", " ").replace("-", " ").strip()
            clip_public_url = ""
            try:
                clip_public_url = upload_clip_to_storage(str(path), filename)
            except Exception as e:
                errors.append(f"storage/{filename}: {str(e)[:80]}")
            db.upsert_stickfigure_clip(
                filename   = filename,
                label      = label,
                keywords   = [k.lower() for k in keywords],
                file_path  = str(path),
                duration   = round(info["duration"], 2),
                width      = info["width"],
                height     = info["height"],
                has_alpha  = info["has_alpha"],
                has_audio  = info["has_audio"],
            )
            upserted += 1
        except Exception as e:
            errors.append(f"{filename}: {str(e)[:120]}")

    # Also register any on-disk files NOT in the seed map
    for path in sorted(_STICK_FIGURE_DIR.glob("*.mp4")):
        if path.name in _SEED_KEYWORDS:
            continue
        try:
            info  = get_video_info(str(path))
            label = path.stem.replace("_", " ").replace("-", " ").strip()
            clip_public_url = ""
            try:
                clip_public_url = upload_clip_to_storage(str(path), path.name)
            except Exception as e:
                errors.append(f"storage/{path.name}: {str(e)[:80]}")
            db.upsert_stickfigure_clip(
                filename   = path.name,
                label      = label,
                keywords   = [],
                file_path  = str(path),
                duration   = round(info["duration"], 2),
                width      = info["width"],
                height     = info["height"],
                has_alpha  = info["has_alpha"],
                has_audio  = info["has_audio"],
            )
            upserted += 1
        except Exception as e:
            errors.append(f"{path.name}: {str(e)[:120]}")

    return {"upserted": upserted, "skipped": skipped, "errors": errors}


@app.post("/stickfigures/sync-storage")
def sync_stickfigures_storage(_u: str = Depends(verify_token)):
    """
    Upload all stick-figure clips to the Supabase 'stickfigures' storage bucket.
    Safe to call multiple times — uses x-upsert so re-uploading is idempotent.
    After this runs, list_stickfigures will serve Supabase public URLs automatically.
    """
    from pipeline.storage import upload_clip_to_storage
    clips = db.list_stickfigure_clips(enabled_only=False)
    uploaded, errors = 0, []
    for clip in clips:
        local = _Path(clip["file_path"])
        if not local.exists():
            errors.append(f"{clip['filename']}: file not found at {clip['file_path']}")
            continue
        try:
            pub_url = upload_clip_to_storage(str(local), clip["filename"])
            # Write public_url back to DB so subsequent queries use it
            db.update_stickfigure_clip(clip["id"], public_url=pub_url)
            uploaded += 1
        except Exception as e:
            errors.append(f"{clip['filename']}: {str(e)[:120]}")
    return {"uploaded": uploaded, "total": len(clips), "errors": errors}


@app.post("/stickfigures/backfill-urls")
def backfill_stickfigure_urls(_u: str = Depends(verify_token)):
    """
    One-time repair: for every clip that has no public_url saved in DB, construct
    the expected Supabase Storage URL and save it.  Safe to call multiple times.
    Needed for clips that were uploaded before the public_url column was added.
    Requires the public_url column to exist — run the SQL migration first if it errors.
    """
    supabase_base = (config.SUPABASE_URL or "").rstrip("/")
    if not supabase_base:
        raise HTTPException(500, "SUPABASE_URL not configured")

    # Check that the column exists before attempting writes
    try:
        _client = db.get_client()
        _client.table("stickfigure_clips").select("public_url").limit(1).execute()
    except Exception:
        raise HTTPException(500,
            "Column 'public_url' does not exist in stickfigure_clips. "
            "Run this SQL in your Supabase SQL editor first: "
            "ALTER TABLE stickfigure_clips ADD COLUMN IF NOT EXISTS public_url TEXT DEFAULT '';"
        )

    clips = db.list_stickfigure_clips(enabled_only=False)
    updated, already_ok, errors = 0, 0, []
    for clip in clips:
        if clip.get("public_url"):
            already_ok += 1
            continue
        pub_url = f"{supabase_base}/storage/v1/object/public/stickfigures/{clip['filename']}"
        try:
            db.update_stickfigure_clip(clip["id"], public_url=pub_url)
            updated += 1
        except Exception as e:
            errors.append(f"{clip['filename']}: {str(e)[:80]}")
    return {"updated": updated, "already_ok": already_ok, "total": len(clips), "errors": errors}


class StickFigureUpdate(BaseModel):
    label:    Optional[str]       = None
    keywords: Optional[list[str]] = None
    enabled:  Optional[bool]      = None


@app.patch("/stickfigures/{clip_id}")
def update_stickfigure(clip_id: str, req: StickFigureUpdate, _u: str = Depends(verify_token)):
    """Update label, keywords, or enabled flag for a clip."""
    fields = {k: v for k, v in req.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(400, "Nothing to update")
    updated = db.update_stickfigure_clip(clip_id, **fields)
    return updated


@app.delete("/stickfigures/{clip_id}")
def delete_stickfigure(
    clip_id: str,
    delete_file: bool = False,
    _u: str = Depends(verify_token),
):
    """Remove a clip from the catalogue. Pass delete_file=true to also delete from disk."""
    clip = db.get_stickfigure_clip(clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    db.delete_stickfigure_clip(clip_id)
    if delete_file:
        try:
            _Path(clip["file_path"]).unlink(missing_ok=True)
        except Exception as e:
            return {"ok": True, "file_deleted": False, "error": str(e)}
    return {"ok": True, "file_deleted": delete_file}


@app.post("/stickfigures/upload")
async def upload_stickfigure(
    file: UploadFile = File(...),
    label: str = "",
    keywords: str = "",   # comma-separated
    _u: str = Depends(verify_token),
):
    """
    Upload a new stick-figure clip (.mp4) and register it in the DB.
    keywords: comma-separated trigger words, e.g. "joy,happy,smile"
    """
    from pipeline.stickfigure_compositor import get_video_info

    if not file.filename.lower().endswith(".mp4"):
        raise HTTPException(400, "Only .mp4 files are accepted")

    # Sanitise filename
    safe_name = _Path(file.filename).name
    dest = _STICK_FIGURE_DIR / safe_name
    if dest.exists():
        raise HTTPException(409, f"A clip named {safe_name!r} already exists — rename or delete it first")

    # Save the raw upload
    content = await file.read()
    raw_dest = _STICK_FIGURE_DIR / f"_raw_{safe_name}"
    with open(raw_dest, "wb") as f:
        f.write(content)

    # Normalize: re-encode to h264 yuv420p, 30fps, aac audio, strip unusual colorspaces.
    # This gives every clip a predictable format so chromakey works consistently.
    import subprocess as _sp
    norm_result = _sp.run([
        "ffmpeg", "-y", "-i", str(raw_dest),
        "-vf", "format=yuv420p,fps=30",
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k",
        "-movflags", "+faststart",
        str(dest),
    ], capture_output=True)
    raw_dest.unlink(missing_ok=True)  # always clean up raw file
    if norm_result.returncode != 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(422, f"Could not normalise video: {norm_result.stderr[-300:]}")

    # Probe normalized file
    try:
        info = get_video_info(str(dest))
    except Exception:
        dest.unlink(missing_ok=True)
        raise HTTPException(422, "Could not read video info — is the file a valid MP4?")

    kw_list = [k.strip().lower() for k in keywords.split(",") if k.strip()]
    # Auto-extract keywords from filename when user provides none
    if not kw_list:
        import re as _re
        stem_words = _re.split(r'[_\s\-]+', _Path(safe_name).stem.lower())
        kw_list = [w for w in stem_words if len(w) > 2]
    display_label = label.strip() or _Path(safe_name).stem.replace("_", " ").replace("-", " ")

    try:
        from pipeline.storage import upload_clip_to_storage
        public_url = upload_clip_to_storage(str(dest), safe_name)
    except Exception as _ue:
        public_url = ""
        print(f"⚠️  Clip storage upload failed: {_ue}")

    row = db.upsert_stickfigure_clip(
        filename   = safe_name,
        label      = display_label,
        keywords   = kw_list,
        file_path  = str(dest),
        public_url = public_url,
        duration   = round(info["duration"], 2),
        width      = info["width"],
        height     = info["height"],
        has_alpha  = info["has_alpha"],
        has_audio  = info["has_audio"],
    )
    row["preview_url"] = public_url or f"/stickfigures-assets/{safe_name}"
    return row


@app.post("/videos/{video_id}/composite")
def start_composite(
    video_id: str,
    req: CompositeRequest,
    background_tasks: BackgroundTasks,
    _u: str = Depends(verify_token),
):
    """
    Start an FFmpeg compositing job that overlays stick-figure clips onto the
    video identified by video_id.  The job runs in the background; poll
    GET /videos/{video_id}/composite-status for progress.
    """
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(404, "Video not found")

    base_path = _resolve_video_file(video.get("file_path", ""), video_id)

    # Validate overlay clip paths — deduplicate, skip missing files
    valid_overlays = []
    skipped = []
    seen_paths: set[str] = set()
    for ov in req.overlays:
        clip_str = ov.clip_path
        is_url = clip_str.startswith("http://") or clip_str.startswith("https://")
        if is_url:
            # Supabase-hosted clip — URL is always valid, use it as dedup key
            if clip_str in seen_paths:
                print(f"⚠️  Duplicate clip skipped: {clip_str}")
                continue
            seen_paths.add(clip_str)
            valid_overlays.append(ov)
        else:
            # Local path — must be inside stickFigureAssets
            ov_path = _Path(clip_str)
            try:
                ov_path.relative_to(_STICK_FIGURE_DIR)
            except ValueError:
                raise HTTPException(400, f"Clip path must be inside stickFigureAssets: {clip_str}")
            norm = str(ov_path.resolve())
            if norm in seen_paths:
                print(f"⚠️  Duplicate clip skipped: {clip_str}")
                continue
            seen_paths.add(norm)
            if not ov_path.exists():
                print(f"⚠️  Clip not found (skipping): {clip_str}")
                skipped.append(ov_path.name)
            else:
                valid_overlays.append(ov)
    req = req.model_copy(update={"overlays": valid_overlays})

    with _composite_lock:
        if _composite_jobs.get(video_id, {}).get("status") == "running":
            raise HTTPException(409, "A composite job is already running for this video")
        _composite_jobs[video_id] = {"status": "running", "message": "Starting…", "output_path": None, "logs": []}

    overlays_data = [ov.model_dump() for ov in req.overlays]
    mix_audio     = req.mix_overlay_audio
    chroma_color  = req.chroma_color
    chroma_sim    = req.chroma_similarity
    chroma_blend  = req.chroma_blend
    replace_orig  = req.replace_original
    orig_title    = video.get("title") or video.get("prompt", "")[:60] or "Video"
    orig_prompt   = video.get("prompt") or ""
    orig_duration = video.get("duration_seconds") or 0

    def _log(msg):
        import datetime
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        line = f"[{ts}] {msg}"
        with _composite_lock:
            _composite_jobs[video_id].setdefault("logs", []).append(line)
        print(f"[composite/{video_id[:8]}] {msg}")

    def _run():
        import time
        import threading
        from pipeline.stickfigure_compositor import composite_video
        try:
            stem    = _Path(base_path).stem
            out_dir = _cfg.VIDEOS_OUTPUT_DIR
            out_path = str(out_dir / f"{stem}_composited.mp4")

            _log(f"Base video: {_Path(base_path).name}")
            if skipped:
                _log(f"⚠ {len(skipped)} clip(s) skipped (file not on server): {', '.join(skipped)}")
            _log(f"Overlays: {len(overlays_data)} clip(s) queued")
            _log(f"FFmpeg compositing started — single pass for all {len(overlays_data)} overlay(s)…")
            _composite_jobs[video_id]["message"] = f"Compositing {len(overlays_data)} overlay(s)…"

            # Heartbeat thread so the UI knows we're still alive
            _started = time.time()
            _stop_hb = threading.Event()
            def _heartbeat():
                while not _stop_hb.wait(20):
                    elapsed = int(time.time() - _started)
                    _log(f"Still compositing… {elapsed}s elapsed")
            threading.Thread(target=_heartbeat, daemon=True).start()

            composite_video(
                base_path=base_path,
                overlays=overlays_data,
                output_path=out_path,
                mix_overlay_audio=mix_audio,
                chroma_color=chroma_color,
                chroma_similarity=chroma_sim,
                chroma_blend=chroma_blend,
            )
            _stop_hb.set()
            elapsed = round(time.time() - _started, 1)
            _log(f"FFmpeg done in {elapsed}s — output: {_Path(out_path).name}")

            final_path = out_path
            if replace_orig:
                import shutil
                shutil.move(out_path, base_path)
                final_path = base_path

            # Upload to Supabase and save as a new video record
            new_video_id = None
            supabase_url = None
            try:
                from pipeline.storage import upload_to_storage
                import uuid as _uuid
                new_video_id = str(_uuid.uuid4())
                _log("Uploading composite to Supabase storage…")
                supabase_url = upload_to_storage(final_path, new_video_id)
                _log(f"Uploaded: {supabase_url.split('/')[-1]}")

                new_title = f"{orig_title} (Composited)"
                _log(f"Saving to DB as \"{new_title}\"…")
                new_vid = db.create_video(prompt=orig_prompt or f"[Composited] {orig_title}")
                new_video_id = new_vid["id"]
                db.update_video(new_video_id,
                    title=new_title,
                    file_path=supabase_url,
                    status="ready",
                    duration_seconds=orig_duration,
                    description=f"Composited version of: {orig_title}",
                )
                _log(f"Saved as new video: {new_video_id[:8]}…")
            except Exception as save_exc:
                _log(f"⚠ Auto-save failed: {save_exc}")

            with _composite_lock:
                _composite_jobs[video_id] = {
                    "status": "done",
                    "message": "Composite complete — saved as new video",
                    "output_path": final_path,
                    "file_path": _Path(final_path).name,
                    "new_video_id": new_video_id,
                    "logs": _composite_jobs[video_id].get("logs", []),
                }
        except Exception as exc:
            with _composite_lock:
                _composite_jobs[video_id] = {
                    "status": "error",
                    "message": str(exc)[:500],
                    "output_path": None,
                    "logs": _composite_jobs[video_id].get("logs", []),
                }

    background_tasks.add_task(_run)
    return {"status": "queued", "video_id": video_id}


@app.get("/videos/{video_id}/composite-status")
def composite_status(video_id: str, _u: str = Depends(verify_token)):
    """Poll the status of a running or completed composite job."""
    with _composite_lock:
        job = _composite_jobs.get(video_id)
    if not job:
        return {"status": "idle", "logs": []}
    result = dict(job)
    if result.get("status") == "done" and result.get("file_path"):
        result["preview_url"] = f"/local-videos/{result['file_path']}"
    if "logs" not in result:
        result["logs"] = []
    return result


@app.post("/videos/{video_id}/composite-finalize")
def composite_finalize(video_id: str, _u: str = Depends(verify_token)):
    """
    Finalize the completed composite: update the video's file_path in the DB
    to the composited output file so it becomes the new canonical version.
    Clears the composite job entry afterwards.
    """
    with _composite_lock:
        job = dict(_composite_jobs.get(video_id, {}))
    if not job or job.get("status") != "done":
        raise HTTPException(400, "No completed composite job found — run Apply Overlays first")
    out_path = job.get("output_path")
    if not out_path or not _Path(out_path).exists():
        raise HTTPException(400, "Composite output file missing from disk")
    db.update_video(video_id, file_path=out_path)
    with _composite_lock:
        _composite_jobs.pop(video_id, None)
    return {"status": "saved", "file_path": out_path}


@app.post("/videos/{video_id}/auto-composite")
def auto_composite(
    video_id: str,
    req: AutoCompositeRequest,
    background_tasks: BackgroundTasks,
    _u: str = Depends(verify_token),
):
    """
    Auto-insert stick-figure clips into a video based on its script text.
    Uses keyword matching to select the most appropriate clip per sentence.
    """
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(404, "Video not found")

    script = video.get("script") or video.get("prompt") or ""
    if not script:
        raise HTTPException(400, "Video has no script — cannot auto-match stick figures")

    base_path = _resolve_video_file(video.get("file_path", ""), video_id)

    duration = float(video.get("duration_seconds") or 60)
    min_gap   = req.min_gap
    max_ov    = req.max_overlays
    mix_audio = req.mix_overlay_audio
    replace   = req.replace_original

    orig_title    = video.get("title") or video.get("prompt", "")[:60] or "Video"
    orig_prompt   = video.get("prompt") or ""
    orig_duration = video.get("duration_seconds") or 0

    with _composite_lock:
        if _composite_jobs.get(video_id, {}).get("status") == "running":
            raise HTTPException(409, "A composite job is already running for this video")
        _composite_jobs[video_id] = {"status": "running", "message": "Matching keywords…", "output_path": None, "logs": []}

    def _log(msg):
        import datetime
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        line = f"[{ts}] {msg}"
        with _composite_lock:
            _composite_jobs[video_id].setdefault("logs", []).append(line)
        print(f"[auto-composite/{video_id[:8]}] {msg}")

    def _run():
        import time, threading
        from pipeline.stickfigure_matcher import match_clips_to_script
        from pipeline.stickfigure_compositor import composite_video
        try:
            _log("Matching clip keywords to script…")
            overlays = match_clips_to_script(script, duration, min_gap=min_gap, max_overlays=max_ov)
            if not overlays:
                _log("No keyword matches found — no overlays inserted")
                with _composite_lock:
                    _composite_jobs[video_id].update({
                        "status": "done",
                        "message": "No keyword matches found — no overlays inserted",
                        "output_path": base_path,
                        "file_path": _Path(base_path).name,
                        "matched": [],
                    })
                return

            _log(f"Matched {len(overlays)} clip(s)")
            stem     = _Path(base_path).stem
            out_path = str(_cfg.VIDEOS_OUTPUT_DIR / f"{stem}_composited.mp4")

            _log(f"FFmpeg compositing {len(overlays)} overlay(s) — single pass…")
            _composite_jobs[video_id]["message"] = f"Compositing {len(overlays)} auto-matched overlay(s)…"

            _started = time.time()
            _stop_hb = threading.Event()
            def _heartbeat():
                while not _stop_hb.wait(20):
                    elapsed = int(time.time() - _started)
                    _log(f"Still compositing… {elapsed}s elapsed")
            threading.Thread(target=_heartbeat, daemon=True).start()

            composite_video(
                base_path=base_path,
                overlays=overlays,
                output_path=out_path,
                mix_overlay_audio=mix_audio,
            )
            _stop_hb.set()
            elapsed = round(time.time() - _started, 1)
            _log(f"FFmpeg done in {elapsed}s")

            final_path = out_path
            if replace:
                import shutil
                shutil.move(out_path, base_path)
                final_path = base_path

            new_video_id = None
            try:
                from pipeline.storage import upload_to_storage
                import uuid as _uuid
                new_video_id = str(_uuid.uuid4())
                _log("Uploading to Supabase storage…")
                supabase_url = upload_to_storage(final_path, new_video_id)
                new_title = f"{orig_title} (Composited)"
                _log(f"Saving as \"{new_title}\"…")
                new_vid = db.create_video(prompt=orig_prompt or f"[Composited] {orig_title}")
                new_video_id = new_vid["id"]
                db.update_video(new_video_id,
                    title=new_title,
                    file_path=supabase_url,
                    status="ready",
                    duration_seconds=orig_duration,
                    description=f"Composited version of: {orig_title}",
                )
                _log(f"Saved as new video: {new_video_id[:8]}…")
            except Exception as save_exc:
                _log(f"⚠ Auto-save failed: {save_exc}")

            with _composite_lock:
                _composite_jobs[video_id].update({
                    "status": "done",
                    "message": f"Auto-composite complete — {len(overlays)} clip(s) inserted",
                    "output_path": final_path,
                    "file_path": _Path(final_path).name,
                    "new_video_id": new_video_id,
                    "matched": [
                        {"filename": o["filename"], "start_time": o["start_time"], "score": o["score"]}
                        for o in overlays
                    ],
                })
        except Exception as exc:
            with _composite_lock:
                _composite_jobs[video_id].update({
                    "status": "error",
                    "message": str(exc)[:500],
                    "output_path": None,
                })

    background_tasks.add_task(_run)
    return {"status": "queued", "video_id": video_id}


@app.post("/videos/{video_id}/auto-composite/preview")
def preview_auto_composite(
    video_id: str,
    req: AutoCompositeRequest,
    _u: str = Depends(verify_token),
):
    """
    Dry-run of the auto-composite: returns the list of clips that WOULD be
    inserted without actually running FFmpeg.
    """
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(404, "Video not found")

    script   = video.get("script") or video.get("prompt") or ""
    duration = float(video.get("duration_seconds") or 60)

    from pipeline.stickfigure_matcher import match_clips_to_script
    overlays = match_clips_to_script(
        script, duration,
        min_gap=req.min_gap,
        max_overlays=req.max_overlays,
    )
    supabase_base = (config.SUPABASE_URL or "").rstrip("/")
    # Enrich each overlay with the stored public_url from DB if available
    clips_by_filename = {c["filename"]: c for c in db.list_stickfigure_clips(enabled_only=False)}
    for o in overlays:
        stored = clips_by_filename.get(o["filename"], {})
        if stored.get("public_url"):
            o["preview_url"] = stored["public_url"]
        elif supabase_base:
            o["preview_url"] = f"{supabase_base}/storage/v1/object/public/stickfigures/{o['filename']}"
        else:
            o["preview_url"] = f"/stickfigures-assets/{o['filename']}"
    return {"overlays": overlays, "total": len(overlays)}


# ── end Stick-Figure Video Editor ─────────────────────────────────────────────


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)