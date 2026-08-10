DO $$
DECLARE t record; cmd record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
  END LOOP;

  -- anon: only where a policy explicitly targets anon/public
  FOR cmd IN
    SELECT DISTINCT p.tablename, p.cmd
      FROM pg_policies p
     WHERE p.schemaname='public'
       AND p.permissive='PERMISSIVE'
       AND (p.roles @> ARRAY['anon']::name[] OR p.roles @> ARRAY['public']::name[])
  LOOP
    IF cmd.cmd = 'SELECT' THEN
      EXECUTE format('GRANT SELECT ON public.%I TO anon', cmd.tablename);
    ELSIF cmd.cmd = 'INSERT' THEN
      EXECUTE format('GRANT INSERT ON public.%I TO anon', cmd.tablename);
    ELSIF cmd.cmd = 'UPDATE' THEN
      EXECUTE format('GRANT UPDATE ON public.%I TO anon', cmd.tablename);
    ELSIF cmd.cmd = 'DELETE' THEN
      EXECUTE format('GRANT DELETE ON public.%I TO anon', cmd.tablename);
    ELSIF cmd.cmd = 'ALL' THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon', cmd.tablename);
    END IF;
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;