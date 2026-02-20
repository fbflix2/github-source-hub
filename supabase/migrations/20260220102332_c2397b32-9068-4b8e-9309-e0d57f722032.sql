
-- Create stock_folders table
CREATE TABLE public.stock_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_folders ENABLE ROW LEVEL SECURITY;

-- Only admins can manage folders
CREATE POLICY "Admins can manage stock folders"
  ON public.stock_folders
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_stock_folders_updated_at
  BEFORE UPDATE ON public.stock_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
