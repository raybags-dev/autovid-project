# 🎬 AutoVid — AI YouTube Automation Engine

Generate, assemble, caption, and auto-upload funny videos to YouTube from a single prompt.

---

## 🏗️ Architecture

```
Prompt → Script (Groq) → Voice (Coqui TTS) → Clips (Pexels) 
      → Assembly (MoviePy) → Captions (Whisper) → Labels (Groq) → YouTube Upload
```

---

## ✅ Prerequisites

Install system dependencies first:

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y ffmpeg redis-server python3.11 python3.11-venv

# macOS (Homebrew)
brew install ffmpeg redis python@3.11
brew services start redis
```

---

## 🚀 Quick Start

### 1. Clone & Set Up Python Environment

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Note:** First install of Coqui TTS and Whisper is large (~2GB total). Be patient.

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys (see "Getting API Keys" below)
nano .env
```

### 3. Set Up Database (Supabase)

1. Go to https://supabase.com → New Project
2. Go to **SQL Editor** → Run this:

```sql
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
```

3. Copy your **Project URL** and **service_role key** into `.env`

### 4. Set Up YouTube OAuth (One-time)

```bash
# First: download client_secrets.json from Google Cloud Console
# (see "Getting API Keys" → YouTube section below)

python pipeline/youtube_uploader.py
# → Browser opens → Log in with your YouTube account → Authorize
# → youtube_token.json saved automatically
```

### 5. Test the Pipeline (No Upload)

```bash
python pipeline/orchestrator.py "A cat explains quantum physics"
```

### 6. Start the API Server

```bash
uvicorn main:app --reload --port 8000
# API docs: http://localhost:8000/docs
```

### 7. Start the Background Worker

```bash
# In a separate terminal:
celery -A workers.celery_worker worker --loglevel=info

# Optional: Start the scheduler for auto-uploads
celery -A workers.celery_worker beat --loglevel=info
```

### 8. Start the Frontend

```bash
cd ../frontend
npm install
npm run dev
# App: http://localhost:5173
```

---

## 🔑 Getting API Keys

### Groq (LLM — Free)
1. https://console.groq.com → Sign up
2. API Keys → Create key
3. **Free tier:** 14,400 requests/day, 6,000 tokens/min

### Pexels (Stock Videos — Free)
1. https://www.pexels.com/api/ → Sign up
2. Instant API key in dashboard
3. **Free tier:** 200 requests/hour, unlimited/month

### Pixabay (Fallback — Free)
1. https://pixabay.com/api/docs/ → Sign up
2. API key in account settings
3. **Free tier:** 100 requests/min

### YouTube Data API v3
1. Go to https://console.cloud.google.com
2. Create New Project → Name it "AutoVid"
3. APIs & Services → Enable APIs → Search "YouTube Data API v3" → Enable
4. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: **Desktop app** → Name it "AutoVid" → Create
6. Download JSON → Save as `client_secrets.json` in `/backend`
7. Run `python pipeline/youtube_uploader.py` for one-time auth

**Free quota:** 10,000 units/day (~6 uploads/day)
**Get more quota:** Apply at console.cloud.google.com → Quotas → YouTube Data API → Request increase (free, 2-3 days)

### Supabase (Database — Free)
1. https://supabase.com → New Project
2. Settings → API → Copy **Project URL** and **service_role key**
3. **Free tier:** 500MB DB, 2GB storage, 50K auth users

### ElevenLabs (Optional — Better TTS)
1. https://elevenlabs.io → Sign up
2. Profile → API Key
3. **Free tier:** 10,000 characters/month
4. Set `TTS_ENGINE=elevenlabs` in `.env`

---

## 📁 Project Structure

```
backend/
├── main.py                    # FastAPI app + all routes
├── config.py                  # Environment config loader
├── database.py                # Supabase CRUD operations
├── requirements.txt
├── .env.example               # Copy to .env and fill in keys
├── client_secrets.json        # YouTube OAuth (you download this)
├── youtube_token.json         # Auto-generated after first YouTube auth
├── pipeline/
│   ├── script_gen.py          # Step 1: Groq LLM script generation
│   ├── tts.py                 # Step 2: Voice synthesis (Coqui/ElevenLabs)
│   ├── video_fetcher.py       # Step 3: Pexels/Pixabay stock clips
│   ├── video_assembler.py     # Step 4: MoviePy + FFmpeg assembly
│   ├── captioner.py           # Step 5: Whisper transcription + FFmpeg burn
│   ├── youtube_uploader.py    # Step 7: YouTube Data API v3 upload
│   └── orchestrator.py        # Master pipeline coordinator
├── workers/
│   └── celery_worker.py       # Background jobs + scheduled tasks
└── output/
    ├── videos/                # Final assembled videos
    ├── audio/                 # Synthesized audio files
    └── temp/                  # Temporary clips (auto-cleaned)
```

---

## 🔄 Pipeline Status Flow

```
generating → scripted → voiced → assembled → captioned → labeled → ready → uploading → posted
                                                                                  ↓
                                                                               failed (on any error)
```

---

## 🛠️ Troubleshooting

**FFmpeg not found:**
```bash
sudo apt install ffmpeg    # Linux
brew install ffmpeg         # macOS
```

**Coqui TTS first run is slow:**
Normal — it's downloading the voice model (~200MB). Subsequent runs are fast.

**Whisper runs out of memory:**
Use a smaller model: change `model_size="tiny"` in `captioner.py`

**YouTube quota exceeded:**
Wait until midnight UTC for quota reset, or apply for a free increase.

**Redis connection refused:**
```bash
redis-server    # Start Redis
# or
brew services start redis    # macOS
```

---

## 💡 Tips for Best Results

- **Prompts that work well:** Character-driven scenarios, unexpected fish-out-of-water situations, parody/satire concepts
- **Avoid vague prompts** like "funny video" — be specific: "A medieval knight reviews modern smartphones"
- **Coqui vs ElevenLabs:** Coqui is good enough for testing; ElevenLabs gives much more natural-sounding voice
- **Whisper model:** Use `base` during development, `medium` in production for better caption accuracy
- **Video length:** Keep prompts that generate ~90 second videos — YouTube's algorithm favors completion rate

---

## 📊 Free Tier Limits Summary

| Service | Free Limit | Impact |
|---------|-----------|--------|
| Groq | 14,400 req/day | Can generate 100s of scripts/day |
| Pexels | 200 req/hour | ~10+ videos worth of clips/hour |
| Coqui TTS | Unlimited (local) | No limit |
| Whisper | Unlimited (local) | No limit |
| YouTube Upload | ~6 videos/day | Main bottleneck |
| Supabase | 500MB DB | 10,000s of video records |