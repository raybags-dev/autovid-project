-- Migration: subscriber trial limits + subscriber-owned videos
-- Run once in Supabase SQL Editor

ALTER TABLE subscription_users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'trial';
ALTER TABLE subscription_users ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
ALTER TABLE subscription_users ADD COLUMN IF NOT EXISTS videos_created INT DEFAULT 0;

ALTER TABLE videos ADD COLUMN IF NOT EXISTS subscriber_user_id UUID;
CREATE INDEX IF NOT EXISTS idx_videos_subscriber ON videos(subscriber_user_id) WHERE subscriber_user_id IS NOT NULL;
