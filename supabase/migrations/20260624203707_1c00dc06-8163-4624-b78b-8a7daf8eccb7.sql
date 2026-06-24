ALTER TABLE public.friend_request_targets
  ADD COLUMN IF NOT EXISTS friends_count integer,
  ADD COLUMN IF NOT EXISTS friends_updated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS friends_goal integer NOT NULL DEFAULT 100;

ALTER TABLE public.supplier_batches
  ADD COLUMN IF NOT EXISTS friends_goal integer NOT NULL DEFAULT 100;