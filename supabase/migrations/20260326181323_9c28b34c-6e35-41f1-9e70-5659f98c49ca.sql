ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text DEFAULT NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL;