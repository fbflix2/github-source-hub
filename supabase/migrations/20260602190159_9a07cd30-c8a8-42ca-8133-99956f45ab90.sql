-- Allow CRM staff to upload and read media in support-attachments under crm/ prefix
CREATE POLICY "Staff can upload CRM attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'support-attachments'
  AND (storage.foldername(name))[1] = 'crm'
  AND public.is_staff(auth.uid())
);

CREATE POLICY "Staff can read CRM attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND (storage.foldername(name))[1] = 'crm'
  AND public.is_staff(auth.uid())
);