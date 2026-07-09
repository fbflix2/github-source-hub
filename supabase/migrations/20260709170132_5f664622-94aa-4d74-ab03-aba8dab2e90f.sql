
-- 1) combo_config em ct_plans
ALTER TABLE public.ct_plans
  ADD COLUMN IF NOT EXISTS combo_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) ct_pool_items
CREATE TABLE IF NOT EXISTS public.ct_pool_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.ct_plans(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('perfil','bm','pagina','ad_account')),
  identifier text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','assigned','disabled')),
  reserved_for_user_id uuid,
  assigned_ct_client_id uuid REFERENCES public.ct_clients(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  released_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ct_pool_items_plan_type_status
  ON public.ct_pool_items(plan_id, type, status);
CREATE INDEX IF NOT EXISTS idx_ct_pool_items_reserved_for
  ON public.ct_pool_items(reserved_for_user_id) WHERE reserved_for_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ct_pool_items_assigned_ct_client
  ON public.ct_pool_items(assigned_ct_client_id) WHERE assigned_ct_client_id IS NOT NULL;

GRANT SELECT ON public.ct_pool_items TO authenticated;
GRANT ALL ON public.ct_pool_items TO service_role;

ALTER TABLE public.ct_pool_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ct_pool_items"
  ON public.ct_pool_items
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients see their assigned pool items"
  ON public.ct_pool_items
  FOR SELECT
  TO authenticated
  USING (
    assigned_ct_client_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.ct_clients c
      WHERE c.id = ct_pool_items.assigned_ct_client_id
        AND c.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_ct_pool_items_updated_at
  BEFORE UPDATE ON public.ct_pool_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Estender trigger de liberação
CREATE OR REPLACE FUNCTION public.release_scale_pro_proxies_on_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('cancelado', 'suspenso', 'expirado')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Proxies de volta ao pool
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

    -- Itens do combo (perfis, BMs, páginas, ad accounts) de volta ao pool
    UPDATE public.ct_pool_items
      SET status = 'available',
          assigned_ct_client_id = NULL,
          released_at = now(),
          updated_at = now()
      WHERE assigned_ct_client_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;
