ALTER TABLE public.fb_backup_files ADD COLUMN IF NOT EXISTS unit_price numeric;
UPDATE public.fb_backup_files f SET unit_price = fo.unit_price
FROM public.fb_backup_folders fo
WHERE f.folder_id = fo.id AND f.unit_price IS NULL AND fo.unit_price IS NOT NULL;