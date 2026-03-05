
ALTER TABLE public.replacements
  ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  ADD COLUMN new_stock_item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL;
