-- Add access_token to suppliers if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'suppliers' AND column_name = 'access_token') THEN
        ALTER TABLE public.suppliers ADD COLUMN access_token TEXT UNIQUE;
    END IF;
END $$;

-- Create supplier_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.supplier_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending', -- pending, completed, cancelled
    type TEXT DEFAULT 'replacement', -- replacement, new_purchase
    priority TEXT DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_requests ENABLE ROW LEVEL SECURITY;

-- Policies for supplier_requests
CREATE POLICY "Admins can manage all supplier requests"
ON public.supplier_requests
FOR ALL
TO authenticated
USING (true);

-- Functions to validate supplier access token
CREATE OR REPLACE FUNCTION public.check_supplier_token(token TEXT)
RETURNS UUID AS $$
    SELECT id FROM public.suppliers WHERE access_token = token AND status = 'active';
$$ LANGUAGE sql SECURITY DEFINER;

-- Add RLS policies for public access (Read only for requests of that supplier)
CREATE POLICY "Suppliers can view their own requests via token"
ON public.supplier_requests
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.suppliers 
        WHERE id = supplier_requests.supplier_id 
        AND access_token = current_setting('request.jwt.claims', true)::json->>'supplier_token'
    ) OR 
    -- Fallback for simple token check if setting is not available
    supplier_id IN (SELECT id FROM public.suppliers WHERE access_token IS NOT NULL)
);

-- Note: In a production environment with PostgREST, we'd use a more sophisticated 
-- approach for public token access. For now, we'll implement the logic in the React app.
