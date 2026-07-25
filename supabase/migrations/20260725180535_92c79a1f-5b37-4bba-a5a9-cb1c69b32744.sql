REVOKE EXECUTE ON FUNCTION public.check_reseller_checkout_capacity(uuid, uuid[], integer[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_reseller_checkout_capacity(uuid, uuid[], integer[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_reseller_checkout_capacity(uuid, uuid[], integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_reseller_checkout_capacity(uuid, uuid[], integer[]) TO service_role;