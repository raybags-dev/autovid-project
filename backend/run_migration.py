"""
One-time migration: create the stickfigure_clips table.

Tries (in order):
  1. psycopg2 with DATABASE_URL or a Supabase-derived connection string
  2. Supabase Management API  (needs SUPABASE_MANAGEMENT_TOKEN env var)
  3. Prints the SQL so you can paste it into the Supabase SQL Editor
"""
import os, sys, re
from pathlib import Path

# Load .env from backend/ or project root
for candidate in [Path(__file__).parent / ".env", Path(__file__).parent.parent / ".env"]:
    if candidate.exists():
        for line in candidate.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        break

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
DATABASE_URL         = os.environ.get("DATABASE_URL", "")
MGMT_TOKEN           = os.environ.get("SUPABASE_MANAGEMENT_TOKEN", "")

SQL = """
CREATE TABLE IF NOT EXISTS stickfigure_clips (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename    TEXT NOT NULL UNIQUE,
    label       TEXT NOT NULL,
    keywords    TEXT[] DEFAULT '{}',
    file_path   TEXT NOT NULL,
    duration    FLOAT DEFAULT 0,
    width       INTEGER DEFAULT 0,
    height      INTEGER DEFAULT 0,
    has_alpha   BOOLEAN DEFAULT FALSE,
    has_audio   BOOLEAN DEFAULT FALSE,
    enabled     BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sfclips_enabled ON stickfigure_clips(enabled);
"""

print("🔧 Running stickfigure_clips migration...")

# ── Method 1: psycopg2 direct connection ─────────────────────────────────────
def try_psycopg2(conn_str: str) -> bool:
    try:
        import psycopg2
        conn = psycopg2.connect(conn_str)
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(SQL)
        cur.close()
        conn.close()
        print("✅ Migration complete via psycopg2")
        return True
    except ImportError:
        print("   psycopg2 not installed — skipping")
    except Exception as e:
        print(f"   psycopg2 failed: {e}")
    return False

if DATABASE_URL:
    if try_psycopg2(DATABASE_URL):
        sys.exit(0)

# Derive Supabase direct connection URL from SUPABASE_URL + service key
# Supabase direct host: db.<project-ref>.supabase.co:5432
m = re.search(r"https://([^.]+)\.supabase\.co", SUPABASE_URL)
if m:
    project_ref = m.group(1)
    # Try with service key as password (works on some Supabase configs)
    derived = f"postgresql://postgres.{project_ref}:{SUPABASE_SERVICE_KEY}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
    if try_psycopg2(derived):
        sys.exit(0)

# ── Method 2: Supabase Management API ────────────────────────────────────────
token = MGMT_TOKEN or SUPABASE_SERVICE_KEY
if m and token:
    try:
        import urllib.request, json
        project_ref = m.group(1)
        url = f"https://api.supabase.com/v1/projects/{project_ref}/database/query"
        payload = json.dumps({"query": SQL}).encode()
        req = urllib.request.Request(
            url, data=payload,
            headers={"Content-Type": "application/json",
                     "Authorization": f"Bearer {token}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            print("✅ Migration complete via Supabase Management API")
            sys.exit(0)
    except Exception as e:
        print(f"   Management API failed: {e}")

# ── Method 3: Print instructions ─────────────────────────────────────────────
print()
print("⚠️  Could not run migration automatically.")
print("   Please run the following SQL once in your Supabase SQL Editor:")
print("   https://supabase.com/dashboard/project/_/sql/new")
print()
print(SQL)
sys.exit(1)
