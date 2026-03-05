"""
AutoVid — Celery Background Workers

Handles async pipeline execution and scheduled tasks.

Start worker:
  celery -A workers.celery_worker worker --loglevel=info

Start beat scheduler (for auto-posting on schedule):
  celery -A workers.celery_worker beat --loglevel=info

Redis must be running:
  redis-server   (or: brew services start redis on macOS)
"""
from celery import Celery
from celery.schedules import crontab
import config

# ── App ───────────────────────────────────────────────────────────────────────

celery_app = Celery(
    "autovid",
    broker=config.REDIS_URL,
    backend=config.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,               # Don't ack until task completes (retry on crash)
    worker_prefetch_multiplier=1,      # One task at a time per worker (videos are heavy)
    task_soft_time_limit=600,          # 10 minute soft limit per video
    task_time_limit=900,               # 15 minute hard limit
)

# ── Scheduled Tasks ───────────────────────────────────────────────────────────

celery_app.conf.beat_schedule = {
    # Auto-upload any 'ready' videos that haven't been uploaded yet
    # Runs every 30 minutes
    "auto-upload-ready-videos": {
        "task": "workers.celery_worker.auto_upload_ready_videos",
        "schedule": crontab(minute="*/30"),
    },
    # Sync view/like counts from YouTube (runs every 6 hours)
    "sync-youtube-stats": {
        "task": "workers.celery_worker.sync_youtube_stats",
        "schedule": crontab(hour="*/6"),
    },
}


# ── Tasks ─────────────────────────────────────────────────────────────────────

@celery_app.task(bind=True, name="workers.celery_worker.run_video_pipeline")
def run_video_pipeline(self, prompt: str, auto_upload: bool = True):
    """
    Celery task: Run the full video generation pipeline.
    Call this from FastAPI instead of background_tasks for better reliability.
    """
    from pipeline.orchestrator import run_pipeline

    # Update task state so frontend can poll progress
    self.update_state(state="STARTED", meta={"prompt": prompt, "step": "initializing"})

    try:
        result = run_pipeline(prompt, auto_upload=auto_upload)
        return {"status": "success", "video_id": result["id"], "title": result.get("title")}
    except Exception as e:
        self.update_state(state="FAILURE", meta={"error": str(e)})
        raise


@celery_app.task(name="workers.celery_worker.auto_upload_ready_videos")
def auto_upload_ready_videos():
    """
    Scheduled task: Upload all 'ready' videos to YouTube.
    Respects daily quota limit (~6 uploads/day on free tier).
    """
    import database as db
    from pipeline.youtube_uploader import upload_video, check_quota_status, record_upload

    quota = check_quota_status()
    max_uploads = quota["uploads_remaining"]

    if max_uploads <= 0:
        print("📊 YouTube quota exhausted for today. Skipping auto-upload.")
        return {"uploaded": 0, "reason": "quota_exhausted"}

    ready_videos = db.list_videos(status="ready", limit=max_uploads)
    if not ready_videos:
        print("✅ No ready videos to upload.")
        return {"uploaded": 0}

    uploaded = 0
    for video in ready_videos[:max_uploads]:
        try:
            print(f"🚀 Auto-uploading: {video['title']}")
            result = upload_video(
                video_path=video["file_path"],
                title=video["title"] or "AutoVid Video",
                description=video.get("description") or "",
                labels=video.get("labels") or [],
                category=video.get("category") or "Entertainment",
                thumbnail_path=video.get("thumbnail_url"),
            )
            db.set_posted(video["id"], result["youtube_id"], result["youtube_url"])
            record_upload()
            uploaded += 1
            print(f"✅ Uploaded: {result['youtube_url']}")
        except Exception as e:
            print(f"❌ Failed to upload {video['id']}: {e}")
            db.set_failed(video["id"], f"Upload failed: {str(e)}")

    return {"uploaded": uploaded}


@celery_app.task(name="workers.celery_worker.sync_youtube_stats")
def sync_youtube_stats():
    """
    Scheduled task: Pull view/like counts from YouTube API and update DB.
    """
    import database as db
    from pipeline.youtube_uploader import get_authenticated_service

    posted_videos = db.list_videos(status="posted", limit=50)
    if not posted_videos:
        return {"synced": 0}

    try:
        service = get_authenticated_service()
    except Exception as e:
        print(f"⚠️  YouTube auth failed for stats sync: {e}")
        return {"synced": 0, "error": str(e)}

    video_ids = [v["youtube_id"] for v in posted_videos if v.get("youtube_id")]

    if not video_ids:
        return {"synced": 0}

    # YouTube API: batch fetch stats (max 50 per request)
    response = service.videos().list(
        part="statistics",
        id=",".join(video_ids[:50]),
    ).execute()

    synced = 0
    for item in response.get("items", []):
        yt_id = item["id"]
        stats = item.get("statistics", {})
        views = int(stats.get("viewCount", 0))
        likes = int(stats.get("likeCount", 0))

        # Find matching DB record
        matching = [v for v in posted_videos if v["youtube_id"] == yt_id]
        for video in matching:
            db.update_video(video["id"], views_count=views, likes_count=likes)
            synced += 1

    print(f"📊 Synced stats for {synced} videos")
    return {"synced": synced}