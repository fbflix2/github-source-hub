-- Lauth sale reconciliation: approval is separate from any Lauth mutation.
CREATE TABLE IF NOT EXISTS public.lauth_sale_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  facebook_profile_id text NOT NULL CHECK (facebook_profile_id ~ '^[0-9]{8,25}$'),
  lauth_profile_id text,
  source_group text NOT NULL DEFAULT 'LOJA FBFLIX',
  destination_group text NOT NULL DEFAULT 'VENDIDOS 2026',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','moved','failed')),
  alerted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  moved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_item_id, facebook_profile_id)
);
ALTER TABLE public.lauth_sale_reviews ENABLE ROW LEVEL SECURITY;
-- Review records are accessible only from verified server-side admin functions.
REVOKE ALL ON public.lauth_sale_reviews FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS lauth_sale_reviews_status_idx ON public.lauth_sale_reviews(status, created_at DESC);
