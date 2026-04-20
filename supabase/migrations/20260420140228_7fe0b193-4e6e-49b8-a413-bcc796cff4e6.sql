-- 1. Criar produto local equivalente (sem external_id → roteado para estoque interno)
INSERT INTO public.products (
  name, description, price, image_url, icon_type, category_id,
  tags, stock, status, available, slug, external_id
) VALUES (
  'PROXY| Alta rotação web scraping BR',
  'Uso Exclusívo: WEB SCRAPING, ALTA DEMANDA DE TROCAS
Localização: Brasil
Protocolo: HTTP
Tipo: IPV4
Trocas Grátis: 2
Trocas Adicionais: 25%
Válido por 30 Dias
Não serve para Contingência',
  15.00,
  '/images/proxy/proxy-05.png',
  'proxy',
  'b487fee2-74a3-47e5-a2c5-f2c2deb86ad3',
  ARRAY['HTTP','BR','IPV4','Alta demanda','Web Scraping'],
  0,
  'active',
  true,
  'proxy-alta-rotacao-web-scraping-br',
  NULL
);

-- 2. SECURITY: fbx_orders — remover policy ampla que expõe pix_key de outros usuários
DROP POLICY IF EXISTS "Authenticated users can view open orders" ON public.fbx_orders;

-- Substituída por policy restrita: dono ou contraparte (já existente "Users can view own fbx orders" cobre user_id e matched_user_id).
-- Para permitir que o orderbook continue listando ordens abertas SEM expor pix, criar view pública sanitizada
CREATE OR REPLACE VIEW public.fbx_orders_public AS
SELECT
  id,
  user_id,
  type,
  quantity,
  status,
  fee_rate,
  fee_amount,
  created_at,
  updated_at
FROM public.fbx_orders
WHERE status = 'open';

GRANT SELECT ON public.fbx_orders_public TO authenticated;

-- 3. SECURITY: admin_notifications — restringir SELECT a notificações globais ou direcionadas ao próprio usuário
DROP POLICY IF EXISTS "Users can read active admin_notifications" ON public.admin_notifications;

CREATE POLICY "Users can read targeted admin_notifications"
ON public.admin_notifications FOR SELECT
TO authenticated
USING (
  is_active = true
  AND status = ANY (ARRAY['sent'::text, 'active'::text])
  AND (
    global = true
    OR auth.uid() = ANY (target_user_ids)
  )
);