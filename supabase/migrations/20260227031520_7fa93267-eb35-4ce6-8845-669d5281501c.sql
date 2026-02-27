-- Delete order_items for abandoned/processing test orders
DELETE FROM public.order_items WHERE order_id IN (
  SELECT id FROM public.orders WHERE status IN ('abandoned', 'processing')
);

-- Delete the abandoned/processing test orders
DELETE FROM public.orders WHERE status IN ('abandoned', 'processing');