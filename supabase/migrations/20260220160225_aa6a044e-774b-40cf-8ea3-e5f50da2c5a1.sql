
-- Table for default product templates with associated tags
CREATE TABLE public.product_defaults (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage product defaults"
ON public.product_defaults
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_product_defaults_updated_at
BEFORE UPDATE ON public.product_defaults
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
