-- ============================================================
-- AutoVid — Supabase Security Hardening Migration
-- Run once in: Supabase Dashboard → SQL Editor
-- URL: https://supabase.com/dashboard/project/euvbtarnzicrrbxqzhud/sql
--
-- SAFE TO RUN: the backend always uses service_role which
-- bypasses RLS entirely — no app functionality is affected.
-- ============================================================


-- ── 1. VIDEOS TABLE ─────────────────────────────────────────
-- Problem: anon key can read ALL columns including script,
--          error_message, prompt, narration_url, tiktok IDs, etc.
-- Fix A: drop any existing permissive SELECT policies for anon
-- Fix B: revoke sensitive column access from anon + authenticated

-- Drop all existing SELECT/ALL policies on videos
-- (covers Supabase auto-generated "Enable read access for all users" and similar)
DO $$
DECLARE pol record;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'videos'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.videos', pol.policyname);
    END LOOP;
END;
$$;

-- Re-enable RLS (in case it was toggled off)
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- No anon SELECT policy — service_role bypasses RLS so the backend
-- continues to work; direct API calls with anon key are denied.

-- Defense-in-depth: revoke internal columns even if a SELECT policy
-- is ever added back — these will NEVER be readable by anon/authenticated.
REVOKE SELECT (
    script,
    error_message,
    prompt,
    narration_url,
    tiktok_publish_id,
    tiktok_status,
    buzzsprout_episode_id,
    buzzsprout_url,
    podbean_episode_id,
    podbean_url,
    archived
) ON public.videos FROM anon, authenticated;


-- ── 2. SUBSCRIPTION USERS ────────────────────────────────────
-- Currently: permission denied (good), but not formally enforced by RLS.
-- Make it permanent via explicit RLS enable + no policies for anon.

ALTER TABLE public.subscription_users ENABLE ROW LEVEL SECURITY;

-- Extra hardening: revoke the sensitive columns entirely
-- (password_hash and access_token must never leak)
REVOKE SELECT (password_hash, access_token)
ON public.subscription_users FROM anon, authenticated;


-- ── 3. SUBSCRIBERS ───────────────────────────────────────────
-- Currently: permission denied (good). Formalise.

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;


-- ── 4. STICKFIGURE CLIPS ─────────────────────────────────────
-- Admin-managed table. No direct API access needed.

ALTER TABLE public.stickfigure_clips ENABLE ROW LEVEL SECURITY;


-- ── 5. APP SETTINGS ──────────────────────────────────────────
-- May contain API keys stored as settings. Lock it down.

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;


-- ── 6. STORAGE BUCKETS ───────────────────────────────────────
-- Current state (confirmed by audit):
--   • narrations, videos, stickfigures — public READ (required for playback)
--   • anon CANNOT upload or delete (already blocked by storage RLS)
-- No changes needed for storage.


-- ── 7. VERIFY ────────────────────────────────────────────────
-- Run this after to confirm all tables have RLS enabled:

SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    COUNT(p.policyname) AS policy_count
FROM pg_class c
LEFT JOIN pg_policies p
    ON p.tablename = c.relname AND p.schemaname = 'public'
WHERE c.relname IN (
    'videos', 'subscribers', 'subscription_users',
    'stickfigure_clips', 'app_settings'
)
AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

-- Expected output:
--   table_name          | rls_enabled | policy_count
--   --------------------+-------------+-------------
--   app_settings        | true        | 0
--   stickfigure_clips   | true        | 0
--   subscribers         | true        | 0
--   subscription_users  | true        | 0
--   videos              | true        | 0
--
-- rls_enabled = true and policy_count = 0 means:
--   • service_role (backend) bypasses RLS → full access ✓
--   • anon / authenticated → denied by default ✓
