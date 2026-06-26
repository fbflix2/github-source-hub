ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS pix_key_type text,
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_holder_name text,
  ADD COLUMN IF NOT EXISTS pix_holder_document text,
  ADD COLUMN IF NOT EXISTS pix_bank text;