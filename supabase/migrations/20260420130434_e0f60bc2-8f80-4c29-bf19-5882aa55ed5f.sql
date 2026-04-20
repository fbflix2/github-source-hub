-- ============================================================
-- 1. INVOICE_LINKS: remover política pública permissiva
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view invoice by code" ON public.invoice_links;
DROP POLICY IF EXISTS "Public can view invoice by code" ON public.invoice_links;

-- Garantir que apenas owner ou staff podem ver via cliente Supabase
-- (a página pública de pagamento usa edge function `invoice-lookup` com service role)
DROP POLICY IF EXISTS "Owner or staff can view invoice links" ON public.invoice_links;
CREATE POLICY "Owner or staff can view invoice links"
ON public.invoice_links
FOR SELECT
TO authenticated
USING (
  auth.uid() = client_user_id
  OR public.is_staff(auth.uid())
);

-- ============================================================
-- 2. NOTIFICATIONS: restringir leitura global a autenticados
-- ============================================================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR (global = true AND auth.uid() IS NOT NULL)
);

-- ============================================================
-- 3. REALTIME.MESSAGES: bloquear escuta de canais internos
-- ============================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Limpar policies anteriores (se houver)
DROP POLICY IF EXISTS "Authenticated can receive non-staff topics" ON realtime.messages;
DROP POLICY IF EXISTS "Staff can receive any topic" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can send non-staff topics" ON realtime.messages;
DROP POLICY IF EXISTS "Staff can send any topic" ON realtime.messages;

-- Tópicos considerados internos (somente staff pode acessar)
-- Prefixos: team-chat, admin-, staff-, presence-staff, page-requests
-- Recebimento (SELECT) — usuários autenticados podem escutar canais NÃO-internos
CREATE POLICY "Authenticated can receive non-staff topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() NOT LIKE 'team-chat%'
  AND realtime.topic() NOT LIKE 'admin-%'
  AND realtime.topic() NOT LIKE 'staff-%'
  AND realtime.topic() NOT LIKE 'presence-staff%'
  AND realtime.topic() NOT LIKE 'page-requests%'
);

-- Recebimento — staff pode escutar qualquer canal
CREATE POLICY "Staff can receive any topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

-- Envio (INSERT) — usuários autenticados podem publicar em canais NÃO-internos
CREATE POLICY "Authenticated can send non-staff topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() NOT LIKE 'team-chat%'
  AND realtime.topic() NOT LIKE 'admin-%'
  AND realtime.topic() NOT LIKE 'staff-%'
  AND realtime.topic() NOT LIKE 'presence-staff%'
  AND realtime.topic() NOT LIKE 'page-requests%'
);

-- Envio — staff pode publicar em qualquer canal
CREATE POLICY "Staff can send any topic"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));