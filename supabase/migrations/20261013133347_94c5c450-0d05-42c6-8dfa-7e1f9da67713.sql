CREATE OR REPLACE FUNCTION public.sync_product_default_to_products()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _old text;
BEGIN
  _old := lower(trim(COALESCE(CASE WHEN TG_OP = 'UPDATE' THEN OLD.name END, NEW.name)));
  UPDATE public.products
     SET name = NEW.name,
         description = COALESCE(NEW.description, description),
         tags = NEW.tags,
         updated_at = now()
   WHERE lower(trim(name)) IN (_old, lower(trim(NEW.name)));
  IF TG_OP = 'UPDATE' AND lower(trim(OLD.name)) <> lower(trim(NEW.name)) THEN
    UPDATE public.stock_items SET name = NEW.name WHERE lower(trim(name)) = lower(trim(OLD.name));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_product_default ON public.product_defaults;
CREATE TRIGGER trg_sync_product_default
AFTER INSERT OR UPDATE OF name, description, tags ON public.product_defaults
FOR EACH ROW EXECUTE FUNCTION public.sync_product_default_to_products();

-- Sincroniza agora os produtos existentes
UPDATE public.products p
   SET name = d.name, description = COALESCE(d.description, p.description), tags = d.tags, updated_at = now()
  FROM public.product_defaults d
 WHERE lower(trim(p.name)) = lower(trim(d.name));