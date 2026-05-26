-- Add proxy_price_multiplier to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS proxy_price_multiplier NUMERIC DEFAULT 1.0;

-- Comment on column for better documentation
COMMENT ON COLUMN public.profiles.proxy_price_multiplier IS 'Multiplicador aplicado ao preço base de proxys para este cliente específico.';
