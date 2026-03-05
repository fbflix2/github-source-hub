

## BM Post-Sale Management System

### Context

When a BM (Business Manager) is sold, the team keeps a backup admin profile on the client's BM for 7 days. After 7 days, the client should remove the backup profile. This process needs tracking and automation.

### Solution: New "Gestão BMs" admin page + database table

#### 1. New table: `bm_tracking`

Tracks each sold BM unit with its 7-day countdown:

```sql
CREATE TABLE public.bm_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id),
  order_item_id uuid REFERENCES order_items(id),
  stock_item_id uuid REFERENCES stock_items(id),
  client_user_id uuid NOT NULL,
  client_name text,
  client_email text,
  product_name text NOT NULL,
  bm_link text NOT NULL,
  sale_price numeric NOT NULL DEFAULT 0,
  sold_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  status text NOT NULL DEFAULT 'active', -- active, notified, removed, expired
  notified_at timestamptz,
  removed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bm_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage bm_tracking"
  ON public.bm_tracking FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()));
```

- **`status`** flow: `active` -> `notified` (client was alerted at day 7) -> `removed` (client removed us) or `expired` (day 8+, no longer our responsibility)
- **`expires_at`**: auto-calculated as `sold_at + 7 days`

#### 2. New admin page: `/admin/gestao-bms`

A dedicated page with:

- **Summary cards**: Total active BMs, expiring today, expired (day 8+), already removed
- **Table** with columns: Client name, BM Link, Product, Sale price, Sold date, Countdown timer (days:hours remaining), Status badge
- **Filters**: By status (active/notified/expired/removed), search by client
- **Row actions**:
  - "Notificar Cliente" button — sends a notification to the client saying they can remove the backup profile (marks status as `notified`)
  - "Marcar como Removido" — confirms the client removed the backup
  - Visual alert for BMs past 7 days that haven't been actioned
- **Color coding**: Green = within 7 days, Yellow = day 7 (expiring today), Red = day 8+ (expired, no longer responsible)

#### 3. Auto-populate from sales

When a BM order is fulfilled (already handled by `fulfill_order_item`), we'll add logic to automatically insert rows into `bm_tracking` for each BM link in the delivery data. This will be done by checking `icon_type = 'bm'` on completed orders.

Alternatively, a manual "Import from Orders" button on the page to backfill existing BM sales.

#### 4. Client notification

When "Notificar Cliente" is clicked, insert a record into the `notifications` table for that client with a message like: "Seus 7 dias de backup na BM expiraram. Por favor, remova nosso perfil de administrador."

#### 5. Sidebar entry

Add "Gestão BMs" to the admin sidebar, likely near "Central Proxy" or after "Trocas".

### Files to create/modify

1. **Migration**: Create `bm_tracking` table with RLS
2. **`src/pages/admin/AdminGestaoBMs.tsx`**: New page with table, filters, countdown timers, action buttons
3. **`src/App.tsx`**: Add route `/admin/gestao-bms`
4. **`src/components/admin/AdminSidebar.tsx`**: Add menu item
5. **`src/pages/admin/AdminPedidos.tsx`** (optional): Add "Enviar para Gestão BM" action on BM orders

