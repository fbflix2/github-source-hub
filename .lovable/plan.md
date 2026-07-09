
# Painel de Revenda White-Label de Proxies

Vamos construir um painel completo onde revendedores vendem os proxies da FBFlix com marca própria. O admin escolhe qual modelo (% ou crédito) cada revendedor usa. Os clientes finais aparecem no FBFlix, marcados com o revendedor responsável. Pagamentos rodam via OpenPix com split automático.

Como o escopo é grande, divido em 4 fases entregáveis. Você aprova a fase, entrego, testamos, e seguimos.

---

## Fase 1 — Fundação e modelo de Parceria (%)

Objetivo: colocar o cadastro de revendedor de pé, com painel funcional no modelo mais simples (25% líquido, sem crédito).

**Backend (banco)**
- Nova tabela `resellers` (cadastro do revendedor):
  - `id`, `user_id`, `slug`, `company_name`, `status` (active/suspended/inactive)
  - `model` ('percentage' | 'credit') — definido pelo admin
  - `commission_rate` (default 25) — usado no modelo %
  - `balance_credits` (default 0) — usado no modelo crédito
  - `min_proxies_per_month` (default 5) — regra de atividade %
  - `min_monthly_recharge` (default 100) — regra de atividade crédito
  - branding: `logo_url`, `favicon_url`, `primary_color`, `accent_color`, `brand_name`, `support_email`, `support_whatsapp`
  - domínio: `custom_domain`, `domain_status` (pending/verified/failed), `domain_verified_at`
  - openpix: `openpix_pix_key`, `openpix_split_percentage`
  - `created_at`, `updated_at`
- Nova coluna em `subscriptions` e `orders`: `reseller_id` (FK opcional).
- Nova coluna em `profiles`: `reseller_id` (marca a qual revendedor o cliente pertence).
- Tabela `reseller_monthly_stats` — snapshot mensal de proxies ativados e recargas, usada para checar regra de atividade.
- RLS: revendedor só vê os próprios clientes/pedidos; admin vê tudo; políticas via `has_role`.

**Rotas do painel do revendedor** (`/revenda/*` no domínio próprio)
- `/login` — auth Supabase padrão isolada
- `/dashboard` — MRR, proxies ativos, clientes, saldo (comissão pendente/liberada)
- `/clientes` — CRUD de clientes finais (cria user no FBFlix já com `reseller_id`)
- `/vendas` — lista de pedidos originados pelo revendedor
- `/proxies` — catálogo de proxies FBFlix, pode filtrar/marcar favoritos
- `/configuracoes` — branding (logo, cores, nome), domínio (CNAME)
- `/financeiro` — comissões, extrato, solicitar saque (reaproveita `partner_withdrawals`)

**White-label + CNAME**
- Edge function `reseller-resolve-domain` que recebe host e devolve o revendedor.
- Provider React `ResellerBrandingProvider` que aplica CSS vars `--reseller-primary`, `--reseller-accent`, logo e brand name em runtime.
- Fluxo de CNAME: revendedor aponta `painel.dominiodele.com` → `cname.fbflix.com.br`. Painel gera TXT de verificação. Enquanto `domain_status != verified`, mostra instruções.
- Ambiente inicial: certificado SSL usando Lovable Custom Domain padrão (185.158.133.1). Se precisar de wildcard automático por revendedor, avaliamos Cloudflare for SaaS numa fase posterior.

**Admin (FBFlix)**
- Nova página `/admin/revendedores`:
  - listar, criar, editar, suspender revendedores
  - escolher modelo (% ou crédito) e ajustar taxas/mínimos individualmente
  - ver métricas de atividade (proxies ativos mês, recarga mês)
  - forçar liberação/bloqueio de painel
- Reaproveita padrões de `AdminClientes.tsx`.

**Comissão %**
- Ao completar pedido com `reseller_id` no modelo %: gera registro em `reseller_commissions` (nova tabela, análoga a `partner_referrals`), 25% do líquido, com janela de garantia de 7 dias.
- Trigger `release_reseller_commissions` diária.

---

## Fase 2 — Modelo de Crédito

Objetivo: revendedor recarrega saldo em créditos e "compra" proxies a R$10 cada, define preço próprio ao cliente final.

**Banco**
- Tabela `reseller_credit_ledger`: `reseller_id`, `type` (recharge/purchase/refund/adjustment), `amount`, `balance_after`, `reference_id`, `created_at`.
- Tabela `reseller_price_overrides`: `reseller_id`, `product_id`, `custom_price` — se null, usa preço sugerido FBFlix.
- Tabela `reseller_recharges`: histórico de recargas OpenPix.

**Fluxo de compra de proxy (modelo crédito)**
1. Cliente final do revendedor faz pedido no painel white-label
2. Painel debita R$10 do `balance_credits` do revendedor por proxy
3. Cria `subscription` normal no FBFlix com `reseller_id` marcado
4. Cliente final recebe o proxy, revendedor cobrou o preço próprio dele
5. Se saldo insuficiente → bloqueia e mostra "Recarregar créditos"

**Recarga OpenPix**
- Página `/revenda/creditos/recarregar` — mínimo R$100
- Reaproveita `create-pix-payment` mas gera cobrança no PIX do revendedor via OpenPix split? Não — recarga é do revendedor pagando FBFlix, então PIX vai pra FBFlix normal. Créditos entram após webhook confirmar.

**Preço sugerido vs preço próprio**
- No painel, revendedor vê cada produto com "Preço sugerido: R$X" e input "Meu preço: R$Y"
- Salva em `reseller_price_overrides`
- Página pública do produto no domínio dele mostra o preço dele

---

## Fase 3 — OpenPix com Split de Pagamento

Objetivo: cliente final paga no domínio do revendedor, valor entra dividido automaticamente (revendedor + FBFlix).

**Modelo %:** cliente paga X, split envia 25% líquido pro revendedor, 75% pra FBFlix.
**Modelo crédito:** cliente paga preço definido pelo revendedor, 100% vai pro revendedor (FBFlix já foi paga na recarga de crédito).

**Implementação**
- Extender `create-pix-payment` para aceitar `reseller_id`
- Se OpenPix suportar `splits[]` no payload de charge, incluir chave PIX do revendedor e percentual
- Webhook `openpix-webhook` já existe — só precisa reconhecer pedidos com `reseller_id` e registrar transação no ledger correto
- Se OpenPix não tiver split nativo do plano da FBFlix, alternativa: cliente paga FBFlix, edge function agenda payout via `openpix-withdraw-request` pro revendedor (menos elegante mas funciona)

**Segurança**
- Chave PIX do revendedor validada antes de ativar split
- Log de todas as transferências em `reseller_payouts`

---

## Fase 4 — Regras de atividade e desligamento

Objetivo: cron diário que verifica se cada revendedor cumpre o mínimo mensal.

- Edge function `reseller-activity-check` (cron diário):
  - Modelo %: se `proxies_activated_this_month < 5` no fim do mês → status `warning`. Mês seguinte sem cumprir → `suspended`.
  - Modelo crédito: se `total_recharge_this_month < 100` → mesmas regras.
- Notificações WhatsApp + email 7 dias antes do fim do mês avisando.
- Painel bloqueado para novos pedidos quando `suspended`, mas clientes existentes continuam ativos.

---

## Detalhes técnicos

**Rotas e isolamento**
- `App.tsx` detecta host via `window.location.hostname`. Se corresponde a `custom_domain` de algum revendedor → carrega `<ResellerApp />` em vez de `<App />` normal.
- `<ResellerApp />` tem `AuthProvider` isolado (sessão do cliente final do revendedor não colide com sessão FBFlix).
- Domínio `fbflix.com.br` e `.lovable.app` continuam com app normal.

**Design System**
- Painel do revendedor herda tokens FBFlix (glass-card, Space Grotesk/Manrope) mas com cores sobrescritas via CSS vars `--primary`, `--accent` do branding do revendedor.
- Logo do revendedor substitui o Play/FBFlix no sidebar e no header.
- Nome da marca substitui "FBFlix" em todos os textos visíveis pro cliente final.

**Segurança/Isolamento de dados**
- RLS em `resellers`, `reseller_commissions`, `reseller_credit_ledger`: revendedor só lê o próprio registro.
- Edge functions que recebem `reseller_id` sempre validam via JWT do revendedor, nunca confiam no corpo.
- Cliente final só vê os produtos que o revendedor escolheu vender (opcional futuro: catálogo customizado).

**Métricas admin**
- Nova aba em `/admin/revendedores/:id`: performance individual, GMV, comissões pagas, taxa de conversão.
- Dashboard geral: top 10 revendedores, receita por canal, ticket médio.

---

## Ordem de entrega proposta

| Sprint | Escopo | Tempo estimado |
|--------|--------|----------------|
| 1 | Fase 1 completa (cadastro + painel % + white-label básico) | 1 sprint |
| 2 | CNAME + verificação de domínio + branding avançado | ½ sprint |
| 3 | Fase 2 completa (modelo crédito + preços) | 1 sprint |
| 4 | Fase 3 (OpenPix split) | ½–1 sprint (depende do que OpenPix expõe) |
| 5 | Fase 4 (regras de atividade + notificações) | ½ sprint |

**Sugestão:** começar pela Fase 1. Ela já dá para operar revendedores no modelo % (que é o mais simples e testa toda a arquitetura de white-label + isolamento). Assim a gente valida o fluxo antes de investir em crédito e split.

Quando aprovar, começo pela Fase 1: migrations de `resellers`, página admin de gestão, cadastro/login do revendedor e dashboard básico. Se quiser ajustar prioridades ou remover algo, me diz.
