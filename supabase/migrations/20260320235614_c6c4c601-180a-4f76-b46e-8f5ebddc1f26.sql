DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bm_tracking'
      AND policyname = 'Users can view own bm_tracking'
  ) THEN
    CREATE POLICY "Users can view own bm_tracking"
    ON public.bm_tracking
    FOR SELECT
    TO authenticated
    USING (client_user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bm_tracking'
      AND policyname = 'Users can insert own bm_tracking requests'
  ) THEN
    CREATE POLICY "Users can insert own bm_tracking requests"
    ON public.bm_tracking
    FOR INSERT
    TO authenticated
    WITH CHECK (
      client_user_id = auth.uid()
      AND status = 'pending_setup'
      AND order_id IS NULL
      AND order_item_id IS NULL
      AND stock_item_id IS NULL
      AND sale_price = 0
      AND removed_at IS NULL
      AND notified_at IS NULL
    );
  END IF;
END
$$;