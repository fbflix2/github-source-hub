
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS gateway_provider text CHECK (gateway_provider IN ('openpix','mercadopago')),
  ADD COLUMN IF NOT EXISTS gateway_openpix_app_id text,
  ADD COLUMN IF NOT EXISTS gateway_mp_access_token text,
  ADD COLUMN IF NOT EXISTS gateway_mp_public_key text;

COMMENT ON COLUMN public.resellers.gateway_provider IS 'Active payment gateway used on the reseller storefront checkout (openpix or mercadopago). NULL disables checkout.';
COMMENT ON COLUMN public.resellers.gateway_openpix_app_id IS 'OpenPix AppID (secret) used to create charges for this reseller.';
COMMENT ON COLUMN public.resellers.gateway_mp_access_token IS 'Mercado Pago access token (secret) used to create charges for this reseller.';
COMMENT ON COLUMN public.resellers.gateway_mp_public_key IS 'Mercado Pago public key (safe for frontend tokenization).';
