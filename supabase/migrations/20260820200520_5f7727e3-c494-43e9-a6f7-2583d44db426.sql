INSERT INTO public.supplier_submissions (
  supplier_id, 
  type, 
  name, 
  identification, 
  data, 
  payout_amount, 
  status
) VALUES (
  '06dab98f-81f4-4d4d-ad81-60c3178cd0da', 
  'perfil', 
  'TESTE VISIBILIDADE ACCFACE', 
  '123456789', 
  '{"notes": "Item de teste para verificar listagem"}'::jsonb, 
  50.00, 
  'approved'
);