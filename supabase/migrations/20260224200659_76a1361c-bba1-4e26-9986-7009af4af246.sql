-- Allow admins to update order_items (needed to unlink products before deletion)
CREATE POLICY "Admins can update all order items"
ON public.order_items FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete order_items
CREATE POLICY "Admins can delete all order items"
ON public.order_items FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));