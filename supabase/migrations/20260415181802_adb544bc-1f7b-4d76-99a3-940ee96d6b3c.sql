
-- The "Anyone can view partners by slug" was already dropped in the previous migration
-- and "Users can view own partner data" already exists
-- Just ensure no blanket public policy remains
DO $$
BEGIN
  -- Verify the fix was applied (no-op if already clean)
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'partners' 
    AND schemaname = 'public'
    AND policyname = 'Anyone can view partners by slug'
  ) THEN
    EXECUTE 'DROP POLICY "Anyone can view partners by slug" ON public.partners';
  END IF;
END $$;
