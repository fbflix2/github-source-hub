

# Minha Contingência FBFlix - Área do Cliente

## Overview
Create a client-facing dashboard at `/contingencia` (inside MainLayout) where subscribed clients can view their structure status, request replacements, manage their subscription, and access support — all using the existing `ct_*` tables.

## No Database Changes Needed
The existing `ct_*` tables already have the data. We just need RLS policies to let clients read their own data:
- **Migration**: Add SELECT policies on `ct_clients`, `ct_items`, `ct_replacements`, `ct_tickets`, `ct_plans`, `ct_extra_charges` for `auth.uid() = user_id` (on ct_clients) and related joins for child tables.

## Files to Create/Edit

### 1. New: `src/pages/ClientContingencia.tsx`
Single-page client portal with tabs:

**Tab 1 - Visão Geral (Home)**
- Hero card: structure status (green check "100% ativa" or yellow alert)
- KPI cards: Current plan + price, Next billing date, Replacements remaining (progress bar), Active accounts count
- Quick alert if any item has status "block"

**Tab 2 - Minha Estrutura**
- Cards grouped by type (Perfis, Proxies, BMs, Contas) showing count + status badges
- No sensitive data exposed (no IPs, no internal IDs — just "Proxy BR Dedicado - Ativo")
- Button "Pedir Reposição" → modal with reason select + textarea
- Button "Adicionar Conta Extra" → confirms +R$25 deducted from wallet

**Tab 3 - Histórico**
- Table of past replacements: date, type, reason, status, resolution time
- List of ct_tickets with status badges

**Tab 4 - Assinatura**
- Wallet balance (from profiles.balance)
- Billing history (ct_extra_charges)
- Plan comparison cards for upsell
- Cancel button with confirmation dialog

**Tab 5 - Ajuda**
- FAQ accordion
- "Falar com Suporte" button (WhatsApp link)
- Notification bell integration

### 2. Edit: `src/App.tsx`
- Import `ClientContingencia`
- Add route `/contingencia` inside AuthenticatedApp MainLayout routes

### 3. New Migration
- Add RLS SELECT policies so clients can read their own ct_clients row and related ct_items/ct_replacements/ct_tickets/ct_plans

## Styling
- Dark mode clean, consistent with existing MainLayout theme
- Green neon for "active/ok", yellow for alerts, red for blocks
- Mobile-first: large cards, minimal text, clear icons
- Uses existing UI components (Card, Tabs, Badge, Dialog, Progress)

## Technical Details
- Fetch ct_client by `user_id = auth.uid()`, then load related items/replacements/tickets
- Replacement request: INSERT into ct_replacements + ct_tickets
- Extra account: deduct from profiles.balance via wallet_transactions + INSERT ct_extra_charges
- Plan data from ct_plans (already seeded)
- ~500-600 lines single file

