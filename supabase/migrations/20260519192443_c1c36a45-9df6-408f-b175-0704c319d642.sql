ALTER TABLE public.profiles ADD COLUMN referrer_id UUID REFERENCES public.partners(id);
CREATE INDEX idx_profiles_referrer_id ON public.profiles(referrer_id);