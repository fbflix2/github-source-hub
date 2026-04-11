
INSERT INTO public.whatsapp_templates (name, event_key, message_body, active)
VALUES
(
  'Reposição Realizada',
  'replacement',
  'Olá {{nome}} 👋

Informamos que a reposição do seu produto foi realizada com sucesso! ✅

Produto: {{produto}}
Motivo: {{motivo}}

Acesse sua área de pedidos para conferir as novas credenciais:
{{link}}

Qualquer dúvida estamos à disposição! 😊',
  true
),
(
  'Troca Realizada',
  'product_exchange',
  'Olá {{nome}} 👋

Sua troca de produto foi realizada com sucesso! 🔄

Produto anterior: {{produto}}
Novo produto: {{novo_produto}}
Motivo: {{motivo}}

Acesse sua área de pedidos para conferir:
{{link}}

Estamos sempre buscando a melhor experiência pra você! ⭐',
  true
);
