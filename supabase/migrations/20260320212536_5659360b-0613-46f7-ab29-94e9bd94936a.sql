
-- 1. ct_plans
CREATE TABLE public.ct_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tier text NOT NULL DEFAULT 'white',
  price numeric NOT NULL DEFAULT 0,
  profiles_qty integer NOT NULL DEFAULT 0,
  proxies_qty integer NOT NULL DEFAULT 0,
  bms_qty integer NOT NULL DEFAULT 0,
  accounts_qty integer NOT NULL DEFAULT 0,
  replacements_qty integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ct_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage ct_plans" ON public.ct_plans FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 2. ct_clients
CREATE TABLE public.ct_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid REFERENCES public.ct_plans(id),
  telegram text,
  status text NOT NULL DEFAULT 'ativo',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_billing date,
  monthly_value numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ct_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage ct_clients" ON public.ct_clients FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 3. ct_items
CREATE TABLE public.ct_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ct_client_id uuid NOT NULL REFERENCES public.ct_clients(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'perfil',
  identifier text,
  status text NOT NULL DEFAULT 'ativo',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ct_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage ct_items" ON public.ct_items FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 4. ct_replacements
CREATE TABLE public.ct_replacements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ct_client_id uuid NOT NULL REFERENCES public.ct_clients(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  reason text,
  old_item_id uuid REFERENCES public.ct_items(id),
  new_item_id uuid REFERENCES public.ct_items(id),
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ct_replacements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage ct_replacements" ON public.ct_replacements FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 5. ct_tickets
CREATE TABLE public.ct_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ct_client_id uuid NOT NULL REFERENCES public.ct_clients(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'block',
  priority text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'aberto',
  message text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ct_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage ct_tickets" ON public.ct_tickets FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 6. ct_extra_charges
CREATE TABLE public.ct_extra_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ct_client_id uuid NOT NULL REFERENCES public.ct_clients(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ct_extra_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage ct_extra_charges" ON public.ct_extra_charges FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- Seed default plans
INSERT INTO public.ct_plans (name, tier, price, profiles_qty, proxies_qty, bms_qty, accounts_qty, replacements_qty) VALUES
  ('White Starter', 'white', 397, 1, 1, 1, 1, 1),
  ('White Pro', 'white', 597, 2, 2, 2, 2, 2),
  ('White Enterprise', 'white', 997, 4, 4, 4, 4, 4),
  ('Black Starter', 'black', 697, 2, 2, 2, 2, 2),
  ('Black Pro', 'black', 997, 4, 4, 4, 4, 4);
