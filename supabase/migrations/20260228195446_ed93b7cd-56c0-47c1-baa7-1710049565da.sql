-- Add cancelled_at to track when a subscription was cancelled
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;