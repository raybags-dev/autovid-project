"""
AutoVid — FastAPI Backend
Main application entry point with all API routes.
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
import jwt
import time

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
    allow_origins=["*"],
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
    profile: str = "funny"  # funny | serious | educational | inspirational


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
    background_tasks.add_task(run_pipeline, prompt=req.prompt, auto_upload=req.auto_upload, profile=req.profile)
    return {"message": "Pipeline started", "prompt": req.prompt, "status": "generating"}


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


@app.post("/videos/{video_id}/upload")
def upload_to_youtube(video_id: str, background_tasks: BackgroundTasks, user: str = Depends(verify_token)):
    """Manually trigger YouTube upload for a ready video."""
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video["status"] != "ready":
        raise HTTPException(status_code=400, detail=f"Video must be ready (current: {video['status']})")

    def do_upload():
        import urllib.request, tempfile, os as _os
        from pathlib import Path as _P
        temp_dl = None
        try:
            db.set_status(video_id, "uploading")
            file_path = video["file_path"]

            # If file_path is a local path that no longer exists, try to find it
            if file_path and not file_path.startswith("http") and not _P(file_path).exists():
                # Search output dir for any matching video file for this video_id
                import config as _cfg
                candidates = list(_cfg.VIDEOS_OUTPUT_DIR.glob(f"{video_id}*.mp4"))
                if candidates:
                    file_path = str(candidates[0])
                    print(f"⚠️  Original path missing, found: {_P(file_path).name}")
                    db.update_video(video_id, file_path=file_path)
                else:
                    raise FileNotFoundError(
                        f"No video file found for {video_id[:8]}. "
                        "The file was cleaned up before upload. Please regenerate the video."
                    )

            from pipeline.youtube_uploader import upload_video
            result = upload_video(
                video_path=file_path,
                title=video["title"],
                description=video["description"] or "",
                labels=video["labels"] or [],
                category=video["category"] or "Entertainment",
                thumbnail_path=video.get("thumbnail_url"),
            )
            db.set_posted(video_id, result["youtube_id"], result["youtube_url"])
            print(f"✅ Posted: {result['youtube_url']}")

            # Delete local video file after successful YouTube upload to save disk space
            if file_path and not file_path.startswith("http"):
                local = _P(file_path)
                if local.exists():
                    local.unlink()
                    print(f"🗑  Local file deleted after YouTube upload: {local.name}")

        except Exception as e:
            db.set_failed(video_id, f"YouTube upload failed: {e}")
            print(f"❌ Upload failed: {e}")

    background_tasks.add_task(do_upload)
    return {"message": "Upload started", "video_id": video_id}


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
    visual_style: str = "gradient_wave"
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

    from pipeline.script_pipeline import run_script_pipeline
    background_tasks.add_task(
        run_script_pipeline,
        video_id=video_id,
        title=req.title,
        script=req.script,
        profile=req.profile,
        visual_style=req.visual_style,
        music_style=req.music_style,
    )

    return {"video_id": video_id, "message": "Script pipeline started", "word_count": word_count}


# ── Stats & Quota ─────────────────────────────────────────────────────────────

@app.get("/stats")
def get_stats(user: str = Depends(verify_token)):
    return db.get_stats()


@app.get("/quota")
def get_quota(user: str = Depends(verify_token)):
    return check_quota_status()


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
        result["elevenlabs"] = {
            "tier": getattr(sub, "tier", "unknown"),
            "chars_used": getattr(sub, "character_count", 0),
            "chars_limit": getattr(sub, "character_limit", 0),
            "chars_remaining": getattr(sub, "character_limit", 0) - getattr(sub, "character_count", 0),
            "percent_used": round(getattr(sub, "character_count", 0) / max(getattr(sub, "character_limit", 1), 1) * 100, 1),
            "next_reset": getattr(sub, "next_character_count_reset_unix", None),
            "status": "ok",
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
        result["supabase"] = {
            "project_url": config.SUPABASE_URL,
            "videos_in_db": videos_count,
            "storage_limit_mb": 1000,  # free tier
            "db_limit_mb": 500,        # free tier
            "note": "Supabase free tier — 500MB DB, 1GB Storage",
            "status": "ok",
        }
    except Exception as e:
        result["supabase"] = {"status": "error", "error": str(e)}

    # ── Groq ──────────────────────────────────────────────────────────────────
    result["groq"] = {
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "note": "Groq free tier — 6,000 tokens/min, 500K tokens/day",
        "status": "ok",
        "pricing": "Free",
    }

    # ── Pexels ────────────────────────────────────────────────────────────────
    result["pexels"] = {
        "note": "Pexels API — free, 200 requests/hour, 20,000/month",
        "status": "ok",
        "pricing": "Free",
    }

    return result


# ── Channel Management Routes ────────────────────────────────────────────────

@app.get("/channel/videos")
def get_channel_videos(user: str = Depends(verify_token)):
    """Fetch all videos from the authenticated YouTube channel."""
    from pipeline.youtube_uploader import get_authenticated_service
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
                # Parse ISO 8601 duration to readable
                dur = cd.get("duration", "")
                import re
                m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', dur)
                if m:
                    h, mi, s = m.groups()
                    parts = []
                    if h: parts.append(f"{h}h")
                    if mi: parts.append(f"{mi}m")
                    if s: parts.append(f"{s}s")
                    dur = " ".join(parts)

                thumbnails = sn.get("thumbnails", {})
                thumb = (thumbnails.get("high") or thumbnails.get("medium") or thumbnails.get("default") or {}).get("url")

                videos.append({
                    "id": item["id"],
                    "title": sn.get("title", ""),
                    "description": sn.get("description", ""),
                    "thumbnail": thumb,
                    "published_at": sn.get("publishedAt"),
                    "privacy": status.get("privacyStatus", "unknown"),
                    "views": int(st.get("viewCount", 0)),
                    "likes": int(st.get("likeCount", 0)),
                    "comments": int(st.get("commentCount", 0)),
                    "duration": dur,
                })

        next_page = res.get("nextPageToken")
        if not next_page:
            break

    return {"videos": videos, "total": len(videos)}


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

@app.post("/auto-comment/trigger")
def trigger_auto_comment(user: str = Depends(verify_token)):
    """Manually trigger one auto-comment cycle (for testing)."""
    from pipeline.auto_commenter import run_comment_cycle
    run_comment_cycle()
    return {"message": "Comment cycle triggered"}


@app.on_event("startup")
def startup():
    print("🚀 AutoVid API starting...")
    try:
        config.validate()
    except EnvironmentError as e:
        print(f"⚠️  Config warning: {e}")
    # Start auto-comment scheduler
    from pipeline.auto_commenter import start_scheduler
    start_scheduler()
    print("✅ AutoVid API ready → http://localhost:8000")
    print("   Docs: http://localhost:8000/docs")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
