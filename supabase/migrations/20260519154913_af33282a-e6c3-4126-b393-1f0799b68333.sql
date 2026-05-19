-- Create safe_bm_renewals table
CREATE TABLE public.safe_bm_renewals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    vault_id UUID REFERENCES public.safe_bm_vaults(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, verified, rejected
    amount NUMERIC NOT NULL DEFAULT 0,
    new_bm_link TEXT,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.safe_bm_renewals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own renewals" 
ON public.safe_bm_renewals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own renewals" 
ON public.safe_bm_renewals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admins can view all renewals
CREATE POLICY "Admins can view all renewals" 
ON public.safe_bm_renewals 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role::text IN ('admin', 'moderator')
    )
);

-- Create trigger for updated_at
CREATE TRIGGER update_safe_bm_renewals_updated_at
BEFORE UPDATE ON public.safe_bm_renewals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
