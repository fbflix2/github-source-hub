
-- Add slug column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug text;

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique ON public.products (slug) WHERE slug IS NOT NULL;

-- Generate slugs for existing products
UPDATE public.products 
SET slug = lower(
  regexp_replace(
    regexp_replace(
      translate(name, 'àáâãäéèêëíìîïóòôõöúùûüçÀÁÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiioooooüuuuucAAAAAEEEEIIIIOOOOOUUUUC'),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
);

-- Create function to auto-generate slug on insert/update
CREATE OR REPLACE FUNCTION public.generate_product_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(
      regexp_replace(
        regexp_replace(
          translate(NEW.name, 'àáâãäéèêëíìîïóòôõöúùûüçÀÁÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiioooooüuuuucAAAAAEEEEIIIIOOOOOUUUUC'),
          '[^a-zA-Z0-9\s-]', '', 'g'
        ),
        '\s+', '-', 'g'
      )
    );
    -- Handle duplicates by appending a suffix
    IF EXISTS (SELECT 1 FROM products WHERE slug = NEW.slug AND id != NEW.id) THEN
      NEW.slug := NEW.slug || '-' || substr(gen_random_uuid()::text, 1, 4);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_generate_product_slug ON public.products;
CREATE TRIGGER trigger_generate_product_slug
  BEFORE INSERT OR UPDATE OF name, slug ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_product_slug();
