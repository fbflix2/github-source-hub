ALTER TABLE public.fb_backup_files ADD COLUMN IF NOT EXISTS fb_id text;
CREATE INDEX IF NOT EXISTS idx_fb_backup_files_fb_id ON public.fb_backup_files(fb_id) WHERE fb_id IS NOT NULL;