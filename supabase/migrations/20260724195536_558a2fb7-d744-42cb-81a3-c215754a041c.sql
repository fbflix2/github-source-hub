
DROP POLICY IF EXISTS "Resellers can upload their brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Resellers can update their brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Resellers can delete their brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read reseller brand assets" ON storage.objects;

CREATE POLICY "Resellers can upload their brand assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'resellers'
  AND (storage.foldername(name))[2] IN (
    SELECT id::text FROM public.resellers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Resellers can update their brand assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'resellers'
  AND (storage.foldername(name))[2] IN (
    SELECT id::text FROM public.resellers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Resellers can delete their brand assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'resellers'
  AND (storage.foldername(name))[2] IN (
    SELECT id::text FROM public.resellers WHERE user_id = auth.uid()
  )
);
