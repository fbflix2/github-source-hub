
CREATE TABLE public.partner_journey_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('click','view_product','add_cart','checkout','purchase')),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  user_id UUID,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount NUMERIC,
  commission_amount NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.partner_journey_events TO anon;
GRANT SELECT, INSERT, UPDATE ON public.partner_journey_events TO authenticated;
GRANT ALL ON public.partner_journey_events TO service_role;

CREATE INDEX idx_pje_partner_created ON public.partner_journey_events(partner_id, created_at DESC);
CREATE INDEX idx_pje_visitor ON public.partner_journey_events(visitor_id);
CREATE INDEX idx_pje_user ON public.partner_journey_events(user_id);
CREATE INDEX idx_pje_event_type ON public.partner_journey_events(event_type);

ALTER TABLE public.partner_journey_events ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + auth) can insert events (tracking is public-write)
CREATE POLICY "anyone can insert journey events"
  ON public.partner_journey_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Partners can view only their own events
CREATE POLICY "partners view own journey events"
  ON public.partner_journey_events FOR SELECT
  TO authenticated
  USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Admin full management
CREATE POLICY "admins manage journey events"
  ON public.partner_journey_events FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- When user_id is assigned, backfill earlier anonymous events by visitor_id
CREATE OR REPLACE FUNCTION public.partner_journey_claim_visitor(
  _visitor_id TEXT,
  _user_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.partner_journey_events
    SET user_id = _user_id
    WHERE visitor_id = _visitor_id AND user_id IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.partner_journey_claim_visitor(TEXT, UUID) TO anon, authenticated;

-- Trigger: when an order with partner_id is completed, log purchase automatically
CREATE OR REPLACE FUNCTION public.log_partner_purchase_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate NUMERIC;
  v_visitor TEXT;
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS NULL OR OLD.status <> 'completed')
     AND NEW.partner_id IS NOT NULL THEN

    -- Don't duplicate
    IF EXISTS (SELECT 1 FROM public.partner_journey_events
               WHERE order_id = NEW.id AND event_type = 'purchase') THEN
      RETURN NEW;
    END IF;

    SELECT commission_rate INTO v_rate FROM public.partners WHERE id = NEW.partner_id;

    -- Try to find the visitor_id from earlier events of this user
    SELECT visitor_id INTO v_visitor
      FROM public.partner_journey_events
      WHERE user_id = NEW.user_id AND partner_id = NEW.partner_id
      ORDER BY created_at DESC LIMIT 1;

    INSERT INTO public.partner_journey_events
      (visitor_id, partner_id, event_type, user_id, order_id, amount, commission_amount, metadata)
    VALUES (
      COALESCE(v_visitor, 'srv-' || NEW.id::text),
      NEW.partner_id,
      'purchase',
      NEW.user_id,
      NEW.id,
      NEW.total,
      COALESCE(NEW.total * (v_rate / 100.0), 0),
      jsonb_build_object('source', 'server_trigger')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_partner_purchase ON public.orders;
CREATE TRIGGER trg_log_partner_purchase
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_partner_purchase_event();
