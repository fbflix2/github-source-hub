
CREATE TABLE public.ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  position_name TEXT NOT NULL,
  position_price NUMERIC NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  url TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ads"
ON public.ads FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ads"
ON public.ads FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ads"
ON public.ads FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all ads"
ON public.ads FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all ads"
ON public.ads FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_ads_updated_at
BEFORE UPDATE ON public.ads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
