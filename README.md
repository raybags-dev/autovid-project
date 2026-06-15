# AutoVid

**AutoVid** is a full-stack AI-powered video automation platform. From a single text prompt it writes a script, synthesizes a narration voice, sources and assembles stock footage, burns synchronized captions, and publishes the finished video to YouTube — entirely without manual editing.

A web dashboard lets you queue videos, monitor pipeline progress in real time, manage your library, and configure all settings. A Celery background worker handles long-running generation jobs while the FastAPI backend serves the UI and exposes a full REST API.

---

## What it does

Type a prompt like *"A medieval knight reviews modern smartphones"* and AutoVid:

1. **Writes the script** — an LLM (Groq / Llama 3) turns the prompt into a structured, narration-ready script with title, description, and visual cues
2. **Synthesizes speech** — ElevenLabs (or local Coqui TTS) converts the narration to audio
3. **Sources footage** — the script is mapped to visual search queries; matching stock clips are fetched from Pexels and Pixabay and trimmed to fit each segment
4. **Assembles the video** — MoviePy + FFmpeg combine the clips, background music, and narration into a clean 1080p (or 9:16 Shorts) cut
5. **Burns captions** — OpenAI Whisper transcribes the audio; styled captions are burned directly into the video frame
6. **Labels and uploads** — Groq generates SEO-optimized titles, descriptions, and tags; the video is uploaded to YouTube via the Data API v3

The same pipeline handles YouTube Shorts, podcast episode generation (Podbean, Buzzsprout), and optional TikTok / Spotify cross-posting.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                       Web Dashboard                      │
│   Vue + Vite frontend · REST API via FastAPI · SSE logs  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP
┌────────────────────────▼────────────────────────────────┐
│                    FastAPI Backend                        │
│  /videos  /generate  /pipeline  /settings  /auth  /docs  │
└──────────┬────────────────────────────┬─────────────────┘
           │ Celery tasks               │ direct
    ┌──────▼──────┐              ┌──────▼──────────────────┐
    │    Redis     │              │      Orchestrator        │
    │  task queue  │              │  master pipeline runner  │
    └──────┬──────┘              └──────┬──────────────────┘
           │                            │
    ┌──────▼──────────────────────────────────────────────┐
    │                 Pipeline Stages                       │
    │                                                       │
    │  script_gen  →  tts  →  video_fetcher  →  assembler  │
    │         →  caption  →  labeler  →  uploader          │
    └─────────────────────────┬───────────────────────────┘
                              │
              ┌───────────────▼──────────────┐
              │          Supabase             │
              │  video records · settings ·   │
              │  OAuth tokens · user data     │
              └──────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Backend API** | Python 3.11 · FastAPI · Uvicorn |
| **Task Queue** | Celery · Redis |
| **LLM** | Groq API (Llama 3.3 70B, Llama 4 Scout) |
| **Text-to-Speech** | ElevenLabs API · Coqui TTS (local fallback) |
| **Video Processing** | MoviePy · FFmpeg |
| **Speech-to-Text** | OpenAI Whisper (local) |
| **Stock Footage** | Pexels API · Pixabay API |
| **Database** | Supabase (PostgreSQL) |
| **Object Storage** | Supabase Storage |
| **Frontend** | Vue 3 · Vite · Tailwind CSS |
| **Containerization** | Docker · Docker Compose |
| **Reverse Proxy / LB** | Nginx |

---

## Key Features

- **One-prompt video generation** — full pipeline runs autonomously from prompt to published video
- **Real-time progress streaming** — SSE events push step-by-step status to the dashboard as each pipeline stage completes
- **Multiple visual modes** — stock footage (Pexels/Pixabay), generated particle/fluid animations, stick-figure character animations, and custom background assets
- **YouTube Shorts support** — vertical 9:16 format with adapted caption layout
- **Podcast pipeline** — converts video narration to a podcast episode and distributes to Podbean and Buzzsprout
- **Custom Content library** — upload and manage your own video segments that get injected at defined points in the pipeline
- **Subscriber messages** — configurable subscribe-prompt clips that inject at chapter boundaries
- **Auto-scheduler** — Celery Beat runs a cron-driven generation schedule with configurable frequency and topic rotation
- **Background music** — style-matched ambient tracks mixed at a configurable volume with soft fade-in/out
- **Full REST API** — every feature is accessible programmatically with interactive docs at `/docs`
- **Docker Compose deployment** — production stack with two load-balanced API replicas, Celery worker, Redis, and Nginx

---

## Pipeline Status Flow

```
generating → scripted → voiced → assembled → captioned → labeled → ready → uploading → posted
                                                                                 ↓
                                                                              failed
```

Each transition is persisted to the database in real time, so the frontend can always display accurate progress even if the server restarts mid-job.

---

## Prerequisites

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y ffmpeg redis-server python3.11 python3.11-venv

# macOS
brew install ffmpeg redis python@3.11
brew services start redis
```

---

## Quick Start

### 1. Clone and set up Python

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example backend/.env
# Fill in your API keys — see "Getting API Keys" below
nano backend/.env
```

### 3. Set up the database

Create a [Supabase](https://supabase.com) project, open the SQL editor, and run the schema from `supabase/migrations/`. Copy the Project URL and service role key into your `.env`.

### 4. YouTube OAuth (one-time)

```bash
# Download client_secrets.json from Google Cloud Console first
# (APIs & Services → Credentials → OAuth 2.0 Client ID → Desktop app → Download)
mv ~/Downloads/client_secret_*.json backend/client_secrets.json

python backend/pipeline/youtube_uploader.py
# A browser window opens → authorize → youtube_token.json is saved
```

### 5. Start the services

```bash
# Backend API
uvicorn main:app --reload --port 8000 --app-dir backend
# Interactive docs: http://localhost:8000/docs

# Background worker (separate terminal)
celery -A workers.celery_worker worker --loglevel=info

# Frontend
cd frontend && npm install && npm run dev
# Dashboard: http://localhost:5173
```

### 6. Production (Docker Compose)

```bash
docker compose up -d
```

The stack brings up two FastAPI replicas behind Nginx, a Celery worker, and Redis. Map port 80 on the host and configure your domain in `nginx-lb.conf`.

---

## Getting API Keys

| Service | Where | Free Tier |
|---|---|---|
| **Groq** | [console.groq.com](https://console.groq.com) | 14,400 requests/day |
| **ElevenLabs** | [elevenlabs.io](https://elevenlabs.io) | 10,000 chars/month |
| **Pexels** | [pexels.com/api](https://www.pexels.com/api/) | 200 requests/hour |
| **Pixabay** | [pixabay.com/api/docs](https://pixabay.com/api/docs/) | 100 requests/min |
| **Supabase** | [supabase.com](https://supabase.com) | 500 MB DB · 2 GB storage |
| **YouTube Data API v3** | [console.cloud.google.com](https://console.cloud.google.com) | ~6 uploads/day |

---

## Project Structure

```
autovid/
├── backend/
│   ├── main.py                    # FastAPI app — all route definitions
│   ├── config.py                  # Centralized environment config loader
│   ├── database.py                # Supabase CRUD layer
│   ├── requirements.txt
│   ├── .env.example               # ← copy to .env and fill in keys
│   ├── pipeline/
│   │   ├── orchestrator.py        # Master pipeline coordinator
│   │   ├── script_gen.py          # LLM script generation (Groq)
│   │   ├── tts.py                 # Voice synthesis (ElevenLabs / Coqui)
│   │   ├── video_fetcher.py       # Stock clip sourcing (Pexels / Pixabay)
│   │   ├── video_assembler.py     # MoviePy + FFmpeg assembly
│   │   ├── caption.py             # Whisper transcription + caption burn
│   │   ├── labeler.py             # SEO label generation (Groq)
│   │   ├── youtube_uploader.py    # YouTube Data API v3 upload
│   │   ├── shorts_generator.py    # YouTube Shorts (9:16) pipeline
│   │   ├── podcast_pipeline.py    # Audio-to-podcast distribution
│   │   ├── auto_generator.py      # Scheduled / autonomous generation
│   │   └── ...                    # Additional pipeline modules
│   ├── routers/
│   │   ├── auth.py                # Login, logout, token endpoints
│   │   ├── videos.py              # Video CRUD
│   │   └── pipeline.py            # Pipeline trigger and status
│   ├── workers/
│   │   └── celery_worker.py       # Background job definitions + Beat schedule
│   └── output/                    # Generated files (gitignored)
│       ├── videos/
│       ├── audio/
│       └── temp/
├── frontend/                      # Vue 3 + Vite dashboard
├── supabase/                      # Database migrations
├── docker-compose.yml
├── nginx-lb.conf
└── .env.example
```

---

## Troubleshooting

**FFmpeg not found**
```bash
sudo apt install ffmpeg      # Linux
brew install ffmpeg           # macOS
```

**Whisper out of memory** — reduce the model size in `caption.py`: `model_size="tiny"`

**YouTube quota exceeded** — quota resets at midnight UTC. Apply for a free increase at Google Cloud Console → APIs & Services → YouTube Data API v3 → Quotas.

**Redis connection refused**
```bash
redis-server                  # start manually
brew services start redis     # macOS
```

**Coqui TTS slow on first run** — it downloads a ~200 MB voice model. Subsequent runs are fast.

---

## License

This project uses a proprietary license key to enable the video generation pipeline. The source code is made available for review and portfolio purposes. Deployment requires a valid `AUTOVID_LICENSE_KEY`.
