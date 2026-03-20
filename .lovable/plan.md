

# Contingência Total FBFlix - Painel Admin

## Overview
Create a complete admin module for managing the "Contingência Total" subscription service (White/Black plans) with dedicated database tables, a multi-tab admin page, and full CRUD operations.

## Database Schema (Migration)

**6 new tables:**

1. **ct_plans** — Plan definitions (White Starter, White Pro, White Enterprise, Black Starter, Black Pro) with columns: name, tier (white/black), price, profiles_qty, proxies_qty, bms_qty, accounts_qty, replacements_qty, active
2. **ct_clients** — Subscribed clients: user_id, plan_id, telegram, status (ativo/em_reposicao/suspenso/cancelado), start_date, next_billing, monthly_value, notes
3. **ct_items** — Individual items assigned to each client: ct_client_id, type (perfil/proxy/bm/conta), identifier, status (ativo/block/substituido), metadata (jsonb for IP, proxy swaps, etc.)
4. **ct_replacements** — Replacement history: ct_client_id, item_type, reason, old_item_id, new_item_id, performed_by, created_at
5. **ct_tickets** — Support tickets: ct_client_id, type (block/proxy/analise_meta), priority (alta/media/baixa), status, message, resolved_at
6. **ct_extra_charges** — Extra account charges: ct_client_id, description, amount, created_at

All tables with RLS policies for staff-only access.

## Frontend Implementation

**Single page: `src/pages/admin/AdminContingencia.tsx`** with tab-based navigation (using existing Tabs component):

### Tab 1: Dashboard
- KPI cards: Total active subscriptions, White clients, Black clients, Replacements this month, MRR
- Alert cards: Pending replacements, Blocked structures
- Mini chart: MRR trend (last 6 months)

### Tab 2: Clientes
- Searchable/filterable table (plan tier, status)
- Columns: Name/Telegram, Plan, Status badge, Start date, Next billing, Monthly value, Total items
- "Ver Estrutura" button opens **client structure modal**
- "Novo Cliente" button with plan auto-fill
- CSV export button

### Tab 3: Estrutura do Cliente (Modal)
- Shows all items grouped by type (Perfis, Proxies, BMs, Contas)
- Replacement counter (used/total)
- Action buttons: Register replacement, Add extra account (+R$20-25), Swap proxy, Send Multilogin access

### Tab 4: Planos
- Editable table of all plans with quantities and prices
- Inline editing with save

### Tab 5: Reposições
- History table: Client, Date, Type, Reason, Status
- Filters by date and type

### Tab 6: Suporte
- Ticket list: Client, Type, Priority, Response time
- Quick status updates

### Tab 7: Financeiro
- MRR total, Churn rate, Pending payments
- Integration with existing wallet balance

## Routing
- Add route `/admin/contingencia` inside AdminLayout
- Add sidebar link in AdminSidebar

## Styling
- Uses existing dark admin theme (bg-[#0a0505])
- Neon green action buttons, blue/purple accent cards
- Consistent with existing admin pages

## Technical Details
- All data fetched via Supabase client with react-query
- Realtime subscriptions for tickets/replacements notifications
- Bell icon notification count for pending replacements
- XLSX export using existing `xlsx` dependency
- Seed ct_plans with the 5 default plans via migration INSERT

## Files to Create/Edit
1. **New migration** — All 6 tables + seed plans + RLS policies
2. **New** `src/pages/admin/AdminContingencia.tsx` — Main page (~800-1000 lines, tab-based)
3. **Edit** `src/App.tsx` — Add route
4. **Edit** `src/components/admin/AdminSidebar.tsx` — Add nav link

