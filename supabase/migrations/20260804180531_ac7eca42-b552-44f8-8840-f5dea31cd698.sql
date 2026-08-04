CREATE TABLE public.reseller_product_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reseller_id, product_id)
);

GRANT SELECT ON public.reseller_product_tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_product_tags TO authenticated;
GRANT ALL ON public.reseller_product_tags TO service_role;

ALTER TABLE public.reseller_product_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read reseller product tags"
  ON public.reseller_product_tags FOR SELECT
  USING (true);

CREATE POLICY "Reseller can manage own product tags"
  ON public.reseller_product_tags FOR ALL
  TO authenticated
  USING (public.is_reseller_owner(reseller_id))
  WITH CHECK (public.is_reseller_owner(reseller_id));

CREATE POLICY "Admins can manage reseller product tags"
  ON public.reseller_product_tags FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_reseller_product_tags_updated_at
  BEFORE UPDATE ON public.reseller_product_tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_reseller_tag_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF array_length(NEW.tags, 1) > 5 THEN
    RAISE EXCEPTION 'Máximo de 5 tags por produto';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reseller_product_tags_limit
  BEFORE INSERT OR UPDATE ON public.reseller_product_tags
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reseller_tag_limit();