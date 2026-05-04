-- 1. Re-revoke direct column access to account_credentials on ss_transactions.
-- Sellers should never read this column directly; buyers use get_ss_transaction_credentials().
REVOKE SELECT (account_credentials) ON public.ss_transactions FROM anon, authenticated, PUBLIC;

-- 2. Tighten support-attachments INSERT policy to enforce folder ownership.
DROP POLICY IF EXISTS "Users can upload support attachments" ON storage.objects;

CREATE POLICY "Users can upload support attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'support-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);