
-- Fulfill order item 2 of ORD-MMMGE8QE
UPDATE stock_items 
SET order_item_id = 'f90dc133-bc01-4348-b156-a762a93b2afe', 
    status = 'vendido', 
    updated_at = now()
WHERE id = 'a88e70af-7b94-41f1-9a45-8e7dac89ebd8';

UPDATE order_items 
SET delivery_data = jsonb_build_object(
  'nomeProduto', 'BM Disparo 2k diário',
  'linkPerfil', 'Joao Lucas da Silva Carvalho|957585580163315|https://business.facebook.com/invitation/?token=AfmTJIo78ImXjk5JZLZLIGAktZjZdfYl1nm3mrrATEyU-z5bdlrI2I4iVNFnp5GVS8B-RnveNUC0zoGxaGg40nr5bGZ3EwwgkKeGaPCNdblKXDOywAFZ_CIT3yG2F_EtJH_1DHo3QVwWwJOjIx28I75DYTiZ-yU7TS_A6HjvcmJfmfd7vBY0zXLeFmuLcv8Y5aioqujcLpXm8XjdkH8HKGuJ0b0mt4lJrTeybbkN6v1UuKxgQbqMfzDRHSEff0gsIZQN2oplBWtPFzJOfSagkUV9vC83qPY4wNw',
  'bmLinks', jsonb_build_array('Joao Lucas da Silva Carvalho|957585580163315|https://business.facebook.com/invitation/?token=AfmTJIo78ImXjk5JZLZLIGAktZjZdfYl1nm3mrrATEyU-z5bdlrI2I4iVNFnp5GVS8B-RnveNUC0zoGxaGg40nr5bGZ3EwwgkKeGaPCNdblKXDOywAFZ_CIT3yG2F_EtJH_1DHo3QVwWwJOjIx28I75DYTiZ-yU7TS_A6HjvcmJfmfd7vBY0zXLeFmuLcv8Y5aioqujcLpXm8XjdkH8HKGuJ0b0mt4lJrTeybbkN6v1UuKxgQbqMfzDRHSEff0gsIZQN2oplBWtPFzJOfSagkUV9vC83qPY4wNw')
)
WHERE id = 'f90dc133-bc01-4348-b156-a762a93b2afe';

UPDATE orders 
SET status = 'completed', updated_at = now()
WHERE id = 'fd104992-2e06-49ab-8ff4-d1b0c76a42f8';

UPDATE products 
SET stock = stock - 1, updated_at = now()
WHERE id = '021d171c-fe01-44eb-98fc-1f881a0603e9';
