ALTER TABLE public.ct_clients
  ADD COLUMN IF NOT EXISTS lauth_email text,
  ADD COLUMN IF NOT EXISTS lauth_status text NOT NULL DEFAULT 'pending';