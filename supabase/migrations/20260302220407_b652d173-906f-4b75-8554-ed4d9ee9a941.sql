-- Allow staff to insert orders (for manual sales)
CREATE POLICY "Staff can insert orders"
ON public.orders
FOR INSERT
WITH CHECK (is_staff(auth.uid()));

-- Allow staff to insert order items (for manual sales)
CREATE POLICY "Staff can insert order items"
ON public.order_items
FOR INSERT
WITH CHECK (is_staff(auth.uid()));