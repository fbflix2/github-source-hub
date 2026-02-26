
-- Allow users to view stock items linked to their own orders
CREATE POLICY "Users can view own stock items"
  ON public.stock_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = stock_items.order_item_id
        AND o.user_id = auth.uid()
    )
  );

-- Allow users to update status of their own stock items (for OK/blocked feedback)
CREATE POLICY "Users can update own stock item status"
  ON public.stock_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = stock_items.order_item_id
        AND o.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = stock_items.order_item_id
        AND o.user_id = auth.uid()
    )
  );
