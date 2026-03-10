"""
AutoVid — FastAPI Backend
Main application entry point with all API routes.
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
import jwt
import time
import threading as _threading

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


# ── Video models ──────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    prompt: str
    auto_upload: bool = True
    profile: str = "educational"
    visual_mood: Optional[str] = None
    music_style: str = "ambient"


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


# ── Video routes — IMPORTANT: specific paths BEFORE /{video_id} ──────────────

@app.post("/videos/generate")
def generate_video(
    req: GenerateRequest,
    background_tasks: BackgroundTasks,
    user: str = Depends(verify_token),
):
    """Start the full AutoVid pipeline. Returns immediately — pipeline runs in background."""
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    # Pre-create DB record so we have a video_id to return immediately
    record   = db.create_video(req.prompt)
    video_id = record["id"]
    _register_pipeline(video_id)

    def _cb(info):
        # Orchestrator calls cb({"step": ..., "message": ...})
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
                progress_callback=_cb,
                video_id=video_id,
            )
        except Exception as e:
            _push_log(video_id, f"[ERROR] {e}")
        finally:
            _push_log(video_id, "__DONE__")
            _unregister_pipeline(video_id)

    background_tasks.add_task(_run)
    return {"message": "Pipeline started", "prompt": req.prompt, "status": "generating", "video_id": video_id}


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


@app.get("/videos/{video_id}/logs")
def get_logs(video_id: str, since: int = Query(default=0), user: str = Depends(verify_token)):
    """Return buffered pipeline logs since a given line index.
    Frontend polls this every second — simple and reliable."""
    with _pipeline_lock:
        entry = _active_pipelines.get(video_id)
    if not entry:
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
            db.set_status(video_id, "uploading")
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
            db.set_failed(video_id, f"YouTube upload failed: {e}")
            print(f"❌ Upload failed: {e}")

    background_tasks.add_task(do_upload)
    return {"message": "Upload started", "video_id": video_id}


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
    title:        str
    script:       str
    profile:      str = "educational"
    visual_mood:  Optional[str] = None   # ocean|candle|forest|stars|hands|mountains|None=auto
    music_style:  str = "ambient"


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
                cb=_cb,
            )
        except Exception as e:
            _push_log(video_id, f"[ERROR] {e}")
        finally:
            _push_log(video_id, "[DONE] Pipeline finished")
            _unregister_pipeline(video_id)

    background_tasks.add_task(_run)

    return {"video_id": video_id, "message": "Script pipeline started", "word_count": word_count}


# ── Stats & Quota ─────────────────────────────────────────────────────────────

@app.get("/stats")
def get_stats(user: str = Depends(verify_token)):
    return db.get_stats()


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
                music_style="ambient",
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
    enabled:  bool
    days:     list
    topics:   list
    hour:     int
    ambience: str = "aurora"

@app.get("/auto-short/settings")
def get_auto_short_settings_endpoint(user: str = Depends(verify_token)):
    from pipeline.auto_generator import get_auto_short_settings
    return get_auto_short_settings()

@app.post("/auto-short/settings")
def save_auto_short_settings_endpoint(req: AutoShortSettings, user: str = Depends(verify_token)):
    from pipeline.auto_generator import save_auto_short_settings
    settings = {
        "enabled":  req.enabled,
        "days":     req.days,
        "topics":   req.topics,
        "hour":     req.hour,
        "ambience": req.ambience,
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

    topic    = _pick_next_short_topic(topics)
    ambience = settings.get("ambience", "aurora")

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
            run_short_pipeline(prompt=topic, ambience=ambience, video_id=video_id, cb=_cb)
            _push_log(video_id, "[DONE] Short pipeline finished — ready for review")
        except Exception as e:
            _push_log(video_id, f"[ERROR] {e}")
        finally:
            _unregister_pipeline(video_id)

    threading.Thread(target=_run, daemon=True).start()
    return {"message": "Auto-short started", "video_id": video_id, "topic": topic}


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

    background_tasks.add_task(do_short)
    return {"message": "Short creation started", "video_id": video_id}


@app.post("/shorts/generate")
def generate_short(background_tasks: BackgroundTasks, body: dict, user: str = Depends(verify_token)):
    """Generate a brand-new YouTube Short from scratch (portrait 9:16)."""
    prompt = body.get("prompt", "")
    ambience = body.get("ambience", "stars")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt required")
    background_tasks.add_task(run_short_pipeline, prompt=prompt, ambience=ambience)
    return {"message": "Short pipeline started"}


def run_short_pipeline(prompt: str, ambience: str = "stars"):
    """Generate a YouTube Short from scratch — portrait 9:16, no auto-upload."""
    try:
        from pipeline.orchestrator import run_short_pipeline as _short_pipeline
        _short_pipeline(prompt=prompt, ambience=ambience)
    except Exception as e:
        print(f"❌ Short pipeline failed: {e}")


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
    """Kills any pipeline stuck for >20 min — runs as daemon thread."""
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
                            if age_mins > 20:
                                print(f"⏰ Watchdog: {vid[:8]} stuck {age_mins:.0f}min — cancelling")
                                with _pipeline_lock:
                                    entry = _active_pipelines.get(vid)
                                    if entry: entry["cancelled"] = True
                                _push_log(vid, "[ERROR] Watchdog: pipeline timed out (20 min limit)")
                                db.set_failed(vid, "Timed out — cancelled by watchdog after 20 minutes")
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

    def run():
        if req.mode == "mp3":
            from pipeline.compiler import create_mp3_compilation as _compile_mp3
            _compile_mp3(compilation_id=comp_id, clips=clips_data, title=req.title)
        else:
            from pipeline.compiler import create_compilation as _compile
            _compile(compilation_id=comp_id, clips=clips_data, title=req.title)

    background_tasks.add_task(run)
    return {"compilation_id": comp_id, "message": "Compilation started", "clip_count": len(req.clips)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)