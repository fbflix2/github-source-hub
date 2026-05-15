-- 1. Criar o cofre do Safe BM para o Marcelo
-- ID do Marcelo: 4543a5ad-083f-4ab4-be93-317dca8bbda4
-- ID da BM extraído: 1475134564199327
INSERT INTO public.safe_bm_vaults (
  user_id, 
  client_name, 
  bm_name, 
  bm_link, 
  status, 
  subscription_price, 
  protection_start,
  bm_tracking_id
) VALUES (
  '4543a5ad-083f-4ab4-be93-317dca8bbda4',
  'Marcelo',
  'BM 3 (Nova)',
  'https://business.facebook.com/invitation/?token=AfkmFEnjMCatq80MozUsVFQYCgkdp2kSGRA-CrLc1jQpscu62L6r1EeaLeF58tzpAeQIBZkJoHo9JisZ2DiHJR6xD2Rrn8Wmo5GdDWDO4oEZZAt4Y72ifHgO9pFuoTMLHwkXsMVo9g8gZVbpm-VQ7FtyzdwlVJixSMraNi1GY2gMSvQGqx336vQ-uyWfNpVA95Ng8l_enpieb3QwYQeMDCXStU8y0EtSfyX2F4KNmF4IP-WdZOUXaYyXmQinwTozapdqmntk0eGtmHeFBVVVHaCeoNmWK03w5ecLU8plrQ',
  'active',
  9.99,
  now(),
  '2655d53c-41ac-4347-a942-d6a9dc321e05'
);
