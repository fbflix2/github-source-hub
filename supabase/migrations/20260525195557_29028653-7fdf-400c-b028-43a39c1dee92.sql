UPDATE public.stock_items 
SET 
  status = 'vendido', 
  order_item_id = '0483bb14-6bc7-4ea2-9530-40e32c80ffd2',
  updated_at = now()
WHERE id = '36c85064-0d30-440b-af4a-24473ff67875';