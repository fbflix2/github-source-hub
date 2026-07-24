
-- Permitir que o dono do reseller gerencie banners do próprio reseller
DROP POLICY IF EXISTS "Reseller owner can manage own banners" ON public.banners;
CREATE POLICY "Reseller owner can manage own banners"
ON public.banners
FOR ALL
TO authenticated
USING (
  reseller_id IS NOT NULL
  AND reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
)
WITH CHECK (
  reseller_id IS NOT NULL
  AND reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
);

-- Permitir uploads de banners no bucket "banners" pelos donos de resellers
DROP POLICY IF EXISTS "Reseller owners can upload banners" ON storage.objects;
CREATE POLICY "Reseller owners can upload banners"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'banners'
  AND EXISTS (SELECT 1 FROM public.resellers WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Reseller owners can update banners" ON storage.objects;
CREATE POLICY "Reseller owners can update banners"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'banners'
  AND EXISTS (SELECT 1 FROM public.resellers WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Reseller owners can delete banners" ON storage.objects;
CREATE POLICY "Reseller owners can delete banners"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'banners'
  AND EXISTS (SELECT 1 FROM public.resellers WHERE user_id = auth.uid())
);
