-- Suppliers
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage suppliers"
ON public.suppliers FOR ALL
TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

CREATE TRIGGER trg_suppliers_updated
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Supplier batches
CREATE TABLE public.supplier_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  purchased_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_batches_supplier ON public.supplier_batches(supplier_id);

ALTER TABLE public.supplier_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage supplier_batches"
ON public.supplier_batches FOR ALL
TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

CREATE TRIGGER trg_supplier_batches_updated
BEFORE UPDATE ON public.supplier_batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Supplier accounts
CREATE TABLE public.supplier_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.supplier_batches(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  profile_link text,
  login text,
  password text,
  status text NOT NULL DEFAULT 'aguardando', -- aguardando | em_teste | aprovado | reprovado
  logged_in boolean NOT NULL DEFAULT false,
  login_result text, -- ok | checkpoint | bloqueado | documento | suspenso_anuncios
  sold boolean NOT NULL DEFAULT false,
  client_name text,
  sold_at timestamptz,
  country text,
  account_year integer,
  has_bm boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_accounts_batch ON public.supplier_accounts(batch_id);
CREATE INDEX idx_supplier_accounts_supplier ON public.supplier_accounts(supplier_id);
CREATE INDEX idx_supplier_accounts_status ON public.supplier_accounts(status);

ALTER TABLE public.supplier_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage supplier_accounts"
ON public.supplier_accounts FOR ALL
TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

CREATE TRIGGER trg_supplier_accounts_updated
BEFORE UPDATE ON public.supplier_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();