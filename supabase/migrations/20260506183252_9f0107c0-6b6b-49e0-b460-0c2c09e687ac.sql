INSERT INTO public.whatsapp_templates (name, event_key, message_body, active)
VALUES (
  'Renovação Confirmada',
  'proxy_renewed',
  'Olá {{nome}}! 👋\n\nPassando para confirmar que seu proxy *{{produto}}* foi renovado com sucesso! ✅\n\nSua nova data de vencimento é: {{vencimento}}.\n\nAgradecemos pela confiança e desejamos ótimas operações! 🚀',
  true
);