-- Restrict whatsapp chats by assignment. Admins see all; moderators only see
-- conversations assigned to them (or still unassigned, so they can claim).

DROP POLICY IF EXISTS "Staff manage conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Staff view conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Staff can view all whatsapp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Staff can update whatsapp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Staff can insert whatsapp messages" ON public.whatsapp_messages;

-- Conversations: admin full, moderators only see assigned-to-self or unassigned
CREATE POLICY "Admin full access conversations"
ON public.whatsapp_conversations FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Assigned staff view conversations"
ON public.whatsapp_conversations FOR SELECT
TO authenticated
USING (
  public.is_staff(auth.uid())
  AND (assigned_to = auth.uid() OR assigned_to IS NULL)
);

CREATE POLICY "Assigned staff update conversations"
ON public.whatsapp_conversations FOR UPDATE
TO authenticated
USING (
  public.is_staff(auth.uid())
  AND (assigned_to = auth.uid() OR assigned_to IS NULL)
)
WITH CHECK (
  public.is_staff(auth.uid())
  AND (assigned_to = auth.uid() OR assigned_to IS NULL OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Staff insert conversations"
ON public.whatsapp_conversations FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

-- Helper to check if the current user is assigned to a given phone's conversation
CREATE OR REPLACE FUNCTION public.can_access_whatsapp_phone(_phone text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_conversations c
      WHERE c.phone = _phone
        AND public.is_staff(auth.uid())
        AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_whatsapp_phone(text) TO authenticated, service_role;

-- Messages: gated by access to the parent conversation
CREATE POLICY "View messages of accessible chats"
ON public.whatsapp_messages FOR SELECT
TO authenticated
USING (public.can_access_whatsapp_phone(phone));

CREATE POLICY "Insert messages on accessible chats"
ON public.whatsapp_messages FOR INSERT
TO authenticated
WITH CHECK (public.can_access_whatsapp_phone(phone));

CREATE POLICY "Update messages on accessible chats"
ON public.whatsapp_messages FOR UPDATE
TO authenticated
USING (public.can_access_whatsapp_phone(phone))
WITH CHECK (public.can_access_whatsapp_phone(phone));
