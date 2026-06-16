
ALTER TABLE public.safe_bm_renewals ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE public.safe_bm_renewals ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE OR REPLACE FUNCTION public.process_safe_bm_renewals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    renewal_record RECORD;
BEGIN
    IF (NEW.status = 'completed' AND OLD.status != 'completed') THEN
        FOR renewal_record IN 
            SELECT id, vault_id, amount 
            FROM public.safe_bm_renewals 
            WHERE order_id = NEW.id AND status = 'pending'
        LOOP
            -- Mark as paid (awaiting admin to set new access)
            UPDATE public.safe_bm_renewals 
            SET status = 'paid', paid_at = now(), updated_at = now()
            WHERE id = renewal_record.id;

            -- Mark vault as awaiting renewal link (do NOT extend dates yet)
            UPDATE public.safe_bm_vaults
            SET billing_status = 'renewing',
                updated_at = now()
            WHERE id = renewal_record.vault_id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$function$;
