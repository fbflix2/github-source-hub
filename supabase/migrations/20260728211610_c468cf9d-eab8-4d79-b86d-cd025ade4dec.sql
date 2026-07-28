-- 1. Coluna de vínculo com revendedor
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_reseller_id ON public.tickets(reseller_id);

-- 2. Preenchimento automático a partir do perfil do cliente
CREATE OR REPLACE FUNCTION public.autofill_ticket_reseller_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.reseller_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT reseller_id INTO NEW.reseller_id
    FROM public.profiles
    WHERE user_id = NEW.user_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autofill_ticket_reseller_id ON public.tickets;
CREATE TRIGGER trg_autofill_ticket_reseller_id
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.autofill_ticket_reseller_id();

-- 3. Backfill dos tickets existentes
UPDATE public.tickets t
SET reseller_id = p.reseller_id
FROM public.profiles p
WHERE p.user_id = t.user_id
  AND t.reseller_id IS NULL
  AND p.reseller_id IS NOT NULL;

-- 4. Helper: o usuário autenticado é dono deste revendedor?
CREATE OR REPLACE FUNCTION public.is_reseller_owner(_reseller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resellers r
    WHERE r.id = _reseller_id
      AND r.user_id = auth.uid()
      AND r.status IN ('active','warning')
  );
$$;

-- 5. Políticas: revendedor enxerga e responde tickets dos próprios clientes
DROP POLICY IF EXISTS "Resellers can view own client tickets" ON public.tickets;
CREATE POLICY "Resellers can view own client tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (reseller_id IS NOT NULL AND public.is_reseller_owner(reseller_id));

DROP POLICY IF EXISTS "Resellers can update own client tickets" ON public.tickets;
CREATE POLICY "Resellers can update own client tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (reseller_id IS NOT NULL AND public.is_reseller_owner(reseller_id))
WITH CHECK (reseller_id IS NOT NULL AND public.is_reseller_owner(reseller_id));

DROP POLICY IF EXISTS "Resellers can view own client ticket messages" ON public.ticket_messages;
CREATE POLICY "Resellers can view own client ticket messages"
ON public.ticket_messages
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tickets t
  WHERE t.id = ticket_messages.ticket_id
    AND t.reseller_id IS NOT NULL
    AND public.is_reseller_owner(t.reseller_id)
));

DROP POLICY IF EXISTS "Resellers can reply own client ticket messages" ON public.ticket_messages;
CREATE POLICY "Resellers can reply own client ticket messages"
ON public.ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tickets t
  WHERE t.id = ticket_messages.ticket_id
    AND t.reseller_id IS NOT NULL
    AND public.is_reseller_owner(t.reseller_id)
));

DROP POLICY IF EXISTS "Resellers can update own client ticket messages" ON public.ticket_messages;
CREATE POLICY "Resellers can update own client ticket messages"
ON public.ticket_messages
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tickets t
  WHERE t.id = ticket_messages.ticket_id
    AND t.reseller_id IS NOT NULL
    AND public.is_reseller_owner(t.reseller_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tickets t
  WHERE t.id = ticket_messages.ticket_id
    AND t.reseller_id IS NOT NULL
    AND public.is_reseller_owner(t.reseller_id)
));

DROP POLICY IF EXISTS "Resellers can view own client ticket ratings" ON public.ticket_ratings;
CREATE POLICY "Resellers can view own client ticket ratings"
ON public.ticket_ratings
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tickets t
  WHERE t.id = ticket_ratings.ticket_id
    AND t.reseller_id IS NOT NULL
    AND public.is_reseller_owner(t.reseller_id)
));