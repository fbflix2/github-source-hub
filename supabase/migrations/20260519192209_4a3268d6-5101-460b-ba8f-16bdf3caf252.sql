ALTER TABLE public.orders ADD COLUMN partner_id UUID REFERENCES public.partners(id);
CREATE INDEX idx_orders_partner_id ON public.orders(partner_id);