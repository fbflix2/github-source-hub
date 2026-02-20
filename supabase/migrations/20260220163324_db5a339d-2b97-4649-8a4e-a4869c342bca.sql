-- Create storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('support-attachments', 'support-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to support-attachments
CREATE POLICY "Users can upload support attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'support-attachments');

-- Allow anyone to view support attachments (needed for admin to see them)
CREATE POLICY "Anyone can view support attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'support-attachments');

-- Allow admins to delete support attachments
CREATE POLICY "Admins can delete support attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'support-attachments' AND EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
));