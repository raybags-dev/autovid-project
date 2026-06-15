"""
AutoVid Pipeline — Step 7: YouTube Uploader

Uploads videos to YouTube using the YouTube Data API v3.
Handles OAuth2 authentication with token refresh.

FIRST-TIME SETUP:
  1. Go to https://console.cloud.google.com
  2. Create project → Enable "YouTube Data API v3"
  3. Create OAuth 2.0 credentials (Desktop application type)
  4. Download → save as client_secrets.json in project root
  5. Run this file directly once: python youtube_uploader.py
     → A browser window opens for you to authorize
     → Token saved to youtube_token.json (auto-refreshes forever)

QUOTA: 10,000 units/day free. Each upload costs ~1,600 units.
       = ~6 uploads/day. Apply for quota increase (free, takes 2-3 days).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import json
import os
import time
from pathlib import Path
from typing import Optional

import config

try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    from googleapiclient.http import MediaFileUpload
    YOUTUBE_AVAILABLE = True
except ImportError:
    YOUTUBE_AVAILABLE = False
    print("⚠️  YouTube libraries not installed. Run: pip install google-api-python-client google-auth-oauthlib")

import os as _os

# Must be set before ANY oauth call — prevents crash when Google returns
# a subset of requested scopes (e.g. after adding new scopes to consent screen)
_os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",     # Upload videos
    "https://www.googleapis.com/auth/youtube",            # Manage account (delete, comments)
    "https://www.googleapis.com/auth/youtube.readonly",   # Read stats, comments, metadata
    "https://www.googleapis.com/auth/youtube.force-ssl",  # Required for comments API
]

# YouTube category IDs
CATEGORY_MAP = {
    "Entertainment": "24",
    "Comedy": "23",
    "Education": "27",
    "Technology": "28",
    "Science": "28",
    "Gaming": "20",
    "Music": "10",
    "Lifestyle": "22",
    "Travel": "19",
    "Food": "26",
    "Sports": "17",
    "News": "25",
}



# ── Auth ──────────────────────────────────────────────────────────────────────

def get_authenticated_service():
    """
    Authenticate with YouTube — pure manual code flow.
    No local server, no redirect URI, works everywhere.
    """
    if not YOUTUBE_AVAILABLE:
        raise RuntimeError("YouTube libraries not installed")

    creds        = None
    token_path   = Path(config.YOUTUBE_TOKEN_PATH)
    secrets_path = Path(config.YOUTUBE_CLIENT_SECRETS_PATH)

    if not secrets_path.exists():
        raise FileNotFoundError(f"client_secrets.json not found at {secrets_path}")

    # Load saved token
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("🔄 Refreshing YouTube token...")
            creds.refresh(Request())
        else:
            # Use InstalledAppFlow with local redirect server.
            # OOB (urn:ietf:wg:oauth:2.0:oob) is deprecated — Google strips scopes with it.
            # InstalledAppFlow spins up a temporary local server on port 8085 to catch the redirect.
            from google_auth_oauthlib.flow import InstalledAppFlow

            flow = InstalledAppFlow.from_client_secrets_file(
                str(secrets_path),
                scopes=SCOPES,
            )

            print("\n" + "="*60)
            print("🔐 YOUTUBE AUTHORIZATION")
            print("="*60)
            print("A browser window will open. Log in and click ALLOW.")
            print("If no browser opens, copy the URL that prints below.")
            print("Listening on http://localhost:8085 for the callback...")
            print("="*60 + "\n")

            creds = flow.run_local_server(
                port=8085,
                prompt="consent",
                access_type="offline",
                open_browser=True,
            )

        with open(token_path, "w") as f:
            f.write(creds.to_json())
        print(f"\n✅ Token saved → {token_path}")
        print("   Authentication complete — won't need this again!\n")

    return build("youtube", "v3", credentials=creds)

def upload_video(
    video_path: str,
    title: str,
    description: str,
    labels: list[str],
    category: str = "Entertainment",
    thumbnail_path: Optional[str] = None,
    privacy: str = "public",      # "public" | "unlisted" | "private"
) -> dict:
    """
    Upload a video to YouTube.

    Args:
        video_path: Path to the MP4 file
        title: YouTube video title (max 100 chars)
        description: YouTube description (max 5000 chars)
        labels: Tags list (max 500 chars total)
        category: Content category
        thumbnail_path: Optional custom thumbnail JPG/PNG
        privacy: "public", "unlisted", or "private"

    Returns:
        {"youtube_id": str, "youtube_url": str}
    """
    service = get_authenticated_service()

    # Truncate title/description to YouTube limits
    title = title[:100]
    description = description[:5000]
    tags = labels[:500]  # YouTube limits total tag length

    category_id = CATEGORY_MAP.get(category, "24")  # Default: Entertainment

    body = {
        "snippet": {
            "title": title,
            "description": f"{description}\n\n#AutoVid #AI #Generated\n\nTags: {', '.join(labels)}",
            "tags": tags + ["funny", "AI generated", "comedy"],
            "categoryId": category_id,
            "defaultLanguage": "en",
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }

    # If video_path is a remote URL (Supabase Storage), download it to a temp file first
    import tempfile
    import urllib.request
    _temp_file = None
    actual_path = video_path

    if video_path.startswith("http://") or video_path.startswith("https://"):
        print(f"⬇️  Downloading from storage: {video_path[:60]}...")
        _temp_file = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        urllib.request.urlretrieve(video_path, _temp_file.name)
        actual_path = _temp_file.name
        print(f"   Downloaded to temp: {actual_path}")

    media = MediaFileUpload(
        actual_path,
        mimetype="video/mp4",
        resumable=True,
        chunksize=1024 * 1024 * 5,  # 5MB chunks
    )

    print(f"🚀 Uploading to YouTube: '{title}'")
    print(f"   File: {Path(actual_path).name} ({os.path.getsize(actual_path) / 1024 / 1024:.1f} MB)")
    print(f"   Privacy: {privacy}")

    request = service.videos().insert(
        part=",".join(body.keys()),
        body=body,
        media_body=media,
    )

    response = None
    upload_start = time.time()

    while response is None:
        try:
            status, response = request.next_chunk()
            if status:
                pct = int(status.progress() * 100)
                elapsed = time.time() - upload_start
                print(f"   📤 Uploading... {pct}% ({elapsed:.0f}s elapsed)", end="\r")
        except HttpError as e:
            if e.resp.status in [500, 502, 503, 504]:
                print(f"\n⚠️  Server error {e.resp.status}, retrying in 5s...")
                time.sleep(5)
            else:
                raise

    youtube_id = response["id"]
    youtube_url = f"https://www.youtube.com/watch?v={youtube_id}"

    print(f"\n✅ Uploaded! ID: {youtube_id}")
    print(f"   URL: {youtube_url}")

    # Upload custom thumbnail if provided
    if thumbnail_path and os.path.exists(thumbnail_path):
        _upload_thumbnail(service, youtube_id, thumbnail_path)

    # Clean up temp file if we downloaded from storage
    if _temp_file:
        import os as _os
        try: _os.unlink(_temp_file.name)
        except: pass

    return {"youtube_id": youtube_id, "youtube_url": youtube_url}


def _upload_thumbnail(service, video_id: str, thumbnail_path: str):
    """Upload a custom thumbnail to an uploaded video."""
    try:
        service.thumbnails().set(
            videoId=video_id,
            media_body=MediaFileUpload(thumbnail_path),
        ).execute()
        print("📸 Thumbnail uploaded")
    except Exception as e:
        print(f"⚠️  Thumbnail upload failed: {e}")


# ── Quota Check ───────────────────────────────────────────────────────────────

def check_quota_status() -> dict:
    """
    A rough quota tracker stored locally.
    YouTube doesn't expose quota usage via API directly.
    """
    quota_file = Path("./youtube_quota.json")
    today = time.strftime("%Y-%m-%d")

    if quota_file.exists():
        data = json.loads(quota_file.read_text())
        if data.get("date") != today:
            data = {"date": today, "uploads": 0, "units_used": 0}
    else:
        data = {"date": today, "uploads": 0, "units_used": 0}

    return {
        "date": today,
        "uploads_today": data["uploads"],
        "units_used": data["units_used"],
        "units_remaining": 10000 - data["units_used"],
        "uploads_remaining": (10000 - data["units_used"]) // 1600,
    }


def record_upload():
    """Track quota usage after each upload."""
    quota_file = Path("./youtube_quota.json")
    today = time.strftime("%Y-%m-%d")
    data = json.loads(quota_file.read_text()) if quota_file.exists() else {"date": today, "uploads": 0, "units_used": 0}
    if data.get("date") != today:
        data = {"date": today, "uploads": 0, "units_used": 0}
    data["uploads"] += 1
    data["units_used"] += 1600
    quota_file.write_text(json.dumps(data))


# ── CLI Auth Setup ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("🔐 YouTube OAuth Setup")
    print("This will open a browser window for you to authorize AutoVid.")
    print("You only need to do this ONCE — token is saved automatically.\n")
    service = get_authenticated_service()
    print("\n✅ YouTube authentication successful!")
    quota = check_quota_status()
    print(f"📊 Quota today: {quota['units_used']}/10000 units used, {quota['uploads_remaining']} uploads remaining")


# ── YouTube Management ────────────────────────────────────────────────────────

def delete_youtube_video(youtube_id: str) -> bool:
    """Delete a video from YouTube by its ID."""
    service = get_authenticated_service()
    service.videos().delete(id=youtube_id).execute()
    print(f"🗑️  Deleted YouTube video: {youtube_id}")
    return True


def get_video_details(youtube_id: str) -> dict:
    """Fetch full metadata + stats for a YouTube video."""
    service = get_authenticated_service()
    resp = service.videos().list(
        part="snippet,statistics,status,contentDetails",
        id=youtube_id
    ).execute()
    items = resp.get("items", [])
    if not items:
        return {}
    item = items[0]
    snippet    = item.get("snippet", {})
    stats      = item.get("statistics", {})
    status     = item.get("status", {})
    content    = item.get("contentDetails", {})
    return {
        "youtube_id":    youtube_id,
        "title":         snippet.get("title", ""),
        "description":   snippet.get("description", ""),
        "tags":          snippet.get("tags", []),
        "category_id":   snippet.get("categoryId", ""),
        "published_at":  snippet.get("publishedAt", ""),
        "thumbnail_url": snippet.get("thumbnails", {}).get("maxres", snippet.get("thumbnails", {}).get("high", {})).get("url", ""),
        "privacy":       status.get("privacyStatus", ""),
        "duration":      content.get("duration", ""),
        "views":         int(stats.get("viewCount",    0)),
        "likes":         int(stats.get("likeCount",    0)),
        "dislikes":      int(stats.get("dislikeCount", 0)),
        "comments":      int(stats.get("commentCount", 0)),
        "favorites":     int(stats.get("favoriteCount",0)),
    }


def get_video_comments(youtube_id: str, max_results: int = 50) -> list:
    """
    Fetch top-level comments for a YouTube video.
    Also fetches existing replies per thread so we can check if
    we already replied — preventing duplicate responses.
    """
    service = get_authenticated_service()
    comments = []
    try:
        resp = service.commentThreads().list(
            part="snippet,replies",
            videoId=youtube_id,
            maxResults=min(max_results, 100),
            order="relevance"
        ).execute()
        for item in resp.get("items", []):
            top         = item["snippet"]["topLevelComment"]["snippet"]
            reply_count = item["snippet"].get("totalReplyCount", 0)

            # Collect authors who already replied in this thread
            existing_reply_authors = set()
            for reply in item.get("replies", {}).get("comments", []):
                r_author_id = reply["snippet"].get("authorChannelId", {}).get("value", "")
                r_author    = reply["snippet"].get("authorDisplayName", "")
                existing_reply_authors.add(r_author_id)
                existing_reply_authors.add(r_author.lower())

            comments.append({
                "id":                     item["id"],
                "author":                 top.get("authorDisplayName", ""),
                "author_channel_id":      top.get("authorChannelId", {}).get("value", ""),
                "author_image":           top.get("authorProfileImageUrl", ""),
                "text":                   top.get("textDisplay", ""),
                "likes":                  top.get("likeCount", 0),
                "published_at":           top.get("publishedAt", ""),
                "reply_count":            reply_count,
                "existing_reply_authors": existing_reply_authors,  # set of channel IDs/names
            })
    except Exception as e:
        print(f"⚠️  Could not fetch comments: {e}")
        raise  # re-raise so caller can handle quota errors
    return comments


def post_youtube_comment(youtube_id: str, text: str) -> dict:
    """Post a comment on a YouTube video."""
    service = get_authenticated_service()
    resp = service.commentThreads().insert(
        part="snippet",
        body={
            "snippet": {
                "videoId": youtube_id,
                "topLevelComment": {
                    "snippet": {"textOriginal": text}
                }
            }
        }
    ).execute()
    return {
        "comment_id": resp["id"],
        "text": text,
    }


def delete_youtube_comment(comment_id: str) -> bool:
    """Delete a comment by its ID."""
    service = get_authenticated_service()
    service.comments().delete(id=comment_id).execute()
    return True


def reply_to_comment(thread_id: str, text: str) -> dict:
    """Post a reply to an existing top-level comment thread."""
    service = get_authenticated_service()
    resp = service.comments().insert(
        part="snippet",
        body={
            "snippet": {
                "parentId": thread_id,
                "textOriginal": text,
            }
        }
    ).execute()
    snippet = resp.get("snippet", {})
    return {
        "comment_id": resp["id"],
        "text": snippet.get("textDisplay", text),
        "author": snippet.get("authorDisplayName", ""),
        "published_at": snippet.get("publishedAt", ""),
    }


def moderate_comment(comment_id: str, status: str, ban_author: bool = False) -> bool:
    """
    Set moderation status on a comment.
    status: 'heldForReview' | 'published' | 'rejected'
    ban_author: if True and status='rejected', bans the author
    """
    service = get_authenticated_service()
    service.comments().setModerationStatus(
        id=comment_id,
        moderationStatus=status,
        banAuthor=ban_author,
    ).execute()
    return True
