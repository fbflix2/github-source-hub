ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS cta_color text DEFAULT NULL;
ALTER TABLE public.admin_notifications ADD COLUMN IF NOT EXISTS cta_color text DEFAULT NULL;