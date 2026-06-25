ALTER TABLE public.fb_backup_files REPLICA IDENTITY FULL;
ALTER TABLE public.fb_backup_folders REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.fb_backup_files; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.fb_backup_folders; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;