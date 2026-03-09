
-- Add FBX balance to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fbx_balance numeric NOT NULL DEFAULT 0;

-- FBX P2P Orders
CREATE TABLE public.fbx_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('buy', 'sell')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'escrow', 'completed', 'cancelled', 'expired')),
  matched_user_id uuid REFERENCES auth.users(id),
  matched_at timestamptz,
  pix_key text,
  pix_qr_code text,
  fee_rate numeric NOT NULL DEFAULT 0.06,
  fee_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fbx_orders ENABLE ROW LEVEL SECURITY;

-- FBX Transactions log
CREATE TABLE public.fbx_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('recharge', 'transfer_in', 'transfer_out', 'p2p_buy', 'p2p_sell', 'purchase', 'fee', 'refund')),
  amount numeric NOT NULL,
  fee numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL,
  balance_after numeric NOT NULL DEFAULT 0,
  reference_id text,
  counterpart_user_id uuid REFERENCES auth.users(id),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fbx_transactions ENABLE ROW LEVEL SECURITY;

-- RLS for fbx_orders
CREATE POLICY "Users can view own fbx orders" ON public.fbx_orders FOR SELECT USING (auth.uid() = user_id OR auth.uid() = matched_user_id);
CREATE POLICY "Users can view open orders" ON public.fbx_orders FOR SELECT USING (status = 'open');
CREATE POLICY "Users can insert own fbx orders" ON public.fbx_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own fbx orders" ON public.fbx_orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Staff can manage fbx orders" ON public.fbx_orders FOR ALL USING (is_staff(auth.uid()));

-- RLS for fbx_transactions
CREATE POLICY "Users can view own fbx transactions" ON public.fbx_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Staff can manage fbx transactions" ON public.fbx_transactions FOR ALL USING (is_staff(auth.uid()));

-- Updated_at trigger for fbx_orders
CREATE TRIGGER update_fbx_orders_updated_at BEFORE UPDATE ON public.fbx_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
