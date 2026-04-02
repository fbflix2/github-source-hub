
-- =============================================
-- SOCIALSAFE MARKETPLACE TABLES
-- =============================================

-- Listings (anúncios de contas)
CREATE TABLE public.ss_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'instagram',
  title text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'draft',
  followers integer NOT NULL DEFAULT 0,
  engagement_rate numeric DEFAULT 0,
  niche text,
  is_verified boolean NOT NULL DEFAULT false,
  is_monetized boolean NOT NULL DEFAULT false,
  has_original_email boolean NOT NULL DEFAULT false,
  account_age_months integer DEFAULT 0,
  screenshots jsonb DEFAULT '[]'::jsonb,
  metrics jsonb DEFAULT '{}'::jsonb,
  featured boolean NOT NULL DEFAULT false,
  views_count integer NOT NULL DEFAULT 0,
  slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ss_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published listings" ON public.ss_listings
  FOR SELECT USING (status = 'published');

CREATE POLICY "Users can view own listings" ON public.ss_listings
  FOR SELECT TO authenticated USING (seller_id = auth.uid());

CREATE POLICY "Users can insert own listings" ON public.ss_listings
  FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Users can update own listings" ON public.ss_listings
  FOR UPDATE TO authenticated USING (seller_id = auth.uid());

CREATE POLICY "Staff can manage all listings" ON public.ss_listings
  FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- Transactions (escrow)
CREATE TABLE public.ss_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.ss_listings(id),
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  fee_rate numeric NOT NULL DEFAULT 0.15,
  status text NOT NULL DEFAULT 'pending_payment',
  account_credentials jsonb,
  validation_checklist jsonb DEFAULT '[]'::jsonb,
  validated_by uuid,
  validated_at timestamptz,
  delivered_at timestamptz,
  confirmed_at timestamptz,
  disputed_at timestamptz,
  dispute_reason text,
  dispute_resolution text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ss_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.ss_transactions
  FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Users can insert transactions as buyer" ON public.ss_transactions
  FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Staff can manage all transactions" ON public.ss_transactions
  FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- Messages (chat entre buyer/seller)
CREATE TABLE public.ss_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.ss_transactions(id),
  sender_id uuid NOT NULL,
  content text NOT NULL,
  attachment_url text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ss_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transaction participants can view messages" ON public.ss_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ss_transactions t
      WHERE t.id = transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

CREATE POLICY "Transaction participants can send messages" ON public.ss_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.ss_transactions t
      WHERE t.id = transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

CREATE POLICY "Staff can manage all messages" ON public.ss_messages
  FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- Reviews (avaliações pós-transação)
CREATE TABLE public.ss_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.ss_transactions(id),
  reviewer_id uuid NOT NULL,
  reviewed_user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ss_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews" ON public.ss_reviews
  FOR SELECT USING (true);

CREATE POLICY "Transaction participants can create reviews" ON public.ss_reviews
  FOR INSERT TO authenticated WITH CHECK (
    reviewer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.ss_transactions t
      WHERE t.id = transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

CREATE POLICY "Staff can manage all reviews" ON public.ss_reviews
  FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- Favorites
CREATE TABLE public.ss_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  listing_id uuid NOT NULL REFERENCES public.ss_listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

ALTER TABLE public.ss_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own favorites" ON public.ss_favorites
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER ss_listings_updated_at BEFORE UPDATE ON public.ss_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER ss_transactions_updated_at BEFORE UPDATE ON public.ss_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
