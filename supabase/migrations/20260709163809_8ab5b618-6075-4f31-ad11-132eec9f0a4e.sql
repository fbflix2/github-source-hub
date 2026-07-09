CREATE OR REPLACE FUNCTION public.release_scale_pro_proxies_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelado', 'suspenso', 'expirado')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.subscriptions
      SET user_id = NULL,
          included_in_ct_client_id = NULL,
          status = 'available',
          auto_renew = false,
          updated_at = now()
      WHERE included_in_ct_client_id = NEW.id;

    UPDATE public.ct_client_proxies
      SET released_at = now(), updated_at = now()
      WHERE ct_client_id = NEW.id AND released_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_scale_pro_proxies ON public.ct_clients;
CREATE TRIGGER trg_release_scale_pro_proxies
  AFTER UPDATE OF status ON public.ct_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.release_scale_pro_proxies_on_status_change();