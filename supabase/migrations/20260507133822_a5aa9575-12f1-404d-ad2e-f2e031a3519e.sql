CREATE OR REPLACE FUNCTION public.search_stock_items_global(q text)
RETURNS TABLE (
  id uuid,
  name text,
  type text,
  identification text,
  status text,
  data jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, type, identification, status, data, created_at
  FROM public.stock_items
  WHERE deleted_at IS NULL
    AND (
      name ILIKE '%' || q || '%'
      OR identification ILIKE '%' || q || '%'
      OR identification_link ILIKE '%' || q || '%'
      OR data::text ILIKE '%' || q || '%'
    )
  ORDER BY created_at DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.search_stock_items_global(text) TO authenticated;