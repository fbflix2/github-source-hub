ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS included_proxy_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS included_proxy_qty integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.trg_provision_included_proxies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_has boolean;
BEGIN
  IF NEW.status NOT IN ('paid','completed','delivered','processing') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
      AND p.included_proxy_product_id IS NOT NULL
      AND COALESCE(p.included_proxy_qty,0) > 0
  ) INTO v_has;

  IF NOT v_has THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1/proxyfbflix-api',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bmxlcmtleWdmdmRuem5veGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQ1NTAsImV4cCI6MjA4NzAyMDU1MH0.CTNgMcfo3AdbiiKIONkE0svroKgekXQ4x71bDpqwEV8'
    ),
    body := jsonb_build_object('action','internal-allocate-included-proxy','order_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_orders_included_proxies ON public.orders;
CREATE TRIGGER trg_orders_included_proxies
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_provision_included_proxies();