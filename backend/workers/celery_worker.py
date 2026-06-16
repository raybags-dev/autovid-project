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
    task_soft_time_limit=5400,         # 90 minute soft limit per video
    task_time_limit=7200,              # 120 minute hard limit
    task_default_queue="autovid",      # Named queue — worker only picks from this queue
    task_routes={
        "workers.celery_worker.*": {"queue": "autovid"},
    },
)

# ── Scheduled Tasks ───────────────────────────────────────────────────────────

celery_app.conf.beat_schedule = {
    "auto-upload-ready-videos": {
        "task": "workers.celery_worker.auto_upload_ready_videos",
        "schedule": crontab(minute="*/30"),
    },
    "sync-youtube-stats": {
        "task": "workers.celery_worker.sync_youtube_stats",
        "schedule": crontab(hour="*/6"),
    },
    "cleanup-expired-trials": {
        "task": "workers.celery_worker.cleanup_expired_trials",
        "schedule": crontab(minute="*/30"),
    },
    "send-trial-expiry-warnings": {
        "task": "workers.celery_worker.send_trial_expiry_warnings",
        "schedule": crontab(hour="*/6"),
    },
    "process-account-deletions": {
        "task": "workers.celery_worker.process_account_deletions",
        "schedule": crontab(minute="0"),  # hourly
    },
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _auto_create_blog_post(video_id: str, video_data: dict):
    """Create a draft blog post from a completed video (called when auto_blog_post_enabled=true)."""
    import re
    import unicodedata
    from datetime import datetime, timezone
    import database as db

    # Skip if a blog post already exists for this video
    existing_video = db.get_video(video_id)
    if not existing_video or existing_video.get("blog_post_id"):
        return

    title   = video_data.get("title") or existing_video.get("title") or "Untitled"
    desc    = video_data.get("description") or existing_video.get("description") or ""
    script  = video_data.get("script") or existing_video.get("script") or ""
    yt_url  = video_data.get("youtube_url") or existing_video.get("youtube_url") or ""
    yt_id   = video_data.get("youtube_id") or existing_video.get("youtube_id") or ""
    labels  = existing_video.get("labels") or []

    embed_block = (
        f'\n\n<div class="blog-video-embed">'
        f'<iframe src="https://www.youtube.com/embed/{yt_id}" '
        f'frameborder="0" allowfullscreen></iframe></div>\n'
    ) if yt_id else ""

    intro          = f"<p>{desc}</p>" if desc else ""
    script_section = f"<h2>Full Script</h2>\n<p>{script.replace(chr(10), '</p><p>')}</p>" if script else ""
    body_text      = f"{intro}{embed_block}\n{script_section}".strip()

    slug = re.sub(
        r"[^a-z0-9]+", "-",
        unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()
    ).strip("-") or f"post-{int(datetime.now().timestamp())}"
    try:
        db.get_blog_post_by_slug(slug)
        slug = f"{slug}-{int(datetime.now().timestamp())}"
    except Exception:
        pass

    post_data = {
        "title":           title,
        "slug":            slug,
        "excerpt":         (desc or script)[:300],
        "body":            body_text,
        "cover_image_url": existing_video.get("thumbnail_url") or "",
        "tags":            labels,
        "status":          "draft",
        "video_id":        video_id,
        "youtube_url":     yt_url,
        "published_at":    None,
    }
    post = db.create_blog_post(post_data)
    try:
        db.update_video(video_id, blog_post_id=post["id"])
    except Exception as e:
        print(f"⚠️  Could not set blog_post_id: {e}")
    print(f"📝 Auto-created blog draft '{title}' for video {video_id[:8]}")


# ── Tasks ─────────────────────────────────────────────────────────────────────

@celery_app.task(bind=True, name="workers.celery_worker.run_video_pipeline")
def run_video_pipeline(
    self,
    prompt: str,
    auto_upload: bool = True,
    profile: str = "educational",
    visual_mood: str = None,
    music_style: str = "ambient",
    music_volume: float = 0.06,
    video_id: str = None,
):
    """
    Celery task: Run the full video generation pipeline.
    Queues jobs so multiple requests are processed one at a time.
    """
    from pipeline.orchestrator import run_pipeline

    self.update_state(state="STARTED", meta={"prompt": prompt, "step": "initializing", "video_id": video_id})

    try:
        result = run_pipeline(
            prompt=prompt,
            auto_upload=auto_upload,
            profile=profile,
            visual_mood=visual_mood,
            music_style=music_style,
            music_volume=music_volume,
            video_id=video_id,
        )
        # Auto-create blog post if the setting is enabled
        try:
            import database as db
            auto_blog = db.get_setting("auto_blog_post_enabled", default="false")
            if str(auto_blog).lower() == "true":
                _auto_create_blog_post(result["id"], result)
        except Exception as blog_err:
            print(f"⚠️  Auto-blog post failed for {result['id'][:8]}: {blog_err}")
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
    from pipeline.youtube_uploader import (
        check_quota_status,
        record_upload,
        upload_video,
    )

    quota = check_quota_status()
    max_uploads = quota["uploads_remaining"]

    if max_uploads <= 0:
        print("📊 YouTube quota exhausted for today. Skipping auto-upload.")
        return {"uploaded": 0, "reason": "quota_exhausted"}

    ready_videos = db.list_videos(status="ready", limit=max_uploads)
    # Never auto-upload subscriber-owned videos to the admin's YouTube channel
    ready_videos = [v for v in ready_videos if "subscriber_video" not in (v.get("labels") or [])]
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
                privacy="private",
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


@celery_app.task(bind=True, name="workers.celery_worker.run_subscriber_video_pipeline")
def run_subscriber_video_pipeline(self, video_id: str, user_id: str, topic: str, style: str = "educational"):
    """
    Celery task: Generate a subscriber-owned video.
    - auto_upload=False (never posts to YouTube)
    - Trial limit: enforced before queuing in the API layer
    """
    import database as db
    from pipeline.orchestrator import run_pipeline

    self.update_state(state="STARTED", meta={"topic": topic, "video_id": video_id, "step": "initializing"})

    try:
        profile = style if style in ("educational", "serious", "inspirational", "reflective", "funny") else "educational"
        result = run_pipeline(
            prompt=topic,
            auto_upload=False,
            profile=profile,
            music_style="ambient",
            music_volume=0.05,
            video_id=video_id,
        )
        # Increment videos_created counter on the subscription user
        user = db.get_subscription_user_by_id(user_id)
        if user:
            current = user.get("videos_created") or 0
            db.update_subscription_user(user_id, videos_created=current + 1)

            # Auto-upload to subscriber's own YouTube if they've connected their account
            if user.get("youtube_oauth_token"):
                try:
                    from pipeline.youtube_uploader import upload_with_user_tokens
                    yt_result = upload_with_user_tokens(
                        tokens_json=user["youtube_oauth_token"],
                        video_path=result.get("file_path") or "",
                        title=result.get("title") or topic,
                        description=(
                            "Auto-generated with AutoVid — your AI video automation platform.\n\n"
                            "This is a private draft. Review it and publish when you're ready."
                        ),
                        privacy="private",
                    )
                    db.update_video(
                        result["id"],
                        youtube_id=yt_result.get("youtube_id"),
                        youtube_url=yt_result.get("youtube_url"),
                        status="posted",
                    )
                    if "updated_tokens" in yt_result:
                        db.update_subscription_user(user_id, youtube_oauth_token=yt_result["updated_tokens"])
                    print(f"✅ Subscriber video uploaded: {yt_result.get('youtube_url')}")
                except Exception as yt_err:
                    print(f"⚠️  Subscriber YouTube upload failed (video still available): {yt_err}")

            # Email notification
            try:
                import pipeline.email as email_svc
                email_svc.send_video_ready_notification(user["email"], result.get("title") or topic)
            except Exception:
                pass
        return {"status": "success", "video_id": result["id"], "title": result.get("title")}
    except Exception as e:
        db.set_failed(video_id, str(e)[:500])
        self.update_state(state="FAILURE", meta={"error": str(e)})
        raise


@celery_app.task(name="workers.celery_worker.cleanup_expired_trials")
def cleanup_expired_trials():
    """
    Scheduled: expire trial accounts past their trial_expires_at timestamp.
    Runs every 30 minutes.
    """
    import database as db
    expired = db.expire_old_trials()
    return {"expired": expired}


@celery_app.task(name="workers.celery_worker.send_trial_expiry_warnings")
def send_trial_expiry_warnings():
    """
    Scheduled: email subscribers whose trial expires within 24 hours.
    Runs every 6 hours.
    """
    import database as db
    import pipeline.email as email_svc

    expiring = db.get_trials_expiring_soon(hours=24)
    sent = 0
    for user in expiring:
        try:
            email_svc.send_trial_expiry_warning(user["email"], user.get("trial_expires_at", ""))
            sent += 1
        except Exception as e:
            print(f"[trial-warn] Failed to email {user['email']}: {e}")
    return {"warned": sent}


@celery_app.task(name="workers.celery_worker.process_account_deletions")
def process_account_deletions():
    """
    Scheduled: permanently delete accounts that have passed their 24-hour deletion window.
    Runs every hour. Requires Supabase migration to add deletion_status/deletion_scheduled_at columns.
    """
    import datetime
    import database as db

    try:
        client = db.get_client()
        result = client.table("subscription_users").select("*").eq("deletion_status", "pending_deletion").execute()
        users = result.data or []
        deleted = 0
        now = datetime.datetime.now(datetime.timezone.utc)
        for user in users:
            scheduled = user.get("deletion_scheduled_at")
            if not scheduled:
                continue
            try:
                deletion_time = datetime.datetime.fromisoformat(scheduled.replace("Z", "+00:00"))
                if now >= deletion_time:
                    uid = user["id"]
                    # Delete all subscriber videos
                    client.table("subscriber_videos").delete().eq("subscriber_user_id", uid).execute()
                    # Delete the account
                    client.table("subscription_users").delete().eq("id", uid).execute()
                    deleted += 1
                    print(f"[deletion] Deleted account {uid} ({user.get('email', '?')})")
            except Exception as e:
                print(f"[deletion] Failed to process user {user.get('id')}: {e}")
        return {"deleted": deleted}
    except Exception as e:
        # Likely means migration hasn't been run yet — not an error
        print(f"[deletion] Task skipped (migration may not be run): {e}")
        return {"deleted": 0, "note": str(e)}
