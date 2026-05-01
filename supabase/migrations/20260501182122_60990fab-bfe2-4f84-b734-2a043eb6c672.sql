-- Add is_combo column to order_bumps
ALTER TABLE public.order_bumps ADD COLUMN IF NOT EXISTS is_combo BOOLEAN DEFAULT false;

-- Update existing bumps to false
UPDATE public.order_bumps SET is_combo = false WHERE is_combo IS NULL;
