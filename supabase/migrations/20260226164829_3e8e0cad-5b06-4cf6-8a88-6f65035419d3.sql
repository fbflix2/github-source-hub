
-- Helper: create a function to check if user is staff (admin OR moderator)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'moderator')
  )
$$;

-- ==================== PROFILES ====================
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Staff can view all profiles" ON profiles FOR SELECT USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Staff can update all profiles" ON profiles FOR UPDATE USING (is_staff(auth.uid()));

-- ==================== ORDERS ====================
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
CREATE POLICY "Staff can view all orders" ON orders FOR SELECT USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all orders" ON orders;
CREATE POLICY "Staff can update all orders" ON orders FOR UPDATE USING (is_staff(auth.uid()));

-- ==================== ORDER_ITEMS ====================
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
CREATE POLICY "Staff can view all order items" ON order_items FOR SELECT USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all order items" ON order_items;
CREATE POLICY "Staff can update all order items" ON order_items FOR UPDATE USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete all order items" ON order_items;
CREATE POLICY "Staff can delete all order items" ON order_items FOR DELETE USING (is_staff(auth.uid()));

-- ==================== PAYMENTS ====================
DROP POLICY IF EXISTS "Admins can manage all payments" ON payments;
CREATE POLICY "Staff can manage all payments" ON payments FOR ALL USING (is_staff(auth.uid()));

-- ==================== PRODUCTS ====================
DROP POLICY IF EXISTS "Admins can manage products" ON products;
CREATE POLICY "Staff can manage products" ON products FOR ALL USING (is_staff(auth.uid()));

-- ==================== PRODUCT_CATEGORIES ====================
DROP POLICY IF EXISTS "Admins can manage categories" ON product_categories;
CREATE POLICY "Staff can manage categories" ON product_categories FOR ALL USING (is_staff(auth.uid()));

-- ==================== PRODUCT_DEFAULTS ====================
DROP POLICY IF EXISTS "Admins can manage product defaults" ON product_defaults;
CREATE POLICY "Staff can manage product defaults" ON product_defaults FOR ALL USING (is_staff(auth.uid()));

-- ==================== PRODUCT_IMAGES ====================
DROP POLICY IF EXISTS "Admins can manage product images" ON product_images;
CREATE POLICY "Staff can manage product images" ON product_images FOR ALL USING (is_staff(auth.uid()));

-- ==================== STOCK_ITEMS ====================
DROP POLICY IF EXISTS "Admins can manage stock" ON stock_items;
CREATE POLICY "Staff can manage stock" ON stock_items FOR ALL USING (is_staff(auth.uid()));

-- ==================== STOCK_FOLDERS ====================
DROP POLICY IF EXISTS "Admins can manage stock folders" ON stock_folders;
CREATE POLICY "Staff can manage stock folders" ON stock_folders FOR ALL USING (is_staff(auth.uid()));

-- ==================== SUBSCRIPTIONS ====================
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON subscriptions;
CREATE POLICY "Staff can manage all subscriptions" ON subscriptions FOR ALL USING (is_staff(auth.uid()));

-- ==================== TICKETS ====================
DROP POLICY IF EXISTS "Admins can manage all tickets" ON tickets;
CREATE POLICY "Staff can manage all tickets" ON tickets FOR ALL USING (is_staff(auth.uid()));

-- ==================== TICKET_MESSAGES ====================
DROP POLICY IF EXISTS "Admins can manage all messages" ON ticket_messages;
CREATE POLICY "Staff can manage all messages" ON ticket_messages FOR ALL USING (is_staff(auth.uid()));

-- ==================== TICKET_RATINGS ====================
DROP POLICY IF EXISTS "Admins can view all ratings" ON ticket_ratings;
CREATE POLICY "Staff can view all ratings" ON ticket_ratings FOR SELECT USING (is_staff(auth.uid()));

-- ==================== TUTORIALS ====================
DROP POLICY IF EXISTS "Admins can manage tutorials" ON tutorials;
CREATE POLICY "Staff can manage tutorials" ON tutorials FOR ALL USING (is_staff(auth.uid()));

-- ==================== BANNERS ====================
DROP POLICY IF EXISTS "Admins can manage banners" ON banners;
CREATE POLICY "Staff can manage banners" ON banners FOR ALL USING (is_staff(auth.uid()));

-- ==================== NOTIFICATIONS ====================
DROP POLICY IF EXISTS "Admins can manage notifications" ON notifications;
CREATE POLICY "Staff can manage notifications" ON notifications FOR ALL USING (is_staff(auth.uid()));

-- ==================== COUPONS ====================
DROP POLICY IF EXISTS "Admins can manage coupons" ON coupons;
CREATE POLICY "Staff can manage coupons" ON coupons FOR ALL USING (is_staff(auth.uid()));

-- ==================== AFFILIATES ====================
DROP POLICY IF EXISTS "Admins can manage affiliates" ON affiliates;
CREATE POLICY "Staff can manage affiliates" ON affiliates FOR ALL USING (is_staff(auth.uid()));

-- ==================== CLIENT_NOTES ====================
DROP POLICY IF EXISTS "Admins can manage client notes" ON client_notes;
CREATE POLICY "Staff can manage client notes" ON client_notes FOR ALL USING (is_staff(auth.uid()));

-- ==================== PURCHASES ====================
DROP POLICY IF EXISTS "Admins can manage purchases" ON purchases;
CREATE POLICY "Staff can manage purchases" ON purchases FOR ALL USING (is_staff(auth.uid()));

-- ==================== SITE_SETTINGS ====================
DROP POLICY IF EXISTS "Admins can manage settings" ON site_settings;
CREATE POLICY "Staff can manage settings" ON site_settings FOR ALL USING (is_staff(auth.uid()));

-- ==================== API_KEYS ====================
DROP POLICY IF EXISTS "Admins can view api_keys" ON api_keys;
CREATE POLICY "Staff can view api_keys" ON api_keys FOR SELECT USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert api_keys" ON api_keys;
CREATE POLICY "Staff can insert api_keys" ON api_keys FOR INSERT WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can update api_keys" ON api_keys;
CREATE POLICY "Staff can update api_keys" ON api_keys FOR UPDATE USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete api_keys" ON api_keys;
CREATE POLICY "Staff can delete api_keys" ON api_keys FOR DELETE USING (is_staff(auth.uid()));

-- ==================== ADS ====================
DROP POLICY IF EXISTS "Admins can view all ads" ON ads;
CREATE POLICY "Staff can view all ads" ON ads FOR SELECT USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all ads" ON ads;
CREATE POLICY "Staff can update all ads" ON ads FOR UPDATE USING (is_staff(auth.uid()));

-- ==================== USER_ROLES ====================
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;
CREATE POLICY "Staff can manage all roles" ON user_roles FOR ALL USING (is_staff(auth.uid()));

-- ==================== WALLET_TRANSACTIONS ====================
DROP POLICY IF EXISTS "Admins can view all transactions" ON wallet_transactions;
CREATE POLICY "Staff can view all transactions" ON wallet_transactions FOR SELECT USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert transactions" ON wallet_transactions;
CREATE POLICY "Staff can insert transactions" ON wallet_transactions FOR INSERT WITH CHECK (is_staff(auth.uid()));

-- ==================== MODERATOR_PERMISSIONS ====================
DROP POLICY IF EXISTS "Admins can manage moderator permissions" ON moderator_permissions;
CREATE POLICY "Staff can manage moderator permissions" ON moderator_permissions FOR ALL USING (is_staff(auth.uid()));
