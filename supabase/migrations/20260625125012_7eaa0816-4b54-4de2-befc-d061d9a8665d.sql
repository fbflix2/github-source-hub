
CREATE TABLE public.fb_backup_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_backup_folders TO authenticated;
GRANT ALL ON public.fb_backup_folders TO service_role;

ALTER TABLE public.fb_backup_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage backup folders" ON public.fb_backup_folders
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER update_fb_backup_folders_updated_at
  BEFORE UPDATE ON public.fb_backup_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fb_backup_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.fb_backup_folders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_backup_files TO authenticated;
GRANT ALL ON public.fb_backup_files TO service_role;

ALTER TABLE public.fb_backup_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage backup files" ON public.fb_backup_files
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX idx_fb_backup_files_folder ON public.fb_backup_files(folder_id);

-- Storage policies for fb-backups bucket (private)
CREATE POLICY "Staff read fb-backups"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fb-backups' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff upload fb-backups"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fb-backups' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff update fb-backups"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fb-backups' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff delete fb-backups"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fb-backups' AND public.is_staff(auth.uid()));
