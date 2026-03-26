
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated uploads to banners" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'banners');

CREATE POLICY "Allow public read on banners" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'banners');
