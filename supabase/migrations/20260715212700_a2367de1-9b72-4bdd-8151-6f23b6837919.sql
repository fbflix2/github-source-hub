ALTER TABLE public.resellers
ADD COLUMN IF NOT EXISTS lovable_verify_token text;

COMMENT ON COLUMN public.resellers.lovable_verify_token IS 'Token de verificação lovable_verify=... fornecido pelo Lovable ao iniciar a conexão do domínio customizado. Preenchido pelo admin.';