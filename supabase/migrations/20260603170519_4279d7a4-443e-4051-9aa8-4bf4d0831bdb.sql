REVOKE SELECT (account_credentials) ON public.ss_transactions FROM authenticated, anon;
GRANT SELECT (account_credentials) ON public.ss_transactions TO service_role;