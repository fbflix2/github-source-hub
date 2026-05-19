-- Add order_id to safe_bm_renewals to link it to orders
ALTER TABLE public.safe_bm_renewals ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id);

-- Create a function to process safe bm renewals
CREATE OR REPLACE FUNCTION public.process_safe_bm_renewals()
RETURNS TRIGGER AS $$
DECLARE
    renewal_record RECORD;
BEGIN
    -- Only run when order status changes to 'completed'
    IF (NEW.status = 'completed' AND OLD.status != 'completed') THEN
        -- Find all renewals linked to this order
        FOR renewal_record IN 
            SELECT id, vault_id, amount 
            FROM public.safe_bm_renewals 
            WHERE order_id = NEW.id AND status = 'pending'
        LOOP
            -- 1. Mark renewal as paid
            UPDATE public.safe_bm_renewals 
            SET status = 'paid', updated_at = now()
            WHERE id = renewal_record.id;

            -- 2. Update the vault
            UPDATE public.safe_bm_vaults
            SET next_billing_at = COALESCE(next_billing_at, now()) + INTERVAL '30 days',
                status = 'active',
                billing_status = 'paid',
                updated_at = now()
            WHERE id = renewal_record.vault_id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS tr_process_safe_bm_renewals ON public.orders;
CREATE TRIGGER tr_process_safe_bm_renewals
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.process_safe_bm_renewals();