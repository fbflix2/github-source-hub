Vou entregar a loja pública do revendedor em fases, para você validar cada etapa antes da próxima.

## Visão geral

Rota pública `/r/:slug` — igual ao layout da /loja atual, porém:
- **Somente proxies** (perfis, BMs, combos ficam ocultos)
- **Preço de venda** definido pelo revendedor (não o custo dele)
- **Banners** do revendedor (audience='reseller') com marca/cor/logo dele
- **Cadastro/login** do cliente final vinculado automaticamente ao revendedor
- **Checkout** completo (PIX/cartão) → pedido registrado com `reseller_id`, comissão/débito de crédito já funciona pelo trigger existente

## Fase 1 — Modelo de preços (esta entrega)

**Banco:**
- Adicionar em `resellers`: `proxy_price_mode` ('multiplier'|'fixed'), `proxy_price_multiplier` (default 1.5), `proxy_fixed_price` (nullable), `whatsapp_number` (contato público), `about_text`, `hero_title`, `hero_subtitle`.
- Adicionar em `profiles`: `reseller_id` (uuid, nullable) — vincula cliente final ao revendedor no cadastro.
- Adicionar em `orders`: garantir que `reseller_id` seja auto-preenchido a partir do `profiles.reseller_id` do comprador (trigger).

**UI do revendedor (`/revenda`):**
- Nova aba "Minha Loja" onde o revendedor configura: multiplicador ou preço fixo, WhatsApp público, textos do hero, cor/logo.

## Fase 2 — Storefront público `/r/:slug`

- Página pública sem auth exigido para navegar.
- Header com logo/nome/cor do revendedor.
- Banner rotativo com banners `audience='reseller'` (só dele, filtrado por `reseller_id` — vamos adicionar coluna `reseller_id` nullable em `banners`; null = todos revendedores).
- Catálogo de proxies (categoria `proxy` apenas) com preço = base × multiplicador (ou preço fixo).
- Cards idênticos ao `ProxyProductCard` da /loja atual.
- Filtro por finalidade (Youtube, TikTok, Apostas, etc).
- Sem chat, sem perfis/BM/combos.

## Fase 3 — Auth + Checkout do cliente final

- `/r/:slug/auth` — login/cadastro. No cadastro, gravar `profiles.reseller_id = <id do revendedor daquele slug>`.
- Cart context já existe. Checkout usa fluxo /checkout atual, mas:
  - Se `profiles.reseller_id` do usuário logado != null → pedido sai com `reseller_id` preenchido.
  - Trigger existente `process_reseller_commission` já debita o custo do saldo do revendedor.
- Após login o cliente vai para `/r/:slug` (não para /loja do FBFlix).
- Meus Pedidos / Wallet do cliente final continuam funcionando, mas escopo visual permanece.

## Fase 4 — Isolamento visual e de rotas

- Cliente com `reseller_id != null` nunca vê /loja FBFlix, nem produtos não-proxy. Redirect global.
- Navbar/branding trocam para marca do revendedor quando o usuário está vinculado a um.

## Detalhes técnicos

- Rota `/r/:slug` adicionada no bloco público de `App.tsx`, antes das rotas autenticadas.
- Novo componente `ResellerPublicStorefront.tsx` (baseado em `ResellerLoja.tsx` já existente).
- Preços calculados no cliente a partir de `resellers.proxy_price_mode` — sem PII exposta.
- RLS: `resellers` recebe policy pública `SELECT` somente das colunas de vitrine (slug, brand_name, logo_url, primary_color, hero_*, whatsapp_number, proxy_price_*). Colunas sensíveis (`balance_credits`, `proxy_unit_cost`, `commission_rate`, `total_gmv`, etc) continuam restritas a admin/owner.
- `banners` ganha `reseller_id uuid null` + policy pública para banners com `audience='reseller' AND active=true`.

## O que vou implementar agora

Fase 1 completa (banco + UI de config no painel do revendedor) + Fase 2 completa (storefront público navegável em `/r/:slug` mostrando os proxies com o preço configurado).

Fases 3 e 4 (checkout/auth do cliente final e isolamento) entrego em seguida, após você validar as fases 1 e 2.

Confirma que posso seguir por esse caminho?