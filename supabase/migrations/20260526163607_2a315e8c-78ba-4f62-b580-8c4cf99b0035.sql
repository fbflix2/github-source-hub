-- Add proxy_fixed_price to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS proxy_fixed_price NUMERIC DEFAULT NULL;

-- Comment on column for better documentation
COMMENT ON COLUMN public.profiles.proxy_fixed_price IS 'Preço fixo por proxy para este cliente. Se definido, ignora o multiplicador e o preço base.';