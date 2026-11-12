-- Exclusividade de proxy entre clientes: protege TODOS os fluxos de INSERT/UPDATE
-- de subscriptions, inclusive pedidos simultâneos e alocações via Edge Functions.
-- Não altera atribuições existentes: duplicidades históricas devem ser auditadas.
CREATE OR REPLACE FUNCTION public.enforce_exclusive_customer_proxy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ip text;
  v_port text;
  v_provider_id text;
  v_conflict uuid;
  v_occupied boolean;
BEGIN
  IF NEW.user_id IS NULL OR NEW.raw_data IS NULL THEN RETURN NEW; END IF;
  IF NEW.type NOT IN ('proxyfbflix', 'proxybr') THEN RETURN NEW; END IF;
  -- Cancelamentos/expirações só liberam o proxy depois do término contratado.
  v_occupied := NEW.status IN ('active', 'expiring', 'processing', 'past_due')
    OR (NEW.status IN ('expired', 'cancelled', 'canceled') AND
        (NEW.end_date IS NULL OR NEW.end_date > now()));
  IF NOT v_occupied THEN RETURN NEW; END IF;
  v_ip := NULLIF(trim(COALESCE(NEW.raw_data->>'proxy_address', NEW.raw_data->>'ip', '')), '');
  v_port := NULLIF(trim(COALESCE(NEW.raw_data->>'port', '')), '');
  v_provider_id := NULLIF(trim(COALESCE(NEW.raw_data->>'fbflix_proxy_id', NEW.raw_data->>'proxyfbflix_proxy_id', NEW.raw_data->>'webshare_proxy_id', '')), '');
  IF v_ip IS NULL AND v_provider_id IS NULL THEN RETURN NEW; END IF;
  -- Serializa concorrência por proxy. Locks são liberados no fim da transação.
  IF v_ip IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('proxy-ip:' || lower(v_ip), 0));
  END IF;
  IF v_provider_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('proxy-id:' || v_provider_id, 0));
  END IF;
  SELECT s.id INTO v_conflict
  FROM public.subscriptions s
  WHERE s.id IS DISTINCT FROM NEW.id
    AND s.user_id IS DISTINCT FROM NEW.user_id
    AND s.type IN ('proxyfbflix', 'proxybr')
    AND (
      s.status IN ('active', 'expiring', 'processing', 'past_due')
      OR (s.status IN ('expired', 'cancelled', 'canceled') AND
          (s.end_date IS NULL OR s.end_date > now()))
    )
    AND (
      (v_ip IS NOT NULL AND lower(COALESCE(s.raw_data->>'proxy_address', s.raw_data->>'ip', '')) = lower(v_ip))
      OR (v_provider_id IS NOT NULL AND v_provider_id = COALESCE(s.raw_data->>'fbflix_proxy_id', s.raw_data->>'proxyfbflix_proxy_id', s.raw_data->>'webshare_proxy_id'))
    )
  LIMIT 1;
  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'proxy_already_assigned_to_another_customer'
      USING ERRCODE = '23505', HINT = 'Selecione um proxy diferente; o endereço já está reservado.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_exclusive_customer_proxy ON public.subscriptions;
CREATE TRIGGER trg_exclusive_customer_proxy
BEFORE INSERT OR UPDATE OF raw_data, user_id, status, end_date, type
ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.enforce_exclusive_customer_proxy();

-- Auditoria: não modifica dados e mostra somente duplicações entre clientes.
-- SELECT lower(coalesce(raw_data->>'proxy_address', raw_data->>'ip')) ip,
--        count(distinct user_id) clientes
-- FROM public.subscriptions
-- WHERE type IN ('proxyfbflix', 'proxybr')
-- GROUP BY 1 HAVING count(distinct user_id) > 1;
