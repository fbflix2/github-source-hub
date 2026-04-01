-- Fix existing campaign notifications: set global=false so each user only sees their own
UPDATE notifications SET global = false WHERE campaign_id IS NOT NULL AND global = true;