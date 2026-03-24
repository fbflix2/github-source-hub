ALTER TABLE safe_bm_vaults 
ADD COLUMN link_health text NOT NULL DEFAULT 'unknown',
ADD COLUMN link_health_checked_at timestamp with time zone;