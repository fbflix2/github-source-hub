ALTER TABLE public.safe_bm_vaults
  ADD COLUMN IF NOT EXISTS backup_link text,
  ADD COLUMN IF NOT EXISTS backup_link_set_at timestamptz;