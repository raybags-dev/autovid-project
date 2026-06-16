-- Subscriber channel URLs — for auto-publish routing
-- Run once in Supabase SQL Editor
ALTER TABLE subscription_users ADD COLUMN IF NOT EXISTS youtube_channel_url TEXT DEFAULT '';
ALTER TABLE subscription_users ADD COLUMN IF NOT EXISTS tiktok_profile_url TEXT DEFAULT '';
