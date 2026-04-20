-- 1. SUPPORT-ATTACHMENTS: Restringir SELECT a owner do ticket ou staff
DROP POLICY IF EXISTS "Anyone can view support attachments" ON storage.objects;

CREATE POLICY "Owners and staff can view support attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments' AND (
    public.is_staff(auth.uid())
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);

-- 2. COUPONS: Restringir SELECT — apenas staff lista todos; usuários podem validar via edge function/RPC
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;

CREATE POLICY "Staff can view all coupons"
ON public.coupons FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

-- 3. BANNERS BUCKET: Restringir INSERT/UPDATE/DELETE apenas a staff
DROP POLICY IF EXISTS "Allow authenticated uploads to banners" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update banners" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete banners" ON storage.objects;

CREATE POLICY "Staff can upload banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'banners' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can update banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'banners' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete banners"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'banners' AND public.is_staff(auth.uid()));