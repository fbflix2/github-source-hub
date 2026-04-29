CREATE OR REPLACE FUNCTION public.handle_lauth_transfer_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_lauth_email TEXT;
  v_lauth_enabled BOOLEAN;
  v_payload JSONB;
BEGIN
  -- We only care when an item is sold
  IF (NEW.status = 'vendido' AND (OLD.status IS NULL OR OLD.status != 'vendido')) AND NEW.order_item_id IS NOT NULL THEN
    
    -- 1. Find the buyer
    SELECT o.user_id INTO v_user_id
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = NEW.order_item_id;

    -- 2. Check Lauth settings for this buyer
    SELECT lauth_email, lauth_enabled INTO v_lauth_email, v_lauth_enabled
    FROM public.profiles
    WHERE user_id = v_user_id;

    -- 3. If Lauth is enabled and we have a profile ID, trigger transfer
    IF v_lauth_enabled = TRUE AND v_lauth_email IS NOT NULL AND NEW.identification IS NOT NULL THEN
      v_payload := jsonb_build_object(
        'profileId', NEW.identification,
        'email', v_lauth_email,
        'itemId', NEW.id
      );

      -- Call the edge function asynchronously using pg_net
      PERFORM net.http_post(
        url := 'https://mxnlerkeygfvdnznoxld.functions.supabase.co/lauth-transfer',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := v_payload
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_lauth_transfer ON public.stock_items;
CREATE TRIGGER tr_lauth_transfer
AFTER UPDATE ON public.stock_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_lauth_transfer_trigger();