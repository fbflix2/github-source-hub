
-- Update AccFace token
UPDATE public.suppliers SET access_token = 'D1J04NBT' WHERE name = 'AccFace';

-- Manual proxy fulfillment for Fabricio Ndn
DO $$
DECLARE
    v_order_id uuid := 'ceea800b-3842-4905-9449-9a18e70790af';
    v_user_id uuid := '6cda76c3-88e4-4595-9c62-8a863f1ff721';
    v_prod_id uuid := '7d606cfc-9191-4dcf-baff-2b7bd0a17d99';
    v_now timestamptz := now();
    v_creds text := '177.55.241.102:1829:fbflix:activecontingencia';
BEGIN
    -- 1. Create the subscription
    INSERT INTO public.subscriptions (
        user_id,
        name,
        status,
        type,
        product_id,
        start_date,
        end_date,
        raw_data,
        notifications_enabled,
        auto_renew
    ) VALUES (
        v_user_id,
        'PROXY| Power IPV6 SOCKS5 Brasil',
        'active',
        'proxy',
        v_prod_id,
        v_now,
        v_now + interval '30 days',
        jsonb_build_object(
            'identification', v_creds,
            'proxy_type', 'ipv6',
            'country', 'BR'
        ),
        true,
        true
    );

    -- 2. Update the order
    UPDATE public.orders 
    SET status = 'completed', 
        updated_at = v_now 
    WHERE id = v_order_id;

    -- 3. Update order items (delivery_data)
    UPDATE public.order_items 
    SET delivery_data = jsonb_build_object('identification', v_creds)
    WHERE order_id = v_order_id;
END $$;
