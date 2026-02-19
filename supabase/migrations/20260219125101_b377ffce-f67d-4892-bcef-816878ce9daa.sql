
-- 1. User Roles (admin system)
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 2. Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  address TEXT,
  cep TEXT,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Product Categories
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.product_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 4. Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_label TEXT,
  image_url TEXT,
  icon_type TEXT DEFAULT 'perfil',
  category_id UUID REFERENCES public.product_categories(id),
  tags TEXT[] DEFAULT '{}',
  stock INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  badge_text TEXT,
  badge_color TEXT,
  badge_icon TEXT,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 5. Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  payment_method TEXT,
  payment_last4 TEXT,
  payment_expiry TEXT,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all orders" ON public.orders FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- 6. Order Items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  delivery_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Users can insert own order items" ON public.order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Admins can view all order items" ON public.order_items FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 7. Wallet Transactions
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'deposit', 'purchase', 'bonus', 'refund'
  title TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  balance_after NUMERIC(10,2),
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.wallet_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all transactions" ON public.wallet_transactions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert transactions" ON public.wallet_transactions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. Subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id),
  name TEXT NOT NULL,
  type TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 9. Tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tickets" ON public.tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tickets" ON public.tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tickets" ON public.tickets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all tickets" ON public.tickets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 10. Ticket Messages
CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  sender TEXT NOT NULL DEFAULT 'user',
  read BOOLEAN NOT NULL DEFAULT false,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ticket messages" ON public.ticket_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.tickets WHERE tickets.id = ticket_messages.ticket_id AND tickets.user_id = auth.uid()));
CREATE POLICY "Users can insert messages to own tickets" ON public.ticket_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.tickets WHERE tickets.id = ticket_messages.ticket_id AND tickets.user_id = auth.uid()));
CREATE POLICY "Users can update own ticket messages" ON public.ticket_messages FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.tickets WHERE tickets.id = ticket_messages.ticket_id AND tickets.user_id = auth.uid()));
CREATE POLICY "Admins can manage all messages" ON public.ticket_messages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 11. Ticket Ratings
CREATE TABLE public.ticket_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ratings" ON public.ticket_ratings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ratings" ON public.ticket_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all ratings" ON public.ticket_ratings FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 12. Coupons
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'percent', -- 'percent', 'fixed', 'free'
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  max_uses INTEGER NOT NULL DEFAULT 100,
  used_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active coupons" ON public.coupons FOR SELECT USING (true);
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 13. Banners
CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  cta_text TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active banners" ON public.banners FOR SELECT USING (active = true);
CREATE POLICY "Admins can manage banners" ON public.banners FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 14. Tutorials
CREATE TABLE public.tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  category TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published tutorials" ON public.tutorials FOR SELECT USING (published = true);
CREATE POLICY "Admins can manage tutorials" ON public.tutorials FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 15. Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id OR global = true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage notifications" ON public.notifications FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 16. Affiliates
CREATE TABLE public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  referral_code TEXT NOT NULL UNIQUE,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
  total_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own affiliate data" ON public.affiliates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage affiliates" ON public.affiliates FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 17. Stock Items (internal inventory)
CREATE TABLE public.stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'bm', 'perfil', 'pagina', 'proxy'
  name TEXT NOT NULL,
  identification TEXT,
  identification_link TEXT,
  status TEXT NOT NULL DEFAULT 'aguardando', -- 'aguardando', 'revisado', 'erro', 'vendido'
  product_id UUID REFERENCES public.products(id),
  order_item_id UUID REFERENCES public.order_items(id),
  folder TEXT,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage stock" ON public.stock_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 18. Site Settings / Terms
CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.site_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 19. Payments (transaction records)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id),
  gateway TEXT NOT NULL, -- 'pix', 'card', 'saldo'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'cancelled', 'refunded'
  amount NUMERIC(10,2) NOT NULL,
  gateway_reference TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all payments" ON public.payments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tutorials_updated_at BEFORE UPDATE ON public.tutorials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Useful indexes
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_stock_items_type ON public.stock_items(type);
CREATE INDEX idx_products_category_id ON public.products(category_id);
