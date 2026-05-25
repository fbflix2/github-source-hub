-- 1. Soft-delete o item placeholder antigo (matriz desativada)
UPDATE public.stock_items
SET deleted_at = now(), order_item_id = NULL, updated_at = now()
WHERE id = '4993d3dd-e92a-4b2d-9ae2-f531bd3f3045';

-- 2. Vincular item real do estoque atual ao pedido
UPDATE public.stock_items
SET order_item_id = '84950435-7622-4fe1-9b16-fd0c91e7b9d2',
    status = 'vendido',
    updated_at = now()
WHERE id = '660f1ec6-ba89-4b30-a9b7-2c32187bb3fc';

-- 3. Atualizar delivery_data do order_item (sem updated_at - tabela não tem essa coluna)
UPDATE public.order_items
SET delivery_data = jsonb_build_object(
  'identification_link', 'https://business.facebook.com/invitation/?token=Afm24w1s8ky-2_RkapHO6uAP8IUTayUKgECqmY-uwKEJURfVs3Gg-CfLe6EOmWARsyD0Pojys8qxl-5wlPs43cbLS6nX7Xc4U8t9C5NjHiWrP7qS5yZi6xLHLgqcprnh5nQvD3oQ7MwdfGCfKUwAyP0Hi1vjg6ELwcZ1G55O0JD2EsgBKm84Yk5olj-zl409j0D85OSB0cSNpmIlEt38XqIUQmjmFDqtdsrU13I5ELfXi81RBsoebvWUWV7uAwl35DgCU1eTOS3RTcyVJJBJ9lTs9tZAkQhE-9AlmANVLw',
  'name', 'BM3-1631006818180852-fbflix',
  'bmLinks', jsonb_build_array('https://business.facebook.com/invitation/?token=Afm24w1s8ky-2_RkapHO6uAP8IUTayUKgECqmY-uwKEJURfVs3Gg-CfLe6EOmWARsyD0Pojys8qxl-5wlPs43cbLS6nX7Xc4U8t9C5NjHiWrP7qS5yZi6xLHLgqcprnh5nQvD3oQ7MwdfGCfKUwAyP0Hi1vjg6ELwcZ1G55O0JD2EsgBKm84Yk5olj-zl409j0D85OSB0cSNpmIlEt38XqIUQmjmFDqtdsrU13I5ELfXi81RBsoebvWUWV7uAwl35DgCU1eTOS3RTcyVJJBJ9lTs9tZAkQhE-9AlmANVLw')
)
WHERE id = '84950435-7622-4fe1-9b16-fd0c91e7b9d2';