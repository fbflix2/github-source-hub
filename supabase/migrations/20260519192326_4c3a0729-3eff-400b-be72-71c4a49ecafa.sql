CREATE OR REPLACE FUNCTION public.process_partner_referral()
RETURNS TRIGGER AS $$
DECLARE
    v_partner_rate NUMERIC;
    v_commission NUMERIC;
BEGIN
    -- Only run when order status changes to 'completed' and it has a partner_id
    IF (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') AND NEW.partner_id IS NOT NULL) THEN
        
        -- Get partner's commission rate
        SELECT commission_rate INTO v_partner_rate 
        FROM public.partners 
        WHERE id = NEW.partner_id AND status = 'active';

        IF FOUND THEN
            v_commission := NEW.total * (v_partner_rate / 100);

            -- Check if referral already exists for this order to avoid duplicates
            IF NOT EXISTS (SELECT 1 FROM public.partner_referrals WHERE order_id = NEW.id) THEN
                -- Insert the referral record
                INSERT INTO public.partner_referrals (
                    partner_id,
                    referred_user_id,
                    order_id,
                    order_total,
                    commission_amount,
                    status
                ) VALUES (
                    NEW.partner_id,
                    NEW.user_id,
                    NEW.id,
                    NEW.total,
                    v_commission,
                    'pending'
                );

                -- Update partner's total referrals count
                UPDATE public.partners 
                SET total_referrals = total_referrals + 1 
                WHERE id = NEW.partner_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS tr_process_partner_referral ON public.orders;
CREATE TRIGGER tr_process_partner_referral
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.process_partner_referral();