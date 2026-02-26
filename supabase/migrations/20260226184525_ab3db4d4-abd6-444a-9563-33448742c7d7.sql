
-- Create block_templates table
CREATE TABLE public.block_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.block_templates ENABLE ROW LEVEL SECURITY;

-- Staff can do everything
CREATE POLICY "Staff can manage block templates"
  ON public.block_templates FOR ALL
  USING (is_staff(auth.uid()));

-- Anyone authenticated can read the default template (needed for client download)
CREATE POLICY "Anyone can read default template"
  ON public.block_templates FOR SELECT
  USING (is_default = true);

-- Trigger to update updated_at
CREATE TRIGGER update_block_templates_updated_at
  BEFORE UPDATE ON public.block_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Ensure only one default template at a time
CREATE OR REPLACE FUNCTION public.ensure_single_default_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.block_templates SET is_default = false WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_default_block_template
  BEFORE INSERT OR UPDATE ON public.block_templates
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_template();
