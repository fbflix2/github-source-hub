-- Assign stock item to order ORD-MPLHD6Q6
UPDATE public.stock_items 
SET 
  status = 'vendido', 
  order_item_id = 'ea7a6577-1edf-4f85-9daf-ef14e2c9171d', 
  updated_at = now() 
WHERE id = '38301d04-a23a-4623-913b-350101c7d989';

-- Mark order as completed
UPDATE public.orders 
SET 
  status = 'completed', 
  updated_at = now() 
WHERE id = '80cd4b60-5dec-4614-ae0c-669d6bead657';