CREATE TABLE public.supplier_payment_methods (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'pix', 'bank', etc.
    details TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_payment_methods ENABLE ROW LEVEL SECURITY;

-- Create policies (Suppliers are authenticated via access_token on the public page)
CREATE POLICY "Suppliers can view their own payment methods" 
ON public.supplier_payment_methods 
FOR SELECT 
USING (supplier_id IN (SELECT id FROM public.suppliers WHERE access_token IS NOT NULL));

CREATE POLICY "Suppliers can insert their own payment methods" 
ON public.supplier_payment_methods 
FOR INSERT 
WITH CHECK (supplier_id IN (SELECT id FROM public.suppliers WHERE access_token IS NOT NULL));

CREATE POLICY "Suppliers can update their own payment methods" 
ON public.supplier_payment_methods 
FOR UPDATE 
USING (supplier_id IN (SELECT id FROM public.suppliers WHERE access_token IS NOT NULL));

CREATE POLICY "Suppliers can delete their own payment methods" 
ON public.supplier_payment_methods 
FOR DELETE 
USING (supplier_id IN (SELECT id FROM public.suppliers WHERE access_token IS NOT NULL));

-- Trigger for updated_at
CREATE TRIGGER update_supplier_payment_methods_updated_at
BEFORE UPDATE ON public.supplier_payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();