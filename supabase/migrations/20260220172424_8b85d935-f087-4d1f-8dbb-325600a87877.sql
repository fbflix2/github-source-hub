ALTER TABLE public.purchases
ADD COLUMN sale_price numeric NOT NULL DEFAULT 0,
ADD COLUMN tax_rate numeric NOT NULL DEFAULT 0;